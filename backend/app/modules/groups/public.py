"""Участник общей транзакции прекращения членства архивируемой карточки."""

from typing import Protocol
from uuid import UUID


class GroupMemberships(Protocol):
    async def remove_card(self, card_id: UUID) -> None: ...
