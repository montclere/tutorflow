"""Команды регулярного расписания, результаты подготовки и сведения о последствиях."""

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID

from app.modules.scheduling.application.lesson_contracts import LessonDraft
from app.modules.scheduling.domain.lessons import Lesson
from app.modules.scheduling.domain.recurrence import (
    RecurrenceConflict,
    RecurrenceDraft,
    RecurrenceRule,
)
from app.modules.scheduling.domain.series import LessonSeries


@dataclass(frozen=True)
class SeriesCreate:
    rule: RecurrenceRule | RecurrenceDraft
    lesson: LessonDraft | None = None
    source_lesson_id: UUID | None = None
    source_version: int | None = None
    request_id: UUID | None = None


@dataclass(frozen=True)
class SeriesChange:
    expected_version: int
    effective_at: datetime | None = None
    rule: RecurrenceRule | RecurrenceDraft | None = None
    lesson: LessonDraft | None = None
    refresh_group: bool = False
    overwrite_exceptions: bool = False
    allow_confirmed: bool = False
    preview: bool = False


@dataclass(frozen=True)
class SeriesOccurrence:
    series_id: UUID
    segment_id: UUID
    local_date: date
    lesson: Lesson
    customized: bool = False
    suppressed: bool = False


@dataclass(frozen=True)
class SeriesImpact:
    affected: tuple[UUID, ...] = ()
    confirmed: tuple[UUID, ...] = ()
    exceptions: tuple[UUID, ...] = ()
    confirmed_schedule: bool = False


@dataclass(frozen=True)
class SeriesResult:
    series: LessonSeries
    observed_at: datetime
    impact: SeriesImpact = SeriesImpact()
    conflicts: tuple[RecurrenceConflict, ...] = ()


@dataclass(frozen=True)
class SeriesRevision:
    id: UUID
    actor_id: UUID
    happened_at: datetime
    kind: str
    series: LessonSeries


@dataclass(frozen=True)
class SavedSeriesRequest:
    fingerprint: str
    series: LessonSeries


@dataclass(frozen=True)
class OwnSeriesResult:
    result: SeriesResult
    card_id: UUID
    can_reply: bool
