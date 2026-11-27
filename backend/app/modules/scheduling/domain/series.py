"""Версии регулярного расписания, будущие границы и сохраняемые периоды пауз."""

from dataclasses import dataclass, replace
from datetime import datetime
from uuid import UUID

from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import Lesson
from app.modules.scheduling.domain.recurrence import RecurrenceRule


@dataclass(frozen=True)
class SeriesSegment:
    id: UUID
    rule: RecurrenceRule
    template: Lesson
    effective_at: datetime
    until_at: datetime | None = None

    def contains(self, starts_at: datetime) -> bool:
        return starts_at >= self.effective_at and (
            self.until_at is None or starts_at < self.until_at
        )


@dataclass(frozen=True)
class SeriesPause:
    id: UUID
    starts_at: datetime
    ends_at: datetime | None = None

    def __post_init__(self) -> None:
        if (
            self.starts_at.utcoffset() is None
            or self.ends_at is not None
            and (self.ends_at.utcoffset() is None or self.ends_at <= self.starts_at)
        ):
            raise LessonError("invalid_series_pause")

    def contains(self, starts_at: datetime) -> bool:
        return self.starts_at <= starts_at and (self.ends_at is None or starts_at < self.ends_at)


@dataclass(frozen=True)
class LessonSeries:
    id: UUID
    teacher_id: UUID
    created_at: datetime
    segments: tuple[SeriesSegment, ...]
    pauses: tuple[SeriesPause, ...] = ()
    version: int = 1
    deleted: bool = False

    def __post_init__(self) -> None:
        if not self.segments or self.version < 1:
            raise LessonError("invalid_series_rule")

        if any(segment.template.teacher_id != self.teacher_id for segment in self.segments):
            raise LessonError("invalid_series_rule")

    def require_version(self, expected_version: int) -> None:
        if self.deleted or self.version != expected_version:
            raise LessonError("series_conflict")

    def replace_future(
        self, segment: SeriesSegment, now: datetime, expected_version: int
    ) -> "LessonSeries":
        self.require_version(expected_version)

        if segment.effective_at < now:
            raise LessonError("series_past_change")

        previous = tuple(
            replace(
                old,
                until_at=min(old.until_at, segment.effective_at)
                if old.until_at
                else segment.effective_at,
            )
            for old in self.segments
            if old.effective_at < segment.effective_at
        )

        return replace(self, segments=previous + (segment,), version=self.version + 1)

    def pause(self, pause: SeriesPause, now: datetime, expected_version: int) -> "LessonSeries":
        self.require_version(expected_version)

        if pause.starts_at < now:
            raise LessonError("series_past_change")

        return replace(self, pauses=self.pauses + (pause,), version=self.version + 1)

    def resume(self, pause_id: UUID, now: datetime, expected_version: int) -> "LessonSeries":
        self.require_version(expected_version)

        selected = next((pause for pause in self.pauses if pause.id == pause_id), None)

        if selected is None or selected.ends_at is not None and selected.ends_at <= now:
            raise LessonError("series_pause_not_found")

        pauses = tuple(
            replace(pause, ends_at=now) if pause.id == pause_id and pause.starts_at < now else pause
            for pause in self.pauses
            if pause.id != pause_id or pause.starts_at < now
        )

        return replace(self, pauses=pauses, version=self.version + 1)

    def remove(self, now: datetime, expected_version: int) -> "LessonSeries":
        self.require_version(expected_version)

        segments = tuple(
            replace(segment, until_at=min(segment.until_at, now) if segment.until_at else now)
            for segment in self.segments
            if segment.effective_at < now
        )

        return replace(
            self,
            segments=segments or (replace(self.segments[0], until_at=now),),
            deleted=True,
            version=self.version + 1,
        )

    def paused(self, starts_at: datetime) -> bool:
        return any(pause.contains(starts_at) for pause in self.pauses)
