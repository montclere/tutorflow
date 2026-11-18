"""Сборка HTTP-модулей и общая транзакция на запрос."""

from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from app.config import Settings
from app.modules.identity.application.identity import Identity, IdentityPolicy
from app.modules.identity.application.ports import CodeDelivery
from app.modules.identity.domain.accounts import Session
from app.modules.identity.infrastructure.delivery import (
    ConfiguredDelivery,
    SmscSettings,
    SmtpSettings,
)
from app.modules.identity.infrastructure.passwords import ArgonPasswords
from app.modules.identity.infrastructure.repository import PostgresIdentity
from app.modules.identity.presentation.router import check_csrf, identity_router
from app.modules.students.application.students import Students
from app.modules.students.infrastructure.persistence.repositories import PostgresStudents
from app.modules.students.presentation.api.router import students_router
from app.shared.application.contracts.accounts import AccountSummary
from app.shared.application.contracts.student_cards import StudentCardAccess
from app.shared.application.ports.clock import now_utc
from app.shared.infrastructure.rate_limit import PostgresRateLimiter


@dataclass(frozen=True)
class Services:
    identity: Identity
    students: Students

    @property
    def student_card_access(self) -> StudentCardAccess:
        return self.students


def build_routers(
    settings: Settings,
    engine: AsyncEngine,
    rate_engine: AsyncEngine,
    delivery: CodeDelivery | None,
) -> tuple[APIRouter, APIRouter]:
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    activity_sessions = async_sessionmaker(rate_engine, expire_on_commit=False)
    passwords = ArgonPasswords()
    rate = PostgresRateLimiter(activity_sessions, settings.secret_key)
    if delivery is None:
        smtp = (
            SmtpSettings(
                settings.smtp_host,
                settings.smtp_port,
                settings.smtp_sender,
                settings.smtp_username,
                settings.smtp_password,
                settings.smtp_tls,
            )
            if settings.smtp_host and settings.smtp_sender
            else None
        )
        smsc = (
            SmscSettings(settings.smsc_api_key, settings.smsc_sender)
            if settings.smsc_api_key and settings.smsc_sender
            else None
        )
        delivery = ConfiguredDelivery(settings.local_inbox, smtp, smsc)
    channel = delivery
    policy = IdentityPolicy(
        settings.challenge_minutes,
        settings.challenge_attempts,
        settings.session_days,
        settings.session_idle_hours,
        settings.anonymous_minutes,
        settings.max_active_sessions,
    )

    async def services(request: Request) -> AsyncIterator[Services]:
        async with sessions.begin() as db:
            directory = PostgresIdentity(db)
            students = Students(
                PostgresStudents(db, request.state.request_id),
                directory,
                settings.secret_key,
                settings.invitation_hours,
            )
            yield Services(
                Identity(directory, channel, passwords, students, settings.secret_key, policy),
                students,
            )

    async def get_identity(
        context: Annotated[Services, Depends(services, scope="function")],
    ) -> Identity:
        return context.identity

    async def get_students(
        context: Annotated[Services, Depends(services, scope="function")],
    ) -> Students:
        return context.students

    async def get_session(
        request: Request, context: Annotated[Services, Depends(services, scope="function")]
    ) -> Session | None:
        return await context.identity.session(request.cookies.get(settings.cookie_name))

    async def get_actor(
        context: Annotated[Services, Depends(services, scope="function")],
        session: Annotated[Session | None, Depends(get_session, scope="function")],
    ) -> AccountSummary:
        actor = await context.identity.actor(session)
        if session and session.last_seen_at <= now_utc() - timedelta(minutes=5):
            # Не держим блокировку строки сессии, выполняя бизнес-транзакцию.
            async with activity_sessions.begin() as activity_db:
                await PostgresIdentity(activity_db).touch(session, now_utc())
        return actor

    async def get_csrf(
        request: Request, session: Annotated[Session | None, Depends(get_session, scope="function")]
    ) -> Session:
        return check_csrf(request, session, settings.browser_origin)

    return (
        identity_router(
            get_identity,
            get_session,
            get_actor,
            get_csrf,
            rate,
            settings.secret_key,
            settings.cookie_name,
            settings.secure_cookie,
        ),
        students_router(get_students, get_actor, get_csrf, rate, settings.secret_key),
    )
