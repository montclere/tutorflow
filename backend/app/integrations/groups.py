"""Общая транзакция Groups с публичной проекцией карточек Students."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.modules.groups.application.ports import GroupTransaction
from app.modules.groups.infrastructure.persistence.repository import PostgresGroupsRepository
from app.modules.identity.public import Actor
from app.modules.students.infrastructure.persistence.models import Connection, StudentCard
from app.modules.students.infrastructure.persistence.repository import PostgresStudentsRepository
from app.modules.students.public import GroupCard


class PostgresGroupCards:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.students = PostgresStudentsRepository(db)

    async def find_owned(self, card_id: UUID, teacher_id: UUID, *, lock: bool) -> GroupCard | None:
        card = await self.students.find_card(card_id, teacher_id, lock=lock)

        return GroupCard(card.id, card.teacher_id, card.name, card.archived) if card else None

    async def find_accessible(self, card_id: UUID, actor: Actor) -> GroupCard | None:
        row = await self.db.scalar(
            select(StudentCard)
            .join(Connection, Connection.card_id == StudentCard.id)
            .where(
                StudentCard.id == card_id,
                StudentCard.archived.is_(False),
                Connection.account_id == actor.account_id,
                Connection.role == actor.role,
            )
        )

        return GroupCard(row.id, row.teacher_id, row.name, row.archived) if row else None

    async def names(self, card_ids: list[UUID]) -> dict[UUID, str]:
        if not card_ids:
            return {}

        rows = await self.db.execute(
            select(StudentCard.id, StudentCard.name).where(StudentCard.id.in_(card_ids))
        )

        return {card_id: name for card_id, name in rows}


class PostgresGroupsUnitOfWork:
    def __init__(self, engine: AsyncEngine) -> None:
        self.sessions = async_sessionmaker(engine, expire_on_commit=False)

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[GroupTransaction]:
        async with self.sessions.begin() as db:
            yield GroupTransaction(PostgresGroupsRepository(db), PostgresGroupCards(db))
