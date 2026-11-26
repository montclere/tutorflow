"""Сборка сценариев из PostgreSQL-репозиториев и внешних адаптеров."""

import secrets
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncEngine

from app.config import Settings
from app.integrations.groups import PostgresGroupsUnitOfWork
from app.integrations.students import PostgresStudentsUnitOfWork, StudentRateLimits
from app.modules.groups.application.services.collection import GroupServices
from app.modules.groups.application.services.groups import GroupService
from app.modules.groups.application.services.memberships import MembershipService
from app.modules.groups.application.services.participation import ParticipationService
from app.modules.identity.application.ports import CodeDelivery
from app.modules.identity.application.services.authentication import AuthenticationService
from app.modules.identity.application.services.profiles import ProfileService
from app.modules.identity.application.services.rate_limits import RateLimitService
from app.modules.identity.application.services.registration import RegistrationService
from app.modules.identity.application.services.roles import RoleService
from app.modules.identity.application.services.sessions import SessionService
from app.modules.identity.domain.policies import IdentityPolicy
from app.modules.identity.infrastructure.delivery.sender import (
    ConfiguredDelivery,
    ObservedCodeDelivery,
)
from app.modules.identity.infrastructure.persistence.unit_of_work import PostgresIdentityUnitOfWork
from app.modules.identity.infrastructure.security.passwords import ArgonPasswords
from app.modules.identity.infrastructure.security.settings import PasswordHashingSettings
from app.modules.identity.infrastructure.security.tokens import IdentitySecurity
from app.modules.identity.infrastructure.validation.contacts import ValidatedContacts
from app.modules.identity.presentation.http.session import (
    LOCAL_SESSION_COOKIE,
    SECURE_SESSION_COOKIE,
)
from app.modules.identity.public import Role
from app.modules.scheduling.application.calendar import Calendar
from app.modules.scheduling.infrastructure.repository import PostgresCalendarRepository
from app.modules.students.application.services.adult_connections import AdultConnectionService
from app.modules.students.application.services.adult_invitations import AdultInvitationService
from app.modules.students.application.services.cards import CardService
from app.modules.students.application.services.collection import AdultServices, StudentServices
from app.modules.students.application.services.connections import ConnectionService
from app.modules.students.application.services.invitations import InvitationService
from app.modules.students.application.services.profiles import LearningProfileService
from app.modules.students.application.services.registration import InvitedRegistrationService
from app.modules.students.application.services.responsibilities import ResponsibilityService
from app.modules.students.domain.policies import AdultAccessPolicy, StudentPolicy
from app.modules.students.infrastructure.security.tokens import SecureInvitationTokens
from app.modules.students.infrastructure.settings import StudentSettings
from app.shared.infrastructure.database import postgres_engine
from app.shared.infrastructure.metrics import Metrics, process_metrics


@dataclass(frozen=True)
class IdentityServices:
    registration: RegistrationService
    authentication: AuthenticationService
    sessions: SessionService
    profiles: ProfileService
    roles: RoleService


@dataclass(frozen=True)
class Services:
    identity: IdentityServices
    calendar: Calendar
    secure_cookie: bool
    engine: AsyncEngine
    metrics: Metrics
    students: StudentServices
    adults: AdultServices
    groups: GroupServices

    @property
    def cookie_name(self) -> str:
        return SECURE_SESSION_COOKIE if self.secure_cookie else LOCAL_SESSION_COOKIE


def now_utc() -> datetime:
    return datetime.now(UTC)


async def build_services(
    engine: AsyncEngine,
    secret: bytes,
    delivery: CodeDelivery,
    *,
    secure_cookie: bool,
    metrics: Metrics | None = None,
    identity_policy: IdentityPolicy | None = None,
    password_hashing: PasswordHashingSettings | None = None,
    student_policy: StudentPolicy | None = None,
    adult_policy: AdultAccessPolicy | None = None,
) -> Services:
    metrics = metrics or Metrics()
    passwords = ArgonPasswords(password_hashing)
    dummy_hash = await passwords.hash(secrets.token_hex(32))

    policy = identity_policy or IdentityPolicy()
    persistence = PostgresIdentityUnitOfWork(engine)
    security = IdentitySecurity(secret)
    contacts = ValidatedContacts()
    rate_limits = RateLimitService(persistence, security)
    sessions = SessionService(persistence, security, policy, now_utc)
    registration = RegistrationService(
        persistence,
        passwords,
        ObservedCodeDelivery(delivery, metrics),
        security,
        sessions,
        rate_limits,
        policy,
        now_utc,
        contacts=contacts,
    )
    authentication = AuthenticationService(
        persistence,
        passwords,
        sessions,
        rate_limits,
        policy,
        now_utc,
        dummy_hash,
        contacts=contacts,
    )

    student_settings = StudentSettings()
    student_policy = student_policy or student_settings.policy
    adult_policy = adult_policy or student_settings.adult_policy
    student_persistence = PostgresStudentsUnitOfWork(engine, registration)
    invitation_service = InvitationService(
        student_persistence,
        SecureInvitationTokens(secret),
        StudentRateLimits(rate_limits, student_policy, registration),
        student_policy,
        now_utc,
    )
    connection_service = ConnectionService(student_persistence, invitation_service)
    student_services = StudentServices(
        ResponsibilityService(student_persistence, now_utc),
        CardService(student_persistence),
        LearningProfileService(student_persistence),
        invitation_service,
        connection_service,
        InvitedRegistrationService(
            student_persistence, registration, invitation_service, connection_service, Role.STUDENT
        ),
    )

    adult_invitations = AdultInvitationService(
        student_persistence,
        SecureInvitationTokens(secret, purpose=b"adults-invitation\0"),
        StudentRateLimits(rate_limits, student_policy, registration),
        student_policy,
        adult_policy,
        now_utc,
    )
    adult_connections = AdultConnectionService(student_persistence, adult_invitations, adult_policy)
    adult_services = AdultServices(
        adult_invitations,
        adult_connections,
        InvitedRegistrationService(
            student_persistence, registration, adult_invitations, adult_connections, Role.ADULT
        ),
    )

    groups_persistence = PostgresGroupsUnitOfWork(engine)
    groups = GroupServices(
        GroupService(groups_persistence),
        MembershipService(groups_persistence),
        ParticipationService(groups_persistence),
    )

    return Services(
        IdentityServices(
            registration,
            authentication,
            sessions,
            ProfileService(persistence),
            RoleService(persistence, now_utc),
        ),
        Calendar(PostgresCalendarRepository(engine)),
        secure_cookie,
        engine,
        metrics,
        student_services,
        adult_services,
        groups,
    )


async def services_from_environment() -> Services:
    settings = Settings.model_validate({})

    engine = postgres_engine(settings.database_url.get_secret_value())

    try:
        return await build_services(
            engine,
            settings.identity_secret.get_secret_value(),
            ConfiguredDelivery(settings.delivery),
            secure_cookie=settings.secure_cookie,
            metrics=process_metrics(),
            identity_policy=settings.policy,
            password_hashing=settings.password_hashing,
        )
    except BaseException:
        await engine.dispose()

        raise
