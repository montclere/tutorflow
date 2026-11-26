"""Управление составом и персональной стоимостью под блокировками карточки и группы."""

from dataclasses import replace
from uuid import UUID

from app.modules.groups.application.contracts import MemberOverview
from app.modules.groups.application.ports import GroupsUnitOfWork
from app.modules.groups.application.services.access import (
    owned_group,
    require_page_size,
    require_teacher,
)
from app.modules.groups.domain.entities import Member
from app.modules.groups.domain.exceptions import GroupError
from app.modules.groups.domain.values import Price
from app.modules.identity.public import Actor


class MembershipService:
    def __init__(self, persistence: GroupsUnitOfWork) -> None:
        self.persistence = persistence

    async def add(
        self, actor: Actor, group_id: UUID, card_id: UUID, price: Price
    ) -> MemberOverview:
        require_teacher(actor)

        async with self.persistence.transaction() as unit:
            card = await unit.cards.find_owned(card_id, actor.account_id, lock=True)

            if card is None:
                raise GroupError("student_card_not_found")

            if card.archived:
                raise GroupError("student_card_archived")

            group = await owned_group(unit, actor, group_id)

            group.require_active()

            if await unit.groups.find_member(group.id, card.id) is not None:
                raise GroupError("group_member_exists")

            member = Member(group.id, actor.account_id, card.id, price)

            await unit.groups.add_member(member)

            return MemberOverview(member, card.name)

    async def update(self, actor: Actor, group_id: UUID, card_id: UUID, price: Price) -> Member:
        async with self.persistence.transaction() as unit:
            group = await owned_group(unit, actor, group_id)

            group.require_active()

            member = await unit.groups.find_member(group.id, card_id)

            if member is None:
                raise GroupError("group_member_not_found")

            member = replace(member, price=price)

            await unit.groups.save_member(member)

            return member

    async def remove(self, actor: Actor, group_id: UUID, card_id: UUID) -> None:
        async with self.persistence.transaction() as unit:
            group = await owned_group(unit, actor, group_id)

            group.require_active()

            await unit.groups.delete_member(group.id, card_id)

    async def list(
        self, actor: Actor, group_id: UUID, after_id: UUID | None, limit: int
    ) -> list[MemberOverview]:
        require_page_size(limit)

        async with self.persistence.transaction() as unit:
            group = await owned_group(unit, actor, group_id, lock=False)
            members = await unit.groups.list_members(group.id, after_id, limit + 1)
            names = await unit.cards.names([member.card_id for member in members])

            return [
                MemberOverview(member, names[member.card_id])
                for member in members
                if member.card_id in names
            ]
