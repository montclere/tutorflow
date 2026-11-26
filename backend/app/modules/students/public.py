"""Минимальные сведения и доступ к карточкам для группового обучения."""

from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from app.modules.identity.public import Actor


@dataclass(frozen=True)
class GroupCard:
    id: UUID
    teacher_id: UUID
    name: str
    archived: bool


class GroupCards(Protocol):
    async def find_owned(
        self, card_id: UUID, teacher_id: UUID, *, lock: bool
    ) -> GroupCard | None: ...

    async def find_accessible(self, card_id: UUID, actor: Actor) -> GroupCard | None: ...

    async def names(self, card_ids: list[UUID]) -> dict[UUID, str]: ...
