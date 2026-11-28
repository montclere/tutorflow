"""Явное подключение преподавательского кабинета к существующему аккаунту."""

from collections.abc import Callable
from dataclasses import replace
from datetime import datetime
from uuid import UUID

from app.modules.identity.application.ports import IdentityUnitOfWork
from app.modules.identity.domain.entities import Account
from app.modules.identity.domain.exceptions import IdentityError
from app.modules.identity.domain.values import Role


class RoleService:
    def __init__(self, persistence: IdentityUnitOfWork, clock: Callable[[], datetime]) -> None:
        self.persistence = persistence
        self.clock = clock

    async def activate_teacher(self, account_id: UUID) -> Account:
        async with self.persistence.transaction() as repository:
            account = await repository.find_account_for_update(account_id)

            if account is None:
                raise IdentityError("authentication_required")

            account.require_role_activation(Role.TEACHER)
            await repository.add_role(account.id, Role.TEACHER, self.clock())

            return replace(account, roles=account.roles | {Role.TEACHER})
