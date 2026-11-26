"""Проверки преподавательского контекста, владения и границ выборки групп."""

from uuid import UUID

from app.modules.groups.application.contracts import PAGE_MAX_SIZE
from app.modules.groups.application.ports import GroupTransaction
from app.modules.groups.domain.entities import Group
from app.modules.groups.domain.exceptions import GroupError
from app.modules.identity.public import Actor, Role


def require_teacher(actor: Actor) -> None:
    if actor.role is not Role.TEACHER:
        raise GroupError("teacher_required")


def require_page_size(limit: int) -> None:
    if not 1 <= limit <= PAGE_MAX_SIZE:
        raise GroupError("invalid_group_data")


async def owned_group(
    unit: GroupTransaction, actor: Actor, group_id: UUID, *, lock: bool = True
) -> Group:
    require_teacher(actor)

    group = await unit.groups.find(group_id, actor.account_id, lock=lock)

    if group is None:
        raise GroupError("group_not_found")

    return group
