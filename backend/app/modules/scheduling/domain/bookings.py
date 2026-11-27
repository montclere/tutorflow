"""Временный резерв и решение о записи без автоматического финансового действия."""

from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from enum import StrEnum
from uuid import UUID, uuid4

from app.modules.scheduling.domain.availability import AvailabilityPublication
from app.modules.scheduling.domain.exceptions import LessonError


class BookingState(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"
    EXPIRED = "expired"
    INVALIDATED = "invalidated"


@dataclass(frozen=True)
class Booking:
    id: UUID
    request_id: UUID
    publication_id: UUID
    publication_version: int
    teacher_id: UUID
    card_id: UUID
    actor_id: UUID
    starts_at: datetime
    ends_at: datetime
    break_minutes: int
    created_at: datetime
    expires_at: datetime
    state: BookingState = BookingState.PENDING
    lesson_id: UUID | None = None
    decided_by: UUID | None = None
    decided_at: datetime | None = None

    @classmethod
    def create(
        cls,
        request_id: UUID,
        publication: AvailabilityPublication,
        card_id: UUID,
        actor_id: UUID,
        start: datetime,
        now: datetime,
        lifetime: timedelta,
    ) -> "Booking":
        if start <= now:
            raise LessonError("availability_conflict")

        return cls(
            uuid4(),
            request_id,
            publication.id,
            publication.version,
            publication.teacher_id,
            card_id,
            actor_id,
            start,
            start + timedelta(minutes=publication.duration_minutes),
            publication.break_minutes,
            now,
            min(now + lifetime, start),
        )

    def decide(
        self, state: BookingState, actor_id: UUID, now: datetime, lesson_id: UUID | None = None
    ) -> "Booking":
        if self.state is not BookingState.PENDING or self.expires_at <= now:
            raise LessonError("booking_conflict")

        if state not in {BookingState.ACCEPTED, BookingState.REJECTED, BookingState.WITHDRAWN}:
            raise LessonError("invalid_availability")

        if (state is BookingState.ACCEPTED) != (lesson_id is not None):
            raise LessonError("invalid_availability")

        return replace(self, state=state, lesson_id=lesson_id, decided_by=actor_id, decided_at=now)
