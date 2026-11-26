"""Публичные проекции карточек для групп, занятий и согласования."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol
from uuid import UUID

from app.modules.identity.public import Actor, Role


@dataclass(frozen=True)
class CardReference:
    id: UUID
    teacher_id: UUID
    name: str
    archived: bool


class CardAccess(Protocol):
    async def find_owned(
        self, card_id: UUID, teacher_id: UUID, *, lock: bool
    ) -> CardReference | None: ...

    async def find_accessible(
        self, card_id: UUID, actor: Actor, *, include_archived: bool = False
    ) -> CardReference | None: ...

    async def names(self, card_ids: list[UUID]) -> dict[UUID, str]: ...


@dataclass(frozen=True)
class TeachingProfile:
    id: UUID
    card_id: UUID
    amount: Decimal
    subject: str | None


@dataclass(frozen=True)
class ConfirmationRecipient:
    connected: bool
    account_id: UUID | None
    role: Role | None


class LessonCards(CardAccess, Protocol):
    async def find_profile(self, card_id: UUID, profile_id: UUID) -> TeachingProfile | None: ...

    async def recipient(self, card_id: UUID) -> ConfirmationRecipient: ...
