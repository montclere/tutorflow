from datetime import timedelta
from math import ceil

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.schema import Table

from app.shared.application.ports.clock import now_utc
from app.shared.application.security import keyed_digest
from app.shared.domain.errors import Problem, ProblemCode

from .db.base import metadata

rate_limits = Table(
    "rate_limits",
    metadata,
    Column("key_digest", String(64), primary_key=True),
    Column("window_start", DateTime(timezone=True), primary_key=True),
    Column("expires_at", DateTime(timezone=True), nullable=False, index=True),
    Column("attempts", Integer, nullable=False),
)


class PostgresRateLimiter:
    def __init__(self, sessions: async_sessionmaker[AsyncSession], key: str):
        self.sessions = sessions
        self.key = key

    async def __call__(self, action: str, subject: str, limit: int, seconds: int) -> None:
        now = now_utc()
        start = now.replace(microsecond=0) - timedelta(seconds=int(now.timestamp()) % seconds)
        expires = start + timedelta(seconds=seconds)
        async with self.sessions.begin() as db:
            statement = insert(rate_limits).values(
                key_digest=keyed_digest(self.key, "rate", action, subject),
                window_start=start,
                expires_at=expires,
                attempts=1,
            )
            result = await db.execute(
                statement.on_conflict_do_update(
                    index_elements=[rate_limits.c.key_digest, rate_limits.c.window_start],
                    set_={"attempts": rate_limits.c.attempts + 1},
                    where=rate_limits.c.attempts < limit,
                ).returning(rate_limits.c.attempts)
            )
            allowed = result.scalar_one_or_none()
        if allowed is None:
            raise Problem(
                ProblemCode.RATE_LIMITED,
                retry_after=max(1, ceil((expires - now_utc()).total_seconds())),
            )
