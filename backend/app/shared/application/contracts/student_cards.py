"""Межмодульная проверка прав на активную карточку."""

from dataclasses import dataclass
from enum import StrEnum
from typing import Literal, Protocol
from uuid import UUID

from .accounts import AccountSummary


class StudentCardOperation(StrEnum):
    READ = "read"
    EDIT = "edit"


class StudentCardAccess(Protocol):
    async def allows_active_card_operation(
        self, actor_account_id: UUID, student_card_id: UUID, operation: StudentCardOperation
    ) -> bool: ...


LessonRole = Literal["teacher", "student", "parent"]


@dataclass(frozen=True)
class LessonCard:
    card_id: UUID
    teacher_id: UUID
    student_id: UUID | None
    parent_ids: tuple[UUID, ...]
    active: bool
    parent_grants: tuple[tuple[UUID, UUID], ...] = ()

    def grant_for(self, account_id: UUID) -> str | None:
        return next(
            (str(grant) for parent, grant in self.parent_grants if parent == account_id), None
        )

    def participants(self) -> tuple[UUID, ...]:
        student = (self.student_id,) if self.student_id else ()
        return (self.teacher_id, *student, *self.parent_ids)


class LessonCards(Protocol):
    async def lesson_card(
        self, actor: AccountSummary, card_id: UUID, role: LessonRole, *, lock: bool = False
    ) -> LessonCard: ...

    async def lesson_cards(self, actor: AccountSummary, role: LessonRole) -> list[LessonCard]: ...


class OpenLessons(Protocol):
    async def has_open_lessons(self, card_id: UUID) -> bool: ...
