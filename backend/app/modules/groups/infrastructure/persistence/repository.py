"""PostgreSQL-операции собственного агрегата группы без управления commit."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.groups.application.contracts import GroupOverview, Participation
from app.modules.groups.domain.entities import Group, Member
from app.modules.groups.domain.values import Price
from app.modules.groups.infrastructure.persistence.models import Group as GroupRow
from app.modules.groups.infrastructure.persistence.models import Membership


def group_value(row: GroupRow) -> Group:
    return Group(row.id, row.teacher_id, row.name, row.notes, row.archived)


def member_value(row: Membership) -> Member:
    return Member(row.group_id, row.teacher_id, row.card_id, Price(row.amount))


def participation_value(group: GroupRow, member: Membership) -> Participation:
    return Participation(
        group.id, group.teacher_id, group.name, group.archived, member.card_id, member.amount
    )


class PostgresGroupsRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def add(self, group: Group) -> None:
        self.db.add(
            GroupRow(
                id=group.id,
                teacher_id=group.teacher_id,
                name=group.name,
                notes=group.notes,
                archived=group.archived,
            )
        )
        await self.db.flush()

    async def find(self, group_id: UUID, teacher_id: UUID, *, lock: bool) -> Group | None:
        query = (
            select(GroupRow)
            .where(GroupRow.id == group_id, GroupRow.teacher_id == teacher_id)
            .execution_options(populate_existing=True)
        )

        if lock:
            query = query.with_for_update()

        row = await self.db.scalar(query)

        return group_value(row) if row else None

    async def save(self, group: Group) -> None:
        await self.db.execute(
            update(GroupRow)
            .where(GroupRow.id == group.id)
            .values(name=group.name, notes=group.notes, archived=group.archived)
        )

    async def delete(self, group_id: UUID) -> None:
        await self.db.execute(delete(GroupRow).where(GroupRow.id == group_id))

    async def overview(self, group: Group) -> GroupOverview:
        total = await self.db.scalar(
            select(func.sum(Membership.amount)).where(Membership.group_id == group.id)
        )

        return GroupOverview(group, total if total is not None else Decimal("0.00"))

    async def list_groups(
        self, teacher_id: UUID, archived: bool, after_id: UUID | None, limit: int
    ) -> list[GroupOverview]:
        query = (
            select(GroupRow, func.coalesce(func.sum(Membership.amount), 0))
            .outerjoin(Membership, Membership.group_id == GroupRow.id)
            .where(GroupRow.teacher_id == teacher_id)
        )

        if not archived:
            query = query.where(GroupRow.archived.is_(False))

        if after_id is not None:
            query = query.where(GroupRow.id > after_id)

        rows = await self.db.execute(query.group_by(GroupRow.id).order_by(GroupRow.id).limit(limit))

        return [GroupOverview(group_value(row), amount) for row, amount in rows]

    async def find_member(self, group_id: UUID, card_id: UUID) -> Member | None:
        row = await self.db.get(Membership, (group_id, card_id))

        return member_value(row) if row else None

    async def add_member(self, member: Member) -> None:
        self.db.add(
            Membership(
                group_id=member.group_id,
                card_id=member.card_id,
                teacher_id=member.teacher_id,
                amount=member.price.amount,
            )
        )
        await self.db.flush()

    async def save_member(self, member: Member) -> None:
        await self.db.execute(
            update(Membership)
            .where(Membership.group_id == member.group_id, Membership.card_id == member.card_id)
            .values(amount=member.price.amount)
        )

    async def delete_member(self, group_id: UUID, card_id: UUID) -> None:
        await self.db.execute(
            delete(Membership).where(Membership.group_id == group_id, Membership.card_id == card_id)
        )

    async def remove_card(self, card_id: UUID) -> None:
        await self.db.execute(delete(Membership).where(Membership.card_id == card_id))

    async def list_members(self, group_id: UUID, after_id: UUID | None, limit: int) -> list[Member]:
        query = select(Membership).where(Membership.group_id == group_id)

        if after_id is not None:
            query = query.where(Membership.card_id > after_id)

        rows = await self.db.scalars(query.order_by(Membership.card_id).limit(limit))

        return [member_value(row) for row in rows]

    async def participations(
        self, card_id: UUID, after_id: UUID | None, limit: int
    ) -> list[Participation]:
        query = (
            select(GroupRow, Membership)
            .join(Membership, Membership.group_id == GroupRow.id)
            .where(Membership.card_id == card_id)
        )

        if after_id is not None:
            query = query.where(GroupRow.id > after_id)

        rows = await self.db.execute(query.order_by(GroupRow.id).limit(limit))

        return [participation_value(group, member) for group, member in rows]

    async def find_participation(self, card_id: UUID, group_id: UUID) -> Participation | None:
        row = (
            await self.db.execute(
                select(GroupRow, Membership)
                .join(Membership, Membership.group_id == GroupRow.id)
                .where(Membership.card_id == card_id, GroupRow.id == group_id)
            )
        ).one_or_none()

        return participation_value(row[0], row[1]) if row else None
