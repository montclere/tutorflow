"""Сборка HTTP-маршрутов первой версии API."""

from fastapi import APIRouter

from app.dependencies import (
    adult_access,
    adult_services,
    authenticated_session,
    authentication_service,
    calendar_service,
    group_services,
    identity_session,
    previous_session,
    principal_access,
    profile_service,
    registration_service,
    role_service,
    set_invited_session,
    student_access,
    student_services,
    teacher_access,
)
from app.modules.groups.presentation.http.router import groups_router
from app.modules.identity.presentation.http.router import identity_router
from app.modules.scheduling.presentation.router import calendar_router
from app.modules.students.presentation.http.adult_router import adult_access_router
from app.modules.students.presentation.http.responsibilities_router import responsibilities_router
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
        role_service,
    )
)
router.include_router(calendar_router(calendar_service, teacher_access.read, teacher_access.write))

router.include_router(
    students_router(
        student_services,
        teacher_access,
        student_access,
        principal_access,
        previous_session,
        set_invited_session,
    )
)


router.include_router(
    adult_access_router(
        adult_services,
        teacher_access,
        adult_access,
        principal_access,
        previous_session,
        set_invited_session,
    )
)


router.include_router(groups_router(group_services, teacher_access, student_access, adult_access))


router.include_router(responsibilities_router(student_services, teacher_access))
