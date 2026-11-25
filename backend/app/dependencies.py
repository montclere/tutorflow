"""HTTP-провайдеры сервисов приложения и аутентифицированного пользователя."""

from fastapi import HTTPException, Request
from sqlalchemy.exc import ArgumentError

from app.composition import Services, services_from_environment
from app.modules.identity.application.services.authentication import AuthenticationService
from app.modules.identity.application.services.profiles import ProfileService
from app.modules.identity.application.services.registration import RegistrationService
from app.modules.identity.presentation.http.session import (
    LOCAL_SESSION_COOKIE,
    SECURE_SESSION_COOKIE,
    IdentityHttpSession,
)
from app.modules.identity.public import Actor
from app.modules.scheduling.application.calendar import Calendar


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


async def read_actor(request: Request) -> Actor:
    return await (await authenticated_session(request)).actor(request)


async def write_actor(request: Request) -> Actor:
    return await (await authenticated_session(request)).actor(request, csrf=True)
