"""Сервис изменения собственного профиля Identity."""

from uuid import UUID

from app.modules.identity.application.ports import IdentityUnitOfWork
from app.modules.identity.domain.entities import Account
from app.modules.identity.domain.exceptions import IdentityError
from app.modules.identity.domain.values import ProfileChange


class ProfileService:
    def __init__(self, persistence: IdentityUnitOfWork) -> None:
        self.persistence = persistence

    async def update(self, account_id: UUID, change: ProfileChange) -> Account:
        async with self.persistence.transaction() as repository:
            account = await repository.update_profile(account_id, dict(change.fields))

            if account is None:
                raise IdentityError("authentication_required")

            return account
