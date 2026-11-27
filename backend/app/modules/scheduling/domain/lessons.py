"""Агрегат занятия со снимком условий и независимыми ответами участников."""

from dataclasses import dataclass, replace
from datetime import date, datetime, timedelta
from enum import StrEnum
from uuid import UUID, uuid4

from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.values import (
    TITLE_MAX_LENGTH,
    LessonPrice,
    lesson_text,
    utc_start,
)


class ReplyState(StrEnum):
    NOT_REQUIRED = "not_required"
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"


@dataclass(frozen=True)
class LessonConditions:
    starts_at: datetime
    timezone: str
    duration_minutes: int
    title: str | None = None
    subject: str | None = None
    delivery_format: str | None = None
    private_notes: str | None = None

    def __post_init__(self) -> None:
        object.__setattr__(self, "starts_at", utc_start(self.starts_at, self.timezone))

        if self.duration_minutes < 1:
            raise LessonError("invalid_lesson_duration")

        try:
            end = self.starts_at + timedelta(minutes=self.duration_minutes)
        except OverflowError as error:
            raise LessonError("invalid_lesson_duration") from error

        if end <= self.starts_at:
            raise LessonError("invalid_lesson_duration")

        object.__setattr__(self, "title", lesson_text(self.title, TITLE_MAX_LENGTH))

        for name in ("subject", "delivery_format", "private_notes"):
            object.__setattr__(self, name, lesson_text(getattr(self, name)))

    @property
    def ends_at(self) -> datetime:
        return self.starts_at + timedelta(minutes=self.duration_minutes)


@dataclass(frozen=True)
class LessonParticipant:
    card_id: UUID
    name: str
    price: LessonPrice
    profile_id: UUID | None = None
    profile_subject: str | None = None
    state: ReplyState = ReplyState.NOT_REQUIRED
    deadline: datetime | None = None
    response_by: UUID | None = None
    replied_at: datetime | None = None
    cancelled: bool = False
    cancellation_reason: str | None = None

    def effective_state(self, now: datetime) -> ReplyState:
        if self.state is ReplyState.PENDING and self.deadline is not None and self.deadline <= now:
            return ReplyState.EXPIRED

        return self.state


@dataclass(frozen=True)
class Lesson:
    id: UUID
    teacher_id: UUID
    conditions: LessonConditions
    participants: tuple[LessonParticipant, ...]
    group_id: UUID | None = None
    group_name: str | None = None
    confirmation: bool = False
    version: int = 1
    deleted: bool = False
    series_id: UUID | None = None
    original_date: date | None = None
    cancelled: bool = False
    cancellation_reason: str | None = None

    def __post_init__(self) -> None:
        if (self.group_id is None) != (self.group_name is None):
            raise LessonError("invalid_lesson_data")

        if any(
            part.state is ReplyState.PENDING and part.deadline is None for part in self.participants
        ):
            raise LessonError("invalid_lesson_data")

        if not self.participants and self.group_id is None:
            raise LessonError("lesson_participants_required")

        if len({participant.card_id for participant in self.participants}) != len(
            self.participants
        ):
            raise LessonError("lesson_duplicate_participant")

    @classmethod
    def create(
        cls,
        teacher_id: UUID,
        conditions: LessonConditions,
        participants: tuple[LessonParticipant, ...],
        now: datetime,
        *,
        group_id: UUID | None = None,
        group_name: str | None = None,
        confirmation: bool = False,
    ) -> "Lesson":
        if conditions.starts_at <= now:
            raise LessonError("lesson_already_started")

        return cls(
            uuid4(), teacher_id, conditions, participants, group_id, group_name, confirmation
        )

    @property
    def collective(self) -> bool:
        return self.group_id is not None or len(self.participants) > 1

    def require_editable(self, now: datetime, expected_version: int) -> None:
        if self.deleted or self.version != expected_version:
            raise LessonError("lesson_conflict")

        if self.conditions.starts_at <= now:
            raise LessonError("lesson_already_started")

        if self.cancelled:
            raise LessonError("lesson_cancelled")

    def change_cancellation(
        self,
        cancelled: bool,
        reason: str | None,
        now: datetime,
        expected_version: int,
        card_id: UUID | None = None,
    ) -> "Lesson":
        if self.deleted or self.version != expected_version:
            raise LessonError("lesson_conflict")

        if self.conditions.starts_at <= now:
            raise LessonError("lesson_already_started")

        reason = lesson_text(reason) if cancelled else None

        if card_id is None:
            if self.cancelled is cancelled:
                return self

            return replace(
                self,
                cancelled=cancelled,
                cancellation_reason=reason,
                version=self.version + 1,
            )

        if self.cancelled:
            raise LessonError("lesson_cancelled")

        if not self.collective:
            raise LessonError("lesson_group_required")

        participant = next((part for part in self.participants if part.card_id == card_id), None)

        if participant is None:
            raise LessonError("lesson_not_found")

        if participant.cancelled is cancelled:
            return self

        return replace(
            self,
            participants=tuple(
                replace(part, cancelled=cancelled, cancellation_reason=reason)
                if part.card_id == card_id
                else part
                for part in self.participants
            ),
            version=self.version + 1,
        )

    def revise(
        self,
        conditions: LessonConditions,
        participants: tuple[LessonParticipant, ...],
        confirmation: bool,
        now: datetime,
        expected_version: int,
    ) -> "Lesson":
        self.require_editable(now, expected_version)

        if conditions.starts_at <= now:
            raise LessonError("lesson_already_started")

        return replace(
            self,
            conditions=conditions,
            participants=participants,
            confirmation=confirmation,
            version=self.version + 1,
        )

    def remove(self, now: datetime, expected_version: int) -> "Lesson":
        self.require_editable(now, expected_version)

        return replace(self, deleted=True, version=self.version + 1)

    def reply(
        self,
        card_id: UUID,
        answer: ReplyState,
        account_id: UUID,
        now: datetime,
        *,
        expected_version: int,
    ) -> "Lesson":
        self.require_editable(now, expected_version)

        if answer not in {ReplyState.ACCEPTED, ReplyState.DECLINED}:
            raise LessonError("invalid_lesson_reply")

        participant = next((item for item in self.participants if item.card_id == card_id), None)

        if participant is None:
            raise LessonError("lesson_not_found")

        if participant.cancelled:
            raise LessonError("lesson_cancelled")

        if participant.deadline is None or not self.confirmation:
            raise LessonError("lesson_reply_not_requested")

        if participant.deadline <= now:
            raise LessonError("lesson_reply_expired")

        if participant.state is answer and participant.response_by == account_id:
            return self

        changed = replace(participant, state=answer, response_by=account_id, replied_at=now)

        return replace(
            self,
            participants=tuple(
                changed if item.card_id == card_id else item for item in self.participants
            ),
        )
