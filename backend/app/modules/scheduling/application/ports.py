"""Контракт хранилища личных блоков для календарных сценариев."""

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from app.modules.scheduling.domain.calendar import CalendarBlock


@dataclass(frozen=True)
class BlockCursor:
    starts_at: datetime
    id: UUID


class CalendarRepository(Protocol):
    async def add(
        self, block: CalendarBlock, *, request_fingerprint: str | None
    ) -> CalendarBlock | None: ...

    async def replace(self, block: CalendarBlock) -> bool: ...

    async def remove(self, owner_id: UUID, block_id: UUID) -> None: ...

    async def for_owner(
        self, owner_id: UUID, *, limit: int, after: BlockCursor | None
    ) -> list[CalendarBlock]: ...
