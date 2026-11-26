"""Общая транзакция Groups с публичной проекцией карточек Students."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from app.integrations.cards import PostgresCardAccess
from app.modules.groups.application.ports import GroupTransaction
from app.modules.groups.infrastructure.persistence.repository import PostgresGroupsRepository


class PostgresGroupsUnitOfWork:
    def __init__(self, engine: AsyncEngine) -> None:
        self.sessions = async_sessionmaker(engine, expire_on_commit=False)

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[GroupTransaction]:
        async with self.sessions.begin() as db:
            yield GroupTransaction(PostgresGroupsRepository(db), PostgresCardAccess(db))
