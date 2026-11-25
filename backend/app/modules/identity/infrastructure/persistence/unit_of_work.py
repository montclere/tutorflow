"""Транзакции PostgreSQL для прикладных сценариев Identity."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from app.modules.identity.infrastructure.persistence.repository import PostgresIdentityRepository


class PostgresIdentityUnitOfWork:
    def __init__(self, engine: AsyncEngine) -> None:
        self.sessions = async_sessionmaker(engine, expire_on_commit=False)

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[PostgresIdentityRepository]:
        async with self.sessions.begin() as db:
            yield PostgresIdentityRepository(db)
