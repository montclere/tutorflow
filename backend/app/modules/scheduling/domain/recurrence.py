"""Календарное повторение в локальном времени с явными конфликтами переходов часов."""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from enum import StrEnum
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import LessonConditions


DEFAULT_SCAN_LIMIT = 100_000
WEEK_DAYS = 7
MONTHS_IN_YEAR = 12


class Frequency(StrEnum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


@dataclass(frozen=True)
class WeeklySlot:
    weekday: int
    starts_at: time
    duration_minutes: int

    def __post_init__(self) -> None:
        if (
            not 0 <= self.weekday < WEEK_DAYS
            or self.starts_at.tzinfo is not None
            or self.duration_minutes < 1
        ):
            raise LessonError("invalid_series_rule")


@dataclass(frozen=True)
class RecurrenceOccurrence:
    local_date: date
    starts_at: datetime
    duration_minutes: int

    @property
    def ends_at(self) -> datetime:
        try:
            return self.starts_at + timedelta(minutes=self.duration_minutes)
        except OverflowError as error:
            raise LessonError("invalid_lesson_duration") from error


@dataclass(frozen=True)
class RecurrenceConflict:
    local_date: date
    local_time: time
    code: str


@dataclass(frozen=True)
class Expansion:
    occurrences: tuple[RecurrenceOccurrence, ...]
    conflicts: tuple[RecurrenceConflict, ...]


@dataclass(frozen=True)
class RecurrenceRule:
    first_date: date
    starts_at: time
    timezone: str
    frequency: Frequency
    interval: int = 1
    weekly_slots: tuple[WeeklySlot, ...] = ()
    until: date | None = None
    count: int | None = None
    duration_minutes: int = 60
    ambiguous_time: Literal["earlier", "later"] | None = None
    nonexistent_time: Literal["skip"] | None = None

    def __post_init__(self) -> None:
        try:
            ZoneInfo(self.timezone)
        except (ZoneInfoNotFoundError, ValueError) as error:
            raise LessonError("invalid_series_rule") from error

        if (
            self.interval < 1
            or self.starts_at.tzinfo is not None
            or self.duration_minutes < 1
            or self.count is not None
            and self.count < 1
            or self.until is not None
            and self.until < self.first_date
            or self.until is not None
            and self.count is not None
            or self.weekly_slots
            and self.frequency is not Frequency.WEEKLY
            or len({slot.weekday for slot in self.weekly_slots}) != len(self.weekly_slots)
            or self.ambiguous_time not in {None, "earlier", "later"}
            or self.nonexistent_time not in {None, "skip"}
        ):
            raise LessonError("invalid_series_rule")

    def slot_on(self, day: date) -> WeeklySlot | None:
        distance = (day - self.first_date).days

        if distance < 0:
            return None

        if self.frequency is Frequency.DAILY:
            matches = distance % self.interval == 0
        elif self.frequency is Frequency.MONTHLY:
            months = (
                (day.year - self.first_date.year) * MONTHS_IN_YEAR
                + day.month
                - self.first_date.month
            )
            matches = months % self.interval == 0 and day.day == self.first_date.day
        else:
            weeks = (distance + self.first_date.weekday()) // WEEK_DAYS

            if weeks % self.interval:
                return None

            slots = self.weekly_slots or (
                WeeklySlot(self.first_date.weekday(), self.starts_at, self.duration_minutes),
            )

            return next((slot for slot in slots if slot.weekday == day.weekday()), None)

        return WeeklySlot(day.weekday(), self.starts_at, self.duration_minutes) if matches else None

    def resolve(self, day: date, clock: time) -> tuple[datetime | None, str | None]:
        local = datetime.combine(day, clock)
        zone = ZoneInfo(self.timezone)
        candidates = tuple(local.replace(tzinfo=zone, fold=fold).astimezone(UTC) for fold in (0, 1))
        valid = tuple(
            sorted(
                {
                    candidate
                    for candidate in candidates
                    if candidate.astimezone(zone).replace(tzinfo=None) == local
                }
            )
        )

        if not valid:
            return None, "nonexistent_local_time"

        if len(valid) == 1:
            return valid[0], None

        if self.ambiguous_time is None:
            return None, "ambiguous_local_time"

        return valid[0 if self.ambiguous_time == "earlier" else -1], None

    def expand(
        self, start: datetime, end: datetime, limit: int, scan_limit: int = DEFAULT_SCAN_LIMIT
    ) -> Expansion:
        if start.utcoffset() is None or end.utcoffset() is None or end <= start or limit < 1:
            raise LessonError("invalid_lesson_range")

        zone = ZoneInfo(self.timezone)
        first = start.astimezone(zone).date()
        last = end.astimezone(zone).date()
        day = self.first_date if self.count is not None else max(self.first_date, first)
        last = min(last, self.until) if self.until else last
        occurrences: list[RecurrenceOccurrence] = []
        conflicts: list[RecurrenceConflict] = []
        planned = 0
        scanned = 0

        while day <= last:
            scanned += 1

            if scanned > scan_limit:
                raise LessonError("series_expansion_limit")

            slot = self.slot_on(day)

            if slot is not None:
                moment, conflict = self.resolve(day, slot.starts_at)

                if conflict != "nonexistent_local_time":
                    planned += 1

                if moment is not None and start <= moment < end:
                    occurrences.append(RecurrenceOccurrence(day, moment, slot.duration_minutes))
                elif conflict is not None and first <= day <= last:
                    candidates = tuple(
                        datetime.combine(day, slot.starts_at)
                        .replace(tzinfo=zone, fold=fold)
                        .astimezone(UTC)
                        for fold in (0, 1)
                    )
                    relevant = any(start <= candidate < end for candidate in candidates)

                    if relevant and (
                        conflict != "nonexistent_local_time" or self.nonexistent_time is None
                    ):
                        conflicts.append(RecurrenceConflict(day, slot.starts_at, conflict))

                if len(occurrences) + len(conflicts) > limit:
                    raise LessonError("series_expansion_limit")

                if self.count is not None and planned >= self.count:
                    break

            if day == date.max:
                break

            day += timedelta(days=1)

        return Expansion(tuple(occurrences), tuple(conflicts))


@dataclass(frozen=True)
class RecurrenceDraft:
    frequency: Frequency
    interval: int = 1
    starts_at: datetime | None = None
    timezone: str | None = None
    weekly_slots: tuple[WeeklySlot, ...] = ()
    until: date | None = None
    count: int | None = None
    ambiguous_time: Literal["earlier", "later"] | None = None
    nonexistent_time: Literal["skip"] | None = None

    def resolve(
        self, conditions: LessonConditions, baseline: RecurrenceRule | None = None
    ) -> RecurrenceRule:
        timezone = self.timezone or (baseline.timezone if baseline else conditions.timezone)

        try:
            zone = ZoneInfo(timezone)
        except (ValueError, ZoneInfoNotFoundError) as error:
            raise LessonError("invalid_series_rule") from error

        moment = self.starts_at or conditions.starts_at

        if moment.utcoffset() is None:
            raise LessonError("invalid_series_rule")

        local = moment.astimezone(zone)
        first = baseline.first_date if baseline and self.starts_at is None else local.date()
        clock = (
            baseline.starts_at
            if baseline and self.starts_at is None
            else local.time().replace(tzinfo=None)
        )

        return RecurrenceRule(
            first,
            clock,
            timezone,
            self.frequency,
            self.interval,
            self.weekly_slots,
            self.until,
            self.count,
            conditions.duration_minutes,
            self.ambiguous_time,
            self.nonexistent_time,
        )
