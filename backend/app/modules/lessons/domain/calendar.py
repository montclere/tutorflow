"""Расчёт интервалов и календарь одной учебной карточки."""

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.shared.domain.errors import Problem, ProblemCode

CONTENT = ("title", "description", "preparation", "private_note")


@dataclass(frozen=True)
class LocalTimeIssue(Exception):
    position: int
    local_date: str
    code: str


def weekly_intervals(
    first: datetime, timezone: str, count: int, minutes: int, ambiguity: str | None = None
) -> list[tuple[datetime, datetime]]:
    try:
        zone = ZoneInfo(timezone)
    except (ValueError, ZoneInfoNotFoundError):
        raise Problem(ProblemCode.VALIDATION_FAILED) from None
    if first.tzinfo is not None or first.second or first.microsecond:
        raise Problem(ProblemCode.VALIDATION_FAILED)
    intervals = []
    for index in range(count):
        local = first + timedelta(weeks=index)
        candidates = sorted(
            {
                instant
                for fold in (0, 1)
                if (instant := local.replace(tzinfo=zone, fold=fold).astimezone(UTC))
                .astimezone(zone)
                .replace(tzinfo=None)
                == local
            }
        )
        if not candidates or (len(candidates) > 1 and ambiguity is None):
            raise LocalTimeIssue(
                index + 1, local.date().isoformat(), "ambiguous" if candidates else "nonexistent"
            )
        start = candidates[-1 if ambiguity == "later" else 0]
        intervals.append((start, start + timedelta(minutes=minutes)))
    return intervals


def instant(value: str) -> datetime:
    return datetime.fromisoformat(value)


def timestamp(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def bounds(lesson: dict) -> tuple[datetime, datetime]:
    return instant(lesson["starts_at"]), instant(lesson["ends_at"])


def overlaps(first: tuple[datetime, datetime], second: tuple[datetime, datetime]) -> bool:
    return first[0] < second[1] and second[0] < first[1]


def interval(start: datetime, minutes: int) -> dict:
    if start.utcoffset() != timedelta(0) or start.second or start.microsecond:
        raise Problem(ProblemCode.VALIDATION_FAILED)
    return {
        "starts_at": timestamp(start),
        "ends_at": timestamp(start + timedelta(minutes=minutes)),
        "duration_minutes": minutes,
    }


@dataclass
class Calendar:
    card_id: str
    lessons: dict[str, dict] = field(default_factory=dict)
    series: dict[str, dict] = field(default_factory=dict)
    requests: dict[str, dict] = field(default_factory=dict)
    notices: dict[str, dict] = field(default_factory=dict)
    events: dict[str, list[dict]] = field(default_factory=dict)
    keys: dict[str, dict] = field(default_factory=dict)
    notifications: list[dict] = field(default_factory=list)

    def data(self) -> dict:
        return {
            name: getattr(self, name)
            for name in (
                "lessons",
                "series",
                "requests",
                "notices",
                "events",
                "keys",
                "notifications",
            )
        }

    def projected(self, series: dict, slot: dict) -> dict:
        return {
            **series["content_template"],
            **slot,
            "student_card_id": self.card_id,
            "series_id": series["series_id"],
            "status": "scheduled",
            "outcome_reason": None,
            "is_series_exception": False,
            "uses_series_content": True,
        }

    def find(self, lesson_id: str) -> dict | None:
        if lesson_id in self.lessons:
            return self.lessons[lesson_id]
        for series in self.series.values():
            for slot in series["slots"]:
                if slot.get("lesson_id") == lesson_id:
                    return self.projected(series, slot)
        return None

    def all_lessons(self):
        yield from self.lessons.values()
        for series in self.series.values():
            for slot in series["slots"]:
                lesson_id = slot.get("lesson_id")
                if lesson_id and lesson_id not in self.lessons:
                    yield self.projected(series, slot)

    def materialize(self, lesson: dict) -> dict:
        return self.lessons.setdefault(lesson["lesson_id"], lesson.copy())

    def prepare(self, now: datetime) -> bool:
        before = len(self.lessons)
        for series in self.series.values():
            upcoming = []
            for slot in series["slots"]:
                lesson_id = slot.get("lesson_id")
                if not lesson_id:
                    continue
                lesson = self.find(lesson_id)
                if lesson is None or lesson["status"] != "scheduled":
                    continue
                start, _ = bounds(lesson)
                if start <= now:
                    self.materialize(lesson)
                else:
                    upcoming.append(lesson)
            if upcoming:
                self.materialize(min(upcoming, key=bounds))
        return len(self.lessons) != before

    def event(
        self, lesson: dict, event: str, actor: str, role: str, now: datetime, **details: object
    ) -> None:
        self.events.setdefault(lesson["lesson_id"], []).append(
            {
                "event_id": str(uuid4()),
                "event": event,
                "actor_account_id": actor,
                "actor_role": role,
                "occurred_at": timestamp(now),
                "version": lesson["version"],
                **details,
            }
        )
