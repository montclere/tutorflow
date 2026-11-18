"""Межмодульная проверка прав на активную карточку."""

from enum import StrEnum
from typing import Protocol
from uuid import UUID


class StudentCardOperation(StrEnum):
    READ = "read"
    EDIT = "edit"


class StudentCardAccess(Protocol):
    async def allows_active_card_operation(
        self, actor_account_id: UUID, student_card_id: UUID, operation: StudentCardOperation
    ) -> bool: ...
