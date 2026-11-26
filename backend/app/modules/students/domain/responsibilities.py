"""Единственное назначение полномочия подключённому аккаунту карточки."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


SCHEDULING_RESPONSIBILITY = "scheduling"


@dataclass(frozen=True)
class Responsibility:
    card_id: UUID
    account_id: UUID
    assigned_at: datetime
    category: str = SCHEDULING_RESPONSIBILITY

    @classmethod
    def initial(
        cls, card_id: UUID, account_id: UUID, assigned_at: datetime, participant_count: int
    ) -> "Responsibility | None":
        if participant_count != 1:
            return None

        return cls(card_id, account_id, assigned_at)
