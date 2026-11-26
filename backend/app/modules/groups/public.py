"""Участник общей транзакции прекращения членства архивируемой карточки."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol
from uuid import UUID


class GroupMemberships(Protocol):
    async def remove_card(self, card_id: UUID) -> None: ...


@dataclass(frozen=True)
class LessonGroup:
    id: UUID
    teacher_id: UUID
    name: str
    archived: bool


@dataclass(frozen=True)
class LessonGroupMember:
    card_id: UUID
    amount: Decimal


class LessonGroups(Protocol):
    async def find(self, group_id: UUID, teacher_id: UUID, *, lock: bool) -> LessonGroup | None: ...

    async def members(self, group_id: UUID, limit: int) -> tuple[LessonGroupMember, ...]: ...

    async def prices(self, group_id: UUID, card_ids: tuple[UUID, ...]) -> dict[UUID, Decimal]: ...
