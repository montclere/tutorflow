"""Свободные интервалы, публикации записи и вычисление допустимых ячеек времени."""

from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from enum import StrEnum
from uuid import UUID

from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.recurrence import RecurrenceRule
from app.modules.scheduling.domain.values import LessonPrice, utc_start


class BookingMode(StrEnum):
    INSTANT = "instant"
    APPROVAL = "approval"


@dataclass(frozen=True)
class TimeWindow:
    starts_at: datetime
    ends_at: datetime
    recurrence: RecurrenceRule | None = None

    def __post_init__(self) -> None:
        object.__setattr__(self, "starts_at", utc_start(self.starts_at, "UTC"))
        object.__setattr__(self, "ends_at", utc_start(self.ends_at, "UTC"))

        if self.ends_at <= self.starts_at:
            raise LessonError("invalid_availability")

    def expand(self, start: datetime, end: datetime, limit: int) -> tuple["TimeWindow", ...]:
        if self.recurrence is None:
            return (self,) if self.starts_at < end and self.ends_at > start else ()

        duration = self.ends_at - self.starts_at

        try:
            preceding = start - duration
        except OverflowError as error:
            raise LessonError("invalid_lesson_range") from error

        expansion = self.recurrence.expand(preceding, end, limit)

        if expansion.conflicts:
            raise LessonError("series_time_conflict")

        return tuple(
            TimeWindow(item.starts_at, item.ends_at)
            for item in expansion.occurrences
            if item.ends_at > start
        )


@dataclass(frozen=True)
class AvailabilityAudience:
    all_connected: bool = True
    card_ids: tuple[UUID, ...] = ()
    group_ids: tuple[UUID, ...] = ()

    def __post_init__(self) -> None:
        if (self.all_connected and (self.card_ids or self.group_ids)) or (
            not self.all_connected and not self.card_ids and not self.group_ids
        ):
            raise LessonError("invalid_availability")

        if len(set(self.card_ids)) != len(self.card_ids) or len(set(self.group_ids)) != len(
            self.group_ids
        ):
            raise LessonError("invalid_availability")


@dataclass(frozen=True)
class AvailabilityPublication:
    id: UUID
    teacher_id: UUID
    windows: tuple[TimeWindow, ...]
    timezone: str
    duration_minutes: int
    step_minutes: int
    break_minutes: int
    price: LessonPrice
    mode: BookingMode
    audience: AvailabilityAudience
    version: int = 1
    active: bool = True
    lesson_id: UUID | None = None
    lesson_version: int | None = None

    def __post_init__(self) -> None:
        if (
            not self.windows
            or min(self.duration_minutes, self.step_minutes, self.version) < 1
            or self.break_minutes < 0
        ):
            raise LessonError("invalid_availability")

        utc_start(self.windows[0].starts_at, self.timezone)

        if (self.lesson_id is None) != (self.lesson_version is None):
            raise LessonError("invalid_availability")

    def require_version(self, expected_version: int) -> None:
        if not self.active or self.version != expected_version:
            raise LessonError("availability_conflict")

    def remove(self, expected_version: int) -> "AvailabilityPublication":
        self.require_version(expected_version)

        return replace(self, active=False, version=self.version + 1)


@dataclass(frozen=True)
class BusyInterval:
    starts_at: datetime
    ends_at: datetime
    break_minutes: int = 0

    def conflicts(self, start: datetime, end: datetime, break_minutes: int) -> bool:
        gap = timedelta(minutes=max(self.break_minutes, break_minutes))

        return start - self.ends_at < gap and self.starts_at - end < gap


@dataclass(frozen=True)
class AvailableSlot:
    publication_id: UUID
    version: int
    starts_at: datetime
    ends_at: datetime
    price: LessonPrice


def available_slots(
    publication: AvailabilityPublication,
    start: datetime,
    end: datetime,
    now: datetime,
    busy: tuple[BusyInterval, ...],
    limit: int,
) -> tuple[AvailableSlot, ...]:
    result: dict[datetime, AvailableSlot] = {}
    inspected = 0
    duration = timedelta(minutes=publication.duration_minutes)
    step = timedelta(minutes=publication.step_minutes)

    for window in publication.windows:
        for interval in window.expand(start, end, limit):
            candidate = interval.starts_at
            lower = max(start, now, interval.starts_at)
            right = min(interval.ends_at, end)

            if right - lower < duration:
                continue

            stop = right - duration

            if candidate < lower:
                candidate += ((lower - candidate) // step) * step

                if candidate < lower:
                    candidate += step

            while candidate <= stop:
                inspected += 1

                if inspected > limit:
                    raise LessonError("availability_limit")

                finish = candidate + duration

                if candidate > now and not any(
                    item.conflicts(candidate, finish, publication.break_minutes) for item in busy
                ):
                    result[candidate] = AvailableSlot(
                        publication.id, publication.version, candidate, finish, publication.price
                    )

                if stop - candidate < step:
                    break

                candidate += step

    return tuple(result[key] for key in sorted(result))


def free_intervals(
    windows: tuple[TimeWindow, ...],
    excluded: tuple[TimeWindow, ...],
    start: datetime,
    end: datetime,
    limit: int,
) -> tuple[TimeWindow, ...]:
    free = [
        (max(item.starts_at, start), min(item.ends_at, end))
        for window in windows
        for item in window.expand(start, end, limit)
    ]
    busy = [item for window in excluded for item in window.expand(start, end, limit)]

    if len(free) + len(busy) > limit:
        raise LessonError("availability_limit")

    for block in busy:
        updated = []

        for left, right in free:
            if block.ends_at <= left or block.starts_at >= right:
                updated.append((left, right))
            else:
                if left < block.starts_at:
                    updated.append((left, block.starts_at))

                if block.ends_at < right:
                    updated.append((block.ends_at, right))

        free = updated

        if len(free) > limit:
            raise LessonError("availability_limit")

    merged: list[TimeWindow] = []

    for left, right in sorted(free):
        if left >= right:
            continue

        if merged and left <= merged[-1].ends_at:
            merged[-1] = TimeWindow(merged[-1].starts_at, max(right, merged[-1].ends_at))
        else:
            merged.append(TimeWindow(left, right))

    if len(merged) > limit:
        raise LessonError("availability_limit")

    return tuple(merged)


def padded_range(start: datetime, end: datetime, minutes: int) -> tuple[datetime, datetime]:
    try:
        gap = timedelta(minutes=minutes)

        return start - gap, end + gap
    except OverflowError as error:
        raise LessonError("invalid_lesson_range") from error
