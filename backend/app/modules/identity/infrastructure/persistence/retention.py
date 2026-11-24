"""Пакетная очистка просроченных служебных записей Identity."""

from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from app.modules.identity.application.contracts import PurgedIdentityRecords
from app.modules.identity.infrastructure.persistence.models import (
    LoginSession,
    RateWindow,
    Registration,
)


class IdentityRetention:
    def __init__(self, engine: AsyncEngine) -> None:
        self.sessions = async_sessionmaker(engine, expire_on_commit=False)

    async def purge_expired(self, now: datetime, *, limit: int = 1000) -> PurgedIdentityRecords:
        if limit < 1:
            raise ValueError("Размер пакета должен быть положительным")

        async with self.sessions.begin() as db:
            registrations = (
                select(Registration.id)
                .where(Registration.expires_at <= now)
                .order_by(Registration.expires_at)
                .limit(limit)
                .with_for_update(skip_locked=True)
            )
            sessions = (
                select(LoginSession.token_digest)
                .where(LoginSession.expires_at <= now)
                .order_by(LoginSession.expires_at)
                .limit(limit)
                .with_for_update(skip_locked=True)
            )
            rate_windows = (
                select(RateWindow.key)
                .where(RateWindow.reset_at <= now)
                .order_by(RateWindow.reset_at)
                .limit(limit)
                .with_for_update(skip_locked=True)
            )
            removed_registrations = (
                await db.scalars(
                    delete(Registration)
                    .where(Registration.id.in_(registrations))
                    .returning(Registration.id)
                )
            ).all()
            removed_sessions = (
                await db.scalars(
                    delete(LoginSession)
                    .where(LoginSession.token_digest.in_(sessions))
                    .returning(LoginSession.token_digest)
                )
            ).all()
            removed_rate_windows = (
                await db.scalars(
                    delete(RateWindow)
                    .where(RateWindow.key.in_(rate_windows))
                    .returning(RateWindow.key)
                )
            ).all()

            return PurgedIdentityRecords(
                len(removed_registrations), len(removed_sessions), len(removed_rate_windows)
            )
