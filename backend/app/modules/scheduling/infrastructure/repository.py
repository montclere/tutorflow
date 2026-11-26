"""PostgreSQL-адаптер личного календаря."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, func, select, tuple_, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from app.modules.scheduling.application.ports import BlockCursor
from app.modules.scheduling.domain.calendar import CalendarBlock
from app.modules.scheduling.infrastructure.calendar_lock import lock_calendar
from app.modules.scheduling.infrastructure.models import BlockRequest
from app.modules.scheduling.infrastructure.models import CalendarBlock as CalendarBlockRow


def to_block(row: CalendarBlockRow) -> CalendarBlock:
    return CalendarBlock(row.id, row.owner_id, row.starts_at, row.timezone, row.duration_minutes)


class PostgresCalendarRepository:
    def __init__(self, engine: AsyncEngine):
        self.sessions = async_sessionmaker(engine, expire_on_commit=False)

    async def add(
        self, block: CalendarBlock, *, request_fingerprint: str | None
    ) -> CalendarBlock | None:
        async with self.sessions.begin() as db:
            await lock_calendar(db, block.owner_id)

            if request_fingerprint is not None:
                claim = (
                    insert(BlockRequest)
                    .values(id=block.id, owner_id=block.owner_id, fingerprint=request_fingerprint)
                    .on_conflict_do_nothing(index_elements=[BlockRequest.id])
                    .returning(BlockRequest.id)
                )

                if await db.scalar(claim) is None:
                    replay = (
                        select(CalendarBlockRow)
                        .join(BlockRequest, BlockRequest.id == CalendarBlockRow.id)
                        .where(
                            BlockRequest.id == block.id,
                            BlockRequest.owner_id == block.owner_id,
                            BlockRequest.fingerprint == request_fingerprint,
                            BlockRequest.expires_at > func.now(),
                            CalendarBlockRow.owner_id == block.owner_id,
                        )
                    )
                    row = await db.scalar(replay)

                    return to_block(row) if row is not None else None

            statement = (
                insert(CalendarBlockRow)
                .values(
                    id=block.id,
                    owner_id=block.owner_id,
                    starts_at=block.starts_at,
                    timezone=block.timezone,
                    duration_minutes=block.duration_minutes,
                )
                .on_conflict_do_nothing(index_elements=[CalendarBlockRow.id])
                .returning(CalendarBlockRow.id)
            )

            if await db.scalar(statement) is None:
                await db.rollback()

                return None

            return block

    async def replace(self, block: CalendarBlock) -> bool:
        async with self.sessions.begin() as db:
            await lock_calendar(db, block.owner_id)

            statement = (
                update(CalendarBlockRow)
                .where(CalendarBlockRow.id == block.id, CalendarBlockRow.owner_id == block.owner_id)
                .values(
                    starts_at=block.starts_at,
                    timezone=block.timezone,
                    duration_minutes=block.duration_minutes,
                )
                .returning(CalendarBlockRow.id)
            )

            return await db.scalar(statement) is not None

    async def remove(self, owner_id: UUID, block_id: UUID) -> None:
        async with self.sessions.begin() as db:
            await lock_calendar(db, owner_id)

            await db.execute(
                delete(CalendarBlockRow).where(
                    CalendarBlockRow.id == block_id, CalendarBlockRow.owner_id == owner_id
                )
            )

    async def for_owner(
        self, owner_id: UUID, *, limit: int, after: BlockCursor | None
    ) -> list[CalendarBlock]:
        async with self.sessions() as db:
            query = (
                select(CalendarBlockRow)
                .where(CalendarBlockRow.owner_id == owner_id)
                .order_by(CalendarBlockRow.starts_at, CalendarBlockRow.id)
                .limit(limit)
            )

            if after is not None:
                query = query.where(
                    tuple_(CalendarBlockRow.starts_at, CalendarBlockRow.id)
                    > (after.starts_at, after.id)
                )

            return [to_block(row) for row in await db.scalars(query)]

    async def purge_expired_requests(self, now: datetime, *, limit: int = 1000) -> int:
        expired = (
            select(BlockRequest.id)
            .where(BlockRequest.expires_at <= now)
            .order_by(BlockRequest.expires_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )

        async with self.sessions.begin() as db:
            return len(
                (
                    await db.scalars(
                        delete(BlockRequest)
                        .where(BlockRequest.id.in_(expired))
                        .returning(BlockRequest.id)
                    )
                ).all()
            )
