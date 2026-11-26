"""Транзакционная сериализация изменений календаря одного преподавателя."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


CALENDAR_LOCK_NAMESPACE = "tutorflow:scheduling:"


async def lock_calendar(db: AsyncSession, teacher_id: UUID) -> None:
    key = CALENDAR_LOCK_NAMESPACE + str(teacher_id)

    await db.execute(select(func.pg_advisory_xact_lock(func.hashtextextended(key, 0))))
