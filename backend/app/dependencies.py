"""HTTP-провайдеры сервисов приложения и аутентифицированного пользователя."""

from fastapi import HTTPException, Request, Response
from sqlalchemy.exc import ArgumentError

from app.composition import Services, services_from_environment
from app.modules.groups.application.services.collection import GroupServices
from app.modules.identity.application.services.authentication import AuthenticationService
from app.modules.identity.application.services.profiles import ProfileService
from app.modules.identity.application.services.registration import RegistrationService
from app.modules.identity.application.services.roles import RoleService
from app.modules.identity.presentation.http.session import (
    LOCAL_SESSION_COOKIE,
    SECURE_SESSION_COOKIE,
    IdentityHttpSession,
)
from app.modules.identity.public import Actor, InvitedSession, Principal, Role
from app.modules.scheduling.application.calendar import Calendar
from app.modules.scheduling.application.services.lesson_collection import LessonServices
from app.modules.scheduling.application.services.series_collection import SeriesServices
from app.modules.students.application.services.collection import AdultServices, StudentServices
from app.shared.presentation.http import RequestAccess


async def resolve_services(request: Request) -> Services:
    injected: Services | None = request.app.state.services

    if injected is not None:
        return injected

    try:
        async with request.app.state.services_lock:
            if request.app.state.services is None:
                request.app.state.services = await services_from_environment()

            return request.app.state.services
    except (ValueError, ArgumentError):
        raise HTTPException(503, "identity_unavailable") from None


async def identity_session(request: Request) -> IdentityHttpSession:
    services = await resolve_services(request)

    return IdentityHttpSession(services.identity.sessions, services.secure_cookie)


async def authenticated_session(request: Request) -> IdentityHttpSession:
    if not any(request.cookies.get(name) for name in (SECURE_SESSION_COOKIE, LOCAL_SESSION_COOKIE)):
        raise HTTPException(401, "authentication_required")

    return await identity_session(request)


async def registration_service(request: Request) -> RegistrationService:
    return (await resolve_services(request)).identity.registration


async def authentication_service(request: Request) -> AuthenticationService:
    return (await resolve_services(request)).identity.authentication


async def profile_service(request: Request) -> ProfileService:
    return (await resolve_services(request)).identity.profiles


async def calendar_service(request: Request) -> Calendar:
    return (await resolve_services(request)).calendar


async def teacher_reader(request: Request) -> Actor:
    return await (await authenticated_session(request)).actor(request, role=Role.TEACHER)


async def teacher_writer(request: Request) -> Actor:
    return await (await authenticated_session(request)).actor(request, role=Role.TEACHER, csrf=True)


async def student_reader(request: Request) -> Actor:
    return await (await authenticated_session(request)).actor(request, role=Role.STUDENT)


async def student_writer(request: Request) -> Actor:
    return await (await authenticated_session(request)).actor(request, role=Role.STUDENT, csrf=True)


async def adult_reader(request: Request) -> Actor:
    return await (await authenticated_session(request)).actor(request, role=Role.ADULT)


async def adult_writer(request: Request) -> Actor:
    return await (await authenticated_session(request)).actor(request, role=Role.ADULT, csrf=True)


async def principal_reader(request: Request) -> Principal:
    return await (await authenticated_session(request)).principal(request)


async def principal_writer(request: Request) -> Principal:
    return await (await authenticated_session(request)).principal(request, csrf=True)


teacher_access = RequestAccess(teacher_reader, teacher_writer)
student_access = RequestAccess(student_reader, student_writer)
adult_access = RequestAccess(adult_reader, adult_writer)
principal_access = RequestAccess(principal_reader, principal_writer)


async def role_service(request: Request) -> RoleService:
    return (await resolve_services(request)).identity.roles


async def student_services(request: Request) -> StudentServices:
    return (await resolve_services(request)).students


async def previous_session(request: Request) -> str | None:
    return (await identity_session(request)).token(request)


async def set_invited_session(
    request: Request, response: Response, session: InvitedSession
) -> None:
    (await identity_session(request)).set_cookie(response, session)


async def adult_services(request: Request) -> AdultServices:
    return (await resolve_services(request)).adults


async def group_services(request: Request) -> GroupServices:
    return (await resolve_services(request)).groups


async def lesson_services(request: Request) -> LessonServices:
    return (await resolve_services(request)).lessons


async def series_services(request: Request) -> SeriesServices:
    return (await resolve_services(request)).series
