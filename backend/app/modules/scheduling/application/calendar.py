"""Управление личными блоками преподавателя."""

from datetime import datetime
from hashlib import sha256
from uuid import UUID

from app.modules.identity.public import Actor, Role
from app.modules.scheduling.application.ports import BlockCursor, CalendarRepository
from app.modules.scheduling.domain.calendar import CalendarBlock, CalendarError


class Calendar:
    def __init__(self, repository: CalendarRepository):
        self.repository = repository

    async def create(
        self, actor: Actor, local_start: datetime, duration_minutes: int, request_id: UUID | None
    ) -> CalendarBlock:
        self._require_teacher(actor)

        block = CalendarBlock.create(
            actor.account_id, local_start, actor.timezone, duration_minutes, block_id=request_id
        )
        fingerprint = None

        if request_id is not None:
            payload = f"{local_start.isoformat()}:{duration_minutes}".encode()
            fingerprint = sha256(payload).hexdigest()

        saved = await self.repository.add(block, request_fingerprint=fingerprint)

        if saved is None:
            raise CalendarError("calendar_block_conflict")

        return saved

    async def replace(
        self, actor: Actor, block_id: UUID, local_start: datetime, duration_minutes: int
    ) -> CalendarBlock:
        self._require_teacher(actor)

        block = CalendarBlock.create(
            actor.account_id, local_start, actor.timezone, duration_minutes, block_id=block_id
        )

        if not await self.repository.replace(block):
            raise CalendarError("calendar_block_not_found")

        return block

    async def remove(self, actor: Actor, block_id: UUID) -> None:
        self._require_teacher(actor)
        await self.repository.remove(actor.account_id, block_id)

    async def list(
        self, actor: Actor, *, limit: int, after: BlockCursor | None
    ) -> list[CalendarBlock]:
        self._require_teacher(actor)

        return await self.repository.for_owner(actor.account_id, limit=limit, after=after)

    @staticmethod
    def _require_teacher(actor: Actor) -> None:
        if actor.role != Role.TEACHER:
            raise CalendarError("teacher_required")
