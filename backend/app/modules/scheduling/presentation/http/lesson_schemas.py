"""HTTP-команды и раздельные представления преподавателя и собственного участия."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.modules.scheduling.application.lesson_contracts import (
    LessonDraft,
    LessonPatch,
    LessonResult,
    OwnLesson,
    ParticipantDraft,
    PreferencesPatch,
    TeachingPreferences,
)
from app.modules.scheduling.domain.lessons import Lesson, LessonParticipant, ReplyState
from app.modules.scheduling.domain.values import (
    PRICE_QUANTUM,
    TEXT_MAX_LENGTH,
    TIMEZONE_MAX_LENGTH,
    TITLE_MAX_LENGTH,
    LessonPrice,
)


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Price(Input):
    amount: Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2, allow_inf_nan=False)]
    currency: Literal["RUB"] = "RUB"

    def to_price(self) -> LessonPrice:
        return LessonPrice(self.amount)


class ParticipantInput(Input):
    card_id: UUID
    profile_id: UUID | None = None
    price: Price | None = None

    def to_command(self) -> ParticipantDraft:
        return ParticipantDraft(
            self.card_id, self.profile_id, self.price.to_price() if self.price else None
        )


class TextInput(Input):
    title: Annotated[str | None, Field(max_length=TITLE_MAX_LENGTH)] = None
    subject: Annotated[str | None, Field(max_length=TEXT_MAX_LENGTH)] = None
    delivery_format: Annotated[str | None, Field(max_length=TEXT_MAX_LENGTH)] = None
    private_notes: Annotated[str | None, Field(max_length=TEXT_MAX_LENGTH)] = None


class LessonCreate(TextInput):
    starts_at: AwareDatetime
    timezone: Annotated[str | None, Field(min_length=1, max_length=TIMEZONE_MAX_LENGTH)] = None
    duration_minutes: Annotated[int | None, Field(ge=1)] = None
    participants: list[ParticipantInput] | None = None
    group_id: UUID | None = None
    confirmation: bool = False
    request_id: UUID | None = None

    def to_command(self) -> LessonDraft:
        return LessonDraft(
            self.starts_at,
            self.timezone,
            self.duration_minutes,
            tuple(item.to_command() for item in self.participants)
            if self.participants is not None
            else None,
            self.group_id,
            self.title,
            self.subject,
            self.delivery_format,
            self.private_notes,
            self.confirmation,
            self.request_id,
        )


class LessonUpdate(TextInput):
    expected_version: Annotated[int, Field(ge=1)]
    starts_at: AwareDatetime | None = None
    timezone: Annotated[str | None, Field(min_length=1, max_length=TIMEZONE_MAX_LENGTH)] = None
    duration_minutes: Annotated[int | None, Field(ge=1)] = None
    participants: list[ParticipantInput] | None = None
    confirmation: bool | None = None
    reset_confirmations: bool = False

    def to_command(self) -> LessonPatch:
        text_fields = {"title", "subject", "delivery_format", "private_notes"}
        changes = {key: getattr(self, key) for key in self.model_fields_set & text_fields}

        return LessonPatch(
            self.expected_version,
            self.starts_at,
            self.timezone,
            self.duration_minutes,
            tuple(item.to_command() for item in self.participants)
            if self.participants is not None
            else None,
            changes,
            self.confirmation,
            self.reset_confirmations,
        )


class PreferencesInput(Input):
    default_price: Price | None = None
    duration_minutes: Annotated[int | None, Field(ge=1)] = None

    def to_command(self) -> PreferencesPatch:
        fields = frozenset(
            "price" if key == "default_price" else key for key in self.model_fields_set
        )

        return PreferencesPatch(
            self.default_price.to_price() if self.default_price else None,
            self.duration_minutes,
            fields,
        )


class PreferencesView(BaseModel):
    default_price: Price | None
    duration_minutes: int

    @classmethod
    def from_preferences(
        cls, preferences: TeachingPreferences, default_duration: int
    ) -> "PreferencesView":
        return cls(
            default_price=Price(amount=preferences.price.amount) if preferences.price else None,
            duration_minutes=preferences.duration_minutes
            if preferences.duration_minutes is not None
            else default_duration,
        )


class ReplyInput(Input):
    expected_version: Annotated[int, Field(ge=1)]
    answer: Literal["accepted", "declined"]


class GroupSnapshotView(BaseModel):
    id: UUID
    name: str


class ConfirmationView(BaseModel):
    state: ReplyState
    deadline: datetime | None
    replied_at: datetime | None


class TeacherConfirmationView(ConfirmationView):
    response_by: UUID | None


class ParticipantView(BaseModel):
    card_id: UUID
    name: str
    price: Price
    profile_id: UUID | None
    profile_subject: str | None
    confirmation: TeacherConfirmationView

    @classmethod
    def from_participant(cls, part: LessonParticipant, now: datetime) -> "ParticipantView":
        return cls(
            card_id=part.card_id,
            name=part.name,
            price=Price(amount=part.price.amount),
            profile_id=part.profile_id,
            profile_subject=part.profile_subject,
            confirmation=TeacherConfirmationView(
                state=part.effective_state(now),
                deadline=part.deadline,
                replied_at=part.replied_at,
                response_by=part.response_by,
            ),
        )


class LessonDetails(BaseModel):
    id: UUID
    teacher_id: UUID
    starts_at: datetime
    timezone: str
    duration_minutes: int
    title: str | None
    subject: str | None
    delivery_format: str | None
    group: GroupSnapshotView | None
    version: int


def common_fields(lesson: Lesson) -> dict[str, object]:
    conditions = lesson.conditions

    return dict(
        id=lesson.id,
        teacher_id=lesson.teacher_id,
        starts_at=conditions.starts_at,
        timezone=conditions.timezone,
        duration_minutes=conditions.duration_minutes,
        title=conditions.title,
        subject=conditions.subject,
        delivery_format=conditions.delivery_format,
        group=GroupSnapshotView(id=lesson.group_id, name=lesson.group_name)
        if lesson.group_id and lesson.group_name
        else None,
        version=lesson.version,
    )


class TotalPrice(BaseModel):
    amount: Decimal
    currency: Literal["RUB"] = "RUB"


class LessonView(LessonDetails):
    private_notes: str | None
    confirmation: bool
    participants: list[ParticipantView]
    total_price: TotalPrice
    deleted: bool

    @classmethod
    def from_lesson(cls, lesson: Lesson, now: datetime) -> "LessonView":
        total = sum((part.price.amount for part in lesson.participants), Decimal("0.00"))

        return cls.model_validate(
            common_fields(lesson)
            | dict(
                private_notes=lesson.conditions.private_notes,
                confirmation=lesson.confirmation,
                participants=[
                    ParticipantView.from_participant(part, now) for part in lesson.participants
                ],
                total_price=TotalPrice(amount=total.quantize(PRICE_QUANTUM)),
                deleted=lesson.deleted,
            )
        )


class WarningView(BaseModel):
    code: str
    event_id: UUID


class LessonOperationView(LessonView):
    warnings: list[WarningView]
    more_warnings: bool

    @classmethod
    def from_result(cls, result: LessonResult) -> "LessonOperationView":
        base = LessonView.from_lesson(result.lesson, result.observed_at)

        return cls.model_validate(
            base.model_dump()
            | dict(
                warnings=[
                    WarningView(code=warning.code, event_id=warning.event_id)
                    for warning in result.warnings
                ],
                more_warnings=result.more_warnings,
            )
        )


class OwnLessonView(LessonDetails):
    card_id: UUID
    price: Price
    profile_subject: str | None
    confirmation: ConfirmationView
    can_reply: bool

    @classmethod
    def from_result(cls, result: OwnLesson) -> "OwnLessonView":
        part = next(item for item in result.lesson.participants if item.card_id == result.card_id)

        return cls.model_validate(
            common_fields(result.lesson)
            | dict(
                card_id=result.card_id,
                price=Price(amount=part.price.amount),
                profile_subject=part.profile_subject,
                confirmation=ConfirmationView(
                    state=part.effective_state(result.now),
                    deadline=part.deadline,
                    replied_at=part.replied_at,
                ),
                can_reply=result.can_reply,
            )
        )


class CursorView(BaseModel):
    starts_at: datetime
    id: UUID


class LessonPage[T](BaseModel):
    items: list[T]
    next_after: CursorView | None = None


class RevisionView(BaseModel):
    id: UUID
    actor_id: UUID
    happened_at: datetime
    kind: str
    lesson: LessonView


class HistoryPage(BaseModel):
    items: list[RevisionView]
    next_after: UUID | None = None
