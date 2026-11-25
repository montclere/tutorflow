"""Сборка HTTP-маршрутов первой версии API."""

from fastapi import APIRouter

from app.dependencies import (
    adult_services,
    authenticated_session,
    authentication_service,
    calendar_service,
    identity_session,
    previous_session,
    profile_service,
    read_actor,
    registration_service,
    set_invited_session,
    student_services,
    write_actor,
)
from app.modules.identity.presentation.http.router import identity_router
from app.modules.scheduling.presentation.router import calendar_router
from app.modules.students.presentation.http.adult_router import adult_access_router
from app.modules.students.presentation.http.router import students_router


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

router.include_router(
    students_router(
        student_services, read_actor, write_actor, previous_session, set_invited_session
    )
)


router.include_router(
    adult_access_router(
        adult_services, read_actor, write_actor, previous_session, set_invited_session
    )
)
