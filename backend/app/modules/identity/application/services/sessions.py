"""Сервис создания, проверки и отзыва сессий Identity."""

from collections.abc import Callable
from datetime import datetime

from app.modules.identity.application.contracts import SignedIn
from app.modules.identity.application.ports import (
    IdentityRepository,
    IdentityTokens,
    IdentityUnitOfWork,
)
from app.modules.identity.domain.entities import Account, Session
from app.modules.identity.domain.exceptions import IdentityError
from app.modules.identity.domain.policies import IdentityPolicy


class SessionService:
    def __init__(
        self,
        persistence: IdentityUnitOfWork,
        security: IdentityTokens,
        policy: IdentityPolicy,
        clock: Callable[[], datetime],
    ) -> None:
        self.persistence = persistence
        self.security = security
        self.policy = policy
        self.clock = clock

    async def create(
        self,
        repository: IdentityRepository,
        account: Account,
        previous_token: str | None,
        now: datetime,
    ) -> SignedIn:
        if previous_token:
            await repository.remove_session(self.security.session_digest(previous_token))

        token = self.security.new_session_token()

        await repository.add_session(
            Session(
                self.security.session_digest(token), account.id, now + self.policy.session_lifetime
            )
        )

        return SignedIn(account, token, self.security.csrf_token(token))

    async def get_account(self, token: str) -> Account:
        async with self.persistence.transaction() as repository:
            account = await repository.find_account_by_session(
                self.security.session_digest(token), self.clock()
            )

        if account is None:
            raise IdentityError("authentication_required")

        return account

    async def delete(self, token: str) -> None:
        async with self.persistence.transaction() as repository:
            await repository.remove_session(self.security.session_digest(token))

    def csrf_token(self, token: str) -> str:
        return self.security.csrf_token(token)

    def matches_csrf(self, token: str, supplied: str) -> bool:
        return self.security.matches_csrf(token, supplied)
