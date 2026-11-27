"""Общая транзакция Scheduling с публичными проекциями карточек и групп."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.integrations.cards import PostgresCardAccess
from app.modules.groups.infrastructure.persistence.models import Membership
from app.modules.groups.infrastructure.persistence.repository import PostgresGroupsRepository
from app.modules.groups.public import LessonGroup, LessonGroupMember
from app.modules.identity.public import Role
from app.modules.scheduling.application.lesson_ports import LessonTransaction
from app.modules.scheduling.application.series_ports import SeriesTransaction
from app.modules.scheduling.infrastructure.persistence.change_requests import PostgresChangeRequests
from app.modules.scheduling.infrastructure.persistence.lesson_repository import (
    PostgresLessonsRepository,
)
from app.modules.scheduling.infrastructure.persistence.series_repository import (
    PostgresSeriesRepository,
)
from app.modules.students.domain.responsibilities import SCHEDULING_RESPONSIBILITY
from app.modules.students.infrastructure.persistence.models import CardResponsibility, Connection
from app.modules.students.public import ConfirmationRecipient, TeachingProfile


class PostgresLessonCards(PostgresCardAccess):
    async def find_profile(self, card_id: UUID, profile_id: UUID) -> TeachingProfile | None:
        profile = await self.students.find_profile(card_id, profile_id)

        return (
            TeachingProfile(profile.id, profile.card_id, profile.price.amount, profile.subject)
            if profile
            else None
        )

    async def recipient(self, card_id: UUID) -> ConfirmationRecipient:
        rows = (
            await self.db.execute(
                select(Connection.account_id, Connection.role, CardResponsibility.account_id)
                .outerjoin(
                    CardResponsibility,
                    (CardResponsibility.card_id == Connection.card_id)
                    & (CardResponsibility.account_id == Connection.account_id)
                    & (CardResponsibility.category == SCHEDULING_RESPONSIBILITY),
                )
                .where(Connection.card_id == card_id)
            )
        ).all()
        responsible = next((row for row in rows if row[2] is not None), None)

        return ConfirmationRecipient(
            bool(rows),
            responsible[0] if responsible else None,
            Role(responsible[1]) if responsible else None,
        )


class PostgresLessonGroups:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.groups = PostgresGroupsRepository(db)

    async def find(self, group_id: UUID, teacher_id: UUID, *, lock: bool) -> LessonGroup | None:
        group = await self.groups.find(group_id, teacher_id, lock=lock)

        return (
            LessonGroup(group.id, group.teacher_id, group.name, group.archived) if group else None
        )

    async def members(self, group_id: UUID, limit: int) -> tuple[LessonGroupMember, ...]:
        members = await self.groups.list_members(group_id, None, limit)

        return tuple(LessonGroupMember(member.card_id, member.price.amount) for member in members)

    async def prices(self, group_id: UUID, card_ids: tuple[UUID, ...]) -> dict[UUID, Decimal]:
        if not card_ids:
            return {}

        rows = await self.db.execute(
            select(Membership.card_id, Membership.amount).where(
                Membership.group_id == group_id, Membership.card_id.in_(card_ids)
            )
        )

        return {card_id: amount for card_id, amount in rows}


class PostgresLessonsUnitOfWork:
    def __init__(self, engine: AsyncEngine) -> None:
        self.sessions = async_sessionmaker(engine, expire_on_commit=False)

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[LessonTransaction]:
        async with self.sessions.begin() as db:
            yield LessonTransaction(
                PostgresLessonsRepository(db),
                PostgresLessonCards(db),
                PostgresLessonGroups(db),
                PostgresChangeRequests(db),
            )


class PostgresSeriesUnitOfWork:
    def __init__(self, engine: AsyncEngine) -> None:
        self.sessions = async_sessionmaker(engine, expire_on_commit=False)

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[SeriesTransaction]:
        async with self.sessions.begin() as db:
            yield SeriesTransaction(
                PostgresLessonsRepository(db),
                PostgresLessonCards(db),
                PostgresLessonGroups(db),
                PostgresChangeRequests(db),
                PostgresSeriesRepository(db),
            )
