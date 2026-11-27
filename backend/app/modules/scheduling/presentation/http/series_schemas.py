"""Команды серий и отдельные безопасные представления расписания для участников."""

from dataclasses import asdict
from datetime import date, datetime, time
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, Field

from app.modules.scheduling.application.series_contracts import (
    OwnSeriesResult,
    RecurrenceDraft,
    SeriesChange,
    SeriesCreate,
    SeriesResult,
)
from app.modules.scheduling.domain.recurrence import Frequency, RecurrenceRule, WeeklySlot
from app.modules.scheduling.presentation.http.lesson_schemas import (
    ConfirmationView,
    GroupSnapshotView,
    Input,
    LessonCreate,
    ParticipantView,
    Price,
)


class WeeklySlotInput(Input):
    weekday: Annotated[int, Field(ge=0, le=6)]
    starts_at: time
    duration_minutes: Annotated[int, Field(ge=1)]

    def to_slot(self) -> WeeklySlot:
        return WeeklySlot(self.weekday, self.starts_at, self.duration_minutes)


class RecurrenceInput(Input):
    frequency: Frequency
    interval: Annotated[int, Field(ge=1)] = 1
    starts_at: AwareDatetime | None = None
    timezone: Annotated[str | None, Field(min_length=1, max_length=80)] = None
    weekly_slots: Annotated[list[WeeklySlotInput], Field(max_length=7)] = []
    until: date | None = None
    count: Annotated[int | None, Field(ge=1)] = None
    ambiguous_time: Literal["earlier", "later"] | None = None
    nonexistent_time: Literal["skip"] | None = None

    def to_command(self) -> RecurrenceDraft:
        return RecurrenceDraft(
            self.frequency,
            self.interval,
            self.starts_at,
            self.timezone,
            tuple(slot.to_slot() for slot in self.weekly_slots),
            self.until,
            self.count,
            self.ambiguous_time,
            self.nonexistent_time,
        )


class SeriesCreateInput(Input):
    recurrence: RecurrenceInput
    lesson: LessonCreate | None = None
    source_lesson_id: UUID | None = None
    source_version: Annotated[int | None, Field(ge=1)] = None
    request_id: UUID | None = None

    def to_command(self) -> SeriesCreate:
        return SeriesCreate(
            self.recurrence.to_command(),
            self.lesson.to_command() if self.lesson else None,
            self.source_lesson_id,
            self.source_version,
            self.request_id,
        )


class SeriesUpdateInput(Input):
    expected_version: Annotated[int, Field(ge=1)]
    effective_at: AwareDatetime | None = None
    recurrence: RecurrenceInput | None = None
    lesson: LessonCreate | None = None
    refresh_group: bool = False
    overwrite_exceptions: bool = False
    allow_confirmed: bool = False
    preview: bool = False

    def to_command(self) -> SeriesChange:
        return SeriesChange(
            self.expected_version,
            self.effective_at,
            self.recurrence.to_command() if self.recurrence else None,
            self.lesson.to_command() if self.lesson else None,
            self.refresh_group,
            self.overwrite_exceptions,
            self.allow_confirmed,
            self.preview,
        )


class VersionInput(Input):
    expected_version: Annotated[int, Field(ge=1)]


class PauseInput(VersionInput):
    starts_at: AwareDatetime
    ends_at: AwareDatetime | None = None
    preview: bool = False
    allow_confirmed: bool = False


class PrepareInput(Input):
    starts_at: AwareDatetime
    ends_at: AwareDatetime


class RuleView(BaseModel):
    first_date: date
    starts_at: time
    timezone: str
    frequency: Frequency
    interval: int
    weekly_slots: list[WeeklySlotInput]
    until: date | None
    count: int | None
    duration_minutes: int
    ambiguous_time: str | None
    nonexistent_time: str | None

    @classmethod
    def from_rule(cls, rule: RecurrenceRule) -> "RuleView":
        return cls.model_validate(asdict(rule))


class TemplateView(BaseModel):
    title: str | None
    subject: str | None
    delivery_format: str | None
    private_notes: str | None
    group: GroupSnapshotView | None
    confirmation: bool
    participants: list[ParticipantView]


class SegmentView(BaseModel):
    id: UUID
    effective_at: datetime
    until_at: datetime | None
    recurrence: RuleView
    template: TemplateView


class PauseView(BaseModel):
    id: UUID
    starts_at: datetime
    ends_at: datetime | None


class SeriesView(BaseModel):
    id: UUID
    teacher_id: UUID
    created_at: datetime
    version: int
    deleted: bool
    pauses: list[PauseView]
    segments: list[SegmentView]

    @classmethod
    def from_result(cls, result: SeriesResult) -> "SeriesView":
        series = result.series

        return cls(
            id=series.id,
            teacher_id=series.teacher_id,
            created_at=series.created_at,
            version=series.version,
            deleted=series.deleted,
            pauses=[PauseView(**asdict(pause)) for pause in series.pauses],
            segments=[
                SegmentView(
                    id=segment.id,
                    effective_at=segment.effective_at,
                    until_at=segment.until_at,
                    recurrence=RuleView.from_rule(segment.rule),
                    template=TemplateView(
                        title=segment.template.conditions.title,
                        subject=segment.template.conditions.subject,
                        delivery_format=segment.template.conditions.delivery_format,
                        private_notes=segment.template.conditions.private_notes,
                        group=GroupSnapshotView(
                            id=segment.template.group_id, name=segment.template.group_name
                        )
                        if segment.template.group_id and segment.template.group_name
                        else None,
                        confirmation=segment.template.confirmation,
                        participants=[
                            ParticipantView.from_participant(part, result.observed_at)
                            for part in segment.template.participants
                        ],
                    ),
                )
                for segment in series.segments
            ],
        )


class ImpactView(BaseModel):
    affected: list[UUID]
    confirmed: list[UUID]
    exceptions: list[UUID]
    confirmed_schedule: bool


class RecurrenceConflictView(BaseModel):
    local_date: date
    local_time: time
    code: str


class SeriesOperationView(SeriesView):
    impact: ImpactView
    conflicts: list[RecurrenceConflictView]

    @classmethod
    def from_operation(cls, result: SeriesResult) -> "SeriesOperationView":
        return cls.model_validate(
            SeriesView.from_result(result).model_dump()
            | dict(
                impact=asdict(result.impact),
                conflicts=[asdict(conflict) for conflict in result.conflicts],
            )
        )


class OwnSegmentView(BaseModel):
    id: UUID
    effective_at: datetime
    until_at: datetime | None
    recurrence: RuleView
    title: str | None
    subject: str | None
    delivery_format: str | None
    group: GroupSnapshotView | None
    price: Price
    confirmation: ConfirmationView


class OwnSeriesView(BaseModel):
    id: UUID
    teacher_id: UUID
    card_id: UUID
    version: int
    deleted: bool
    can_reply: bool
    pauses: list[PauseView]
    segments: list[OwnSegmentView]

    @classmethod
    def from_result(cls, own: OwnSeriesResult) -> "OwnSeriesView":
        series = own.result.series
        segments = []

        for segment in series.segments:
            participant = next(
                (part for part in segment.template.participants if part.card_id == own.card_id),
                None,
            )

            if participant is None:
                continue

            segments.append(
                OwnSegmentView(
                    id=segment.id,
                    effective_at=segment.effective_at,
                    until_at=segment.until_at,
                    recurrence=RuleView.from_rule(segment.rule),
                    title=segment.template.conditions.title,
                    subject=segment.template.conditions.subject,
                    delivery_format=segment.template.conditions.delivery_format,
                    group=GroupSnapshotView(
                        id=segment.template.group_id, name=segment.template.group_name
                    )
                    if segment.template.group_id and segment.template.group_name
                    else None,
                    price=Price(amount=participant.price.amount),
                    confirmation=ConfirmationView(
                        state=participant.effective_state(own.result.observed_at),
                        deadline=participant.deadline,
                        replied_at=participant.replied_at,
                    ),
                )
            )

        return cls(
            id=series.id,
            teacher_id=series.teacher_id,
            card_id=own.card_id,
            version=series.version,
            deleted=series.deleted,
            can_reply=own.can_reply,
            pauses=[
                PauseView(**asdict(pause))
                for pause in series.pauses
                if any(
                    (segment.until_at is None or pause.starts_at < segment.until_at)
                    and (pause.ends_at is None or pause.ends_at > segment.effective_at)
                    for segment in series.segments
                    if any(part.card_id == own.card_id for part in segment.template.participants)
                )
            ],
            segments=segments,
        )


class SeriesPage[T](BaseModel):
    items: list[T]
    next_after: UUID | None = None


class SeriesRevisionView(BaseModel):
    id: UUID
    actor_id: UUID
    happened_at: datetime
    kind: str
    series: SeriesView
