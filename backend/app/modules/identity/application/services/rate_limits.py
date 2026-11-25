"""Сервис ограничения попыток Identity."""

from datetime import datetime

from app.modules.identity.application.ports import IdentityTokens, IdentityUnitOfWork
from app.modules.identity.domain.exceptions import IdentityError
from app.modules.identity.domain.policies import AttemptLimit


class RateLimitService:
    def __init__(self, persistence: IdentityUnitOfWork, security: IdentityTokens) -> None:
        self.persistence = persistence
        self.security = security

    async def check(self, purpose: str, subject: str, rule: AttemptLimit, now: datetime) -> None:
        key = self.security.digest("rate", purpose, subject)

        async with self.persistence.transaction() as repository:
            if not await repository.consume_rate_window(key, rule.attempts, now, now + rule.period):
                raise IdentityError("rate_limited")
