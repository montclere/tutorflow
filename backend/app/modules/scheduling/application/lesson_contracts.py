"""Типизированные команды, результаты и снимки истории занятий."""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from app.modules.groups.public import LessonGroup
from app.modules.scheduling.domain.lessons import Lesson
from app.modules.scheduling.domain.values import LessonPrice, RevisionKind
from app.modules.students.public import CardReference


@dataclass(frozen=True)
class ParticipantDraft:
    card_id: UUID
    profile_id: UUID | None = None
    price: LessonPrice | None = None


@dataclass(frozen=True)
class LessonDraft:
    starts_at: datetime
    timezone: str | None = None
    duration_minutes: int | None = None
    participants: tuple[ParticipantDraft, ...] | None = None
    group_id: UUID | None = None
    title: str | None = None
    subject: str | None = None
    delivery_format: str | None = None
    private_notes: str | None = None
    confirmation: bool = False
    request_id: UUID | None = None


@dataclass(frozen=True)
class LessonPatch:
    expected_version: int
    starts_at: datetime | None = None
    timezone: str | None = None
    duration_minutes: int | None = None
    participants: tuple[ParticipantDraft, ...] | None = None
    text_changes: dict[str, str | None] = field(default_factory=dict)
    confirmation: bool | None = None
    reset_confirmations: bool = False


@dataclass(frozen=True)
class TeachingPreferences:
    price: LessonPrice | None = None
    duration_minutes: int | None = None


@dataclass(frozen=True)
class PreferencesPatch:
    price: LessonPrice | None = None
    duration_minutes: int | None = None
    fields: frozenset[str] = frozenset()


@dataclass(frozen=True)
class LessonCursor:
    starts_at: datetime
    id: UUID


@dataclass(frozen=True)
class CalendarWarning:
    code: str
    event_id: UUID


@dataclass(frozen=True)
class LessonResult:
    lesson: Lesson
    observed_at: datetime
    warnings: tuple[CalendarWarning, ...] = ()
    more_warnings: bool = False


@dataclass(frozen=True)
class SavedLessonRequest:
    fingerprint: str
    lesson: Lesson


@dataclass(frozen=True)
class LessonRevision:
    id: UUID
    actor_id: UUID
    happened_at: datetime
    kind: RevisionKind
    lesson: Lesson


@dataclass(frozen=True)
class OwnLesson:
    lesson: Lesson
    card_id: UUID
    can_reply: bool
    now: datetime


@dataclass(frozen=True)
class LessonSources:
    commands: tuple[ParticipantDraft, ...]
    cards: dict[UUID, CardReference]
    group: LessonGroup | None
    group_prices: dict[UUID, Decimal]
    preserve_snapshot: bool = False
