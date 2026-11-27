"""Запрос ответственного на изменение собственного будущего участия в занятии."""

from dataclasses import dataclass, replace
from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import Lesson
from app.modules.scheduling.domain.values import lesson_text, utc_start


class ChangeKind(StrEnum):
    RESCHEDULE = "reschedule"
    CANCEL = "cancel"


class ChangeState(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"
    SUPERSEDED = "superseded"


@dataclass(frozen=True)
class LessonChangeRequest:
    id: UUID
    lesson_id: UUID
    card_id: UUID
    author_id: UUID
    lesson_version: int
    kind: ChangeKind
    reason: str | None
    proposed_start: datetime | None
    created_at: datetime
    state: ChangeState = ChangeState.PENDING
    decided_by: UUID | None = None
    decided_at: datetime | None = None

    @classmethod
    def create(
        cls,
        lesson: Lesson,
        card_id: UUID,
        author_id: UUID,
        kind: ChangeKind,
        reason: str | None,
        proposed_start: datetime | None,
        now: datetime,
        expected_version: int,
    ) -> "LessonChangeRequest":
        lesson.require_editable(now, expected_version)

        part = next((part for part in lesson.participants if part.card_id == card_id), None)

        if part is None:
            raise LessonError("lesson_not_found")

        if part.cancelled:
            raise LessonError("lesson_cancelled")

        if kind is ChangeKind.RESCHEDULE and lesson.collective:
            raise LessonError("group_reschedule_forbidden")

        if kind is ChangeKind.CANCEL and proposed_start is not None:
            raise LessonError("invalid_lesson_change_request")

        if proposed_start is not None:
            proposed_start = utc_start(proposed_start, lesson.conditions.timezone)

            if proposed_start <= now:
                raise LessonError("invalid_lesson_time")

        return cls(
            uuid4(),
            lesson.id,
            card_id,
            author_id,
            lesson.version,
            kind,
            lesson_text(reason),
            proposed_start,
            now,
        )

    def decide(self, state: ChangeState, actor_id: UUID, now: datetime) -> "LessonChangeRequest":
        if self.state is not ChangeState.PENDING:
            raise LessonError("lesson_change_request_conflict")

        if state not in {ChangeState.ACCEPTED, ChangeState.REJECTED, ChangeState.WITHDRAWN}:
            raise LessonError("invalid_lesson_change_request")

        return replace(self, state=state, decided_by=actor_id, decided_at=now)
