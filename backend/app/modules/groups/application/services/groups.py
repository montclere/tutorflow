"""Транзакционные сценарии создания и жизненного цикла группы."""

from uuid import UUID

from app.modules.groups.application.contracts import GroupOverview
from app.modules.groups.application.ports import GroupsUnitOfWork
from app.modules.groups.application.services.access import (
    owned_group,
    require_page_size,
    require_teacher,
)
from app.modules.groups.domain.entities import Group
from app.modules.identity.public import Actor


class GroupService:
    def __init__(self, persistence: GroupsUnitOfWork) -> None:
        self.persistence = persistence

    async def create(self, actor: Actor, name: str, notes: str | None) -> GroupOverview:
        require_teacher(actor)

        group = Group.create(actor.account_id, name, notes)

        async with self.persistence.transaction() as unit:
            await unit.groups.add(group)

            return await unit.groups.overview(group)

    async def get(self, actor: Actor, group_id: UUID) -> GroupOverview:
        async with self.persistence.transaction() as unit:
            group = await owned_group(unit, actor, group_id, lock=False)

            return await unit.groups.overview(group)

    async def list(
        self, actor: Actor, archived: bool, after_id: UUID | None, limit: int
    ) -> list[GroupOverview]:
        require_teacher(actor)
        require_page_size(limit)

        async with self.persistence.transaction() as unit:
            return await unit.groups.list_groups(actor.account_id, archived, after_id, limit + 1)

    async def update(
        self, actor: Actor, group_id: UUID, fields: dict[str, str | None]
    ) -> GroupOverview:
        async with self.persistence.transaction() as unit:
            group = (await owned_group(unit, actor, group_id)).change(fields)

            await unit.groups.save(group)

            return await unit.groups.overview(group)

    async def archive(self, actor: Actor, group_id: UUID, archived: bool) -> GroupOverview:
        async with self.persistence.transaction() as unit:
            group = (await owned_group(unit, actor, group_id)).set_archived(archived)

            await unit.groups.save(group)

            return await unit.groups.overview(group)

    async def delete(self, actor: Actor, group_id: UUID) -> None:
        async with self.persistence.transaction() as unit:
            group = await owned_group(unit, actor, group_id)

            await unit.groups.delete(group.id)
