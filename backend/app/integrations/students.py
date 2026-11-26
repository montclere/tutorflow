"""Сборка общей PostgreSQL-транзакции Students и участника Identity."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from app.modules.groups.infrastructure.persistence.repository import PostgresGroupsRepository
from app.modules.identity.application.services.invited_accounts import InvitedAccountService
from app.modules.identity.application.services.rate_limits import RateLimitService
from app.modules.identity.application.services.registration import RegistrationService
from app.modules.identity.domain.policies import AttemptLimit
from app.modules.identity.infrastructure.persistence.repository import PostgresIdentityRepository
from app.modules.students.application.ports import StudentsTransaction
from app.modules.students.domain.policies import StudentPolicy
from app.modules.students.infrastructure.persistence.adult_repository import (
    PostgresAdultAccessRepository,
)
from app.modules.students.infrastructure.persistence.repository import PostgresStudentsRepository


class PostgresStudentsUnitOfWork:
    def __init__(self, engine: AsyncEngine, registration: RegistrationService) -> None:
        self.sessions = async_sessionmaker(engine, expire_on_commit=False)
        self.registration = registration

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[StudentsTransaction]:
        async with self.sessions.begin() as db:
            yield StudentsTransaction(
                PostgresStudentsRepository(db),
                InvitedAccountService(PostgresIdentityRepository(db), self.registration),
                PostgresAdultAccessRepository(db),
                PostgresGroupsRepository(db),
            )


class StudentRateLimits:
    def __init__(
        self, limits: RateLimitService, policy: StudentPolicy, registration: RegistrationService
    ) -> None:
        self.limits = limits
        self.policy = policy
        self.clock = registration.clock

    async def access(self, ip: str) -> None:
        await self.limits.check(
            "invitation-access",
            ip,
            AttemptLimit(
                self.policy.invitation_access_attempts, self.policy.invitation_access_period
            ),
            self.clock(),
        )

    async def issue(self, teacher_id: UUID) -> None:
        await self.limits.check(
            "invitation-issue",
            str(teacher_id),
            AttemptLimit(
                self.policy.invitation_issue_attempts, self.policy.invitation_issue_period
            ),
            self.clock(),
        )
