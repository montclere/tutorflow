"""Сборка HTTP-маршрутов первой версии API."""

from fastapi import APIRouter

from app.dependencies import (
    authenticated_session,
    authentication_service,
    calendar_service,
    identity_session,
    profile_service,
    read_actor,
    registration_service,
    write_actor,
)
from app.modules.identity.presentation.http.router import identity_router
from app.modules.scheduling.presentation.router import calendar_router


PREFIX = "/api/v1"


router = APIRouter(prefix=PREFIX)

router.include_router(
    identity_router(
        identity_session,
        authenticated_session,
        registration_service,
        authentication_service,
        profile_service,
    )
)
router.include_router(calendar_router(calendar_service, read_actor, write_actor))
