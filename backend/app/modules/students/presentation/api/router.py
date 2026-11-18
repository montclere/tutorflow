from collections.abc import Callable
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response

from app.shared.application.contracts.accounts import AccountSummary
from app.shared.application.ports.clock import now_utc
from app.shared.domain.errors import ProblemCode
from app.shared.presentation.api.auth import RateLimiter
from app.shared.presentation.api.errors import (
    CREATED_RESOURCE,
    JSON_BODY_ERRORS,
    MUTATION_ERRORS,
    JsonRoute,
    problem_responses,
)
from app.shared.presentation.api.pagination import Pagination
from app.shared.presentation.api.schemas import Page

from ...application.students import Students
from ...domain.student import InvitationPurpose
from .schemas import (
    AcceptInvitation,
    CabinetsView,
    CardEdit,
    CardStatus,
    CardVersion,
    InvitationAcceptance,
    InvitationCreated,
    InvitationIssue,
    InvitationPreview,
    InvitationSummary,
    InvitationToken,
    ParentAccessView,
    ParentCardView,
    StudentCardView,
    TeacherCardView,
)

Limit = Annotated[int, Query(ge=1, le=100)]
Cursor = Annotated[str | None, Query(max_length=256)]
TEACHER_ERRORS = (ProblemCode.AUTHENTICATION_REQUIRED, ProblemCode.TEACHER_CABINET_REQUIRED)
LIST_ERRORS = (ProblemCode.VALIDATION_FAILED, ProblemCode.CURSOR_INVALID)
OBJECT_ERRORS = (ProblemCode.RESOURCE_NOT_FOUND, ProblemCode.VALIDATION_FAILED)


def students_router(
    get_students: Callable,
    get_actor: Callable,
    get_csrf: Callable,
    rate: RateLimiter,
    key: str,
) -> APIRouter:
    router = APIRouter(
        tags=["students"],
        route_class=JsonRoute,
        responses=problem_responses(ProblemCode.DEPENDENCY_UNAVAILABLE),
    )
    csrf_dependency = Depends(get_csrf, scope="function")
    csrf = [csrf_dependency]

    @router.post(
        "/teacher/invitations",
        status_code=201,
        response_model=InvitationCreated,
        dependencies=csrf,
        responses={
            **CREATED_RESOURCE,
            **problem_responses(
                *JSON_BODY_ERRORS,
                *MUTATION_ERRORS,
                *TEACHER_ERRORS,
                ProblemCode.RATE_LIMITED,
            ),
        },
    )
    async def issue(
        data: InvitationIssue,
        response: Response,
        students: Annotated[Students, Depends(get_students, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        students.require_teacher(actor)
        await rate("invitation_issue", str(actor.account_id), 50, 86400)
        invitation, token = await students.issue(actor, data.purpose)
        response.headers["Location"] = f"/api/v1/teacher/invitations/{invitation.invitation_id}"
        return {"invitation": invitation.summary(now_utc()), "invitation_token": token}

    @router.get(
        "/teacher/invitations",
        response_model=Page[InvitationSummary],
        responses=problem_responses(*TEACHER_ERRORS, *LIST_ERRORS),
    )
    async def invitations(
        students: Annotated[Students, Depends(get_students, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
        limit: Limit = 20,
        cursor: Cursor = None,
    ):
        page = Pagination(key, f"invitations:{actor.account_id}", limit, cursor)
        records = await students.invitations(actor, limit + 1, page.position)
        now = now_utc()
        return page.result(
            records, lambda row: (row.created_at, row.invitation_id), lambda row: row.summary(now)
        )

    @router.delete(
        "/teacher/invitations/{invitation_id}",
        status_code=204,
        dependencies=csrf,
        responses=problem_responses(
            *TEACHER_ERRORS,
            *MUTATION_ERRORS,
            *OBJECT_ERRORS,
            ProblemCode.INVITATION_UNAVAILABLE,
            ProblemCode.INVITATION_ALREADY_ACCEPTED,
        ),
    )
    async def revoke_invitation(
        invitation_id: UUID,
        students: Annotated[Students, Depends(get_students, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        await students.revoke_invitation(actor, invitation_id)

    @router.post(
        "/invitations/preview",
        response_model=InvitationPreview,
        dependencies=csrf,
        responses=problem_responses(
            *JSON_BODY_ERRORS,
            *MUTATION_ERRORS,
            ProblemCode.RATE_LIMITED,
            ProblemCode.INVITATION_UNAVAILABLE,
        ),
    )
    async def preview(
        data: InvitationToken,
        request: Request,
        students: Annotated[Students, Depends(get_students, scope="function")],
    ):
        await rate("invitation_preview", request.state.source, 60, 600)
        invitation = await students.preview(data.invitation_token)
        return {"purpose": invitation.purpose, "expires_at": invitation.expires_at}

    @router.post(
        "/invitations/accept",
        status_code=201,
        response_model=InvitationAcceptance,
        response_model_exclude_none=True,
        responses={
            **CREATED_RESOURCE,
            200: {"model": InvitationAcceptance},
            **problem_responses(
                *JSON_BODY_ERRORS,
                *MUTATION_ERRORS,
                ProblemCode.AUTHENTICATION_REQUIRED,
                ProblemCode.RATE_LIMITED,
                ProblemCode.INVITATION_UNAVAILABLE,
                ProblemCode.INVITATION_ACCEPTANCE_CONFLICT,
                ProblemCode.STUDENT_CARD_ALREADY_LINKED,
            ),
        },
    )
    async def accept(
        data: AcceptInvitation,
        request: Request,
        response: Response,
        students: Annotated[Students, Depends(get_students, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
        _csrf=csrf_dependency,
    ):
        await rate("invitation_accept_ip", request.state.source, 100, 600)
        await rate("invitation_accept", str(actor.account_id), 30, 600)
        result, created = await students.accept(
            actor,
            data.invitation_token,
            data.model_dump(exclude_unset=True, exclude={"invitation_token"}),
        )
        response.status_code = 201 if created else 200
        if created:
            role = "student" if result["purpose"] == InvitationPurpose.STUDENT else "parent"
            response.headers["Location"] = (
                f"/api/v1/{role}/student-cards/{result['student_card_id']}"
            )
        return result

    @router.get(
        "/teacher/student-cards",
        response_model=Page[TeacherCardView],
        responses=problem_responses(*TEACHER_ERRORS, *LIST_ERRORS),
    )
    async def teacher_cards(
        students: Annotated[Students, Depends(get_students, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
        status: CardStatus = "active",
        limit: Limit = 20,
        cursor: Cursor = None,
    ):
        page = Pagination(key, f"teacher:{actor.account_id}:{status}", limit, cursor)
        records = await students.teacher_cards(actor, status, limit + 1, page.position)
        return page.result(
            records,
            lambda card: (card.updated_at, card.student_card_id),
            lambda card: card.teacher_view(),
        )

    @router.get(
        "/teacher/student-cards/{student_card_id}",
        response_model=TeacherCardView,
        responses=problem_responses(*TEACHER_ERRORS, *OBJECT_ERRORS),
    )
    async def teacher_card(
        student_card_id: UUID,
        students: Annotated[Students, Depends(get_students, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        return (await students.teacher_card(actor, student_card_id)).teacher_view()

    @router.patch(
        "/teacher/student-cards/{student_card_id}",
        response_model=TeacherCardView,
        dependencies=csrf,
        responses=problem_responses(
            *JSON_BODY_ERRORS,
            *MUTATION_ERRORS,
            *TEACHER_ERRORS,
            ProblemCode.RESOURCE_NOT_FOUND,
            ProblemCode.VERSION_CONFLICT,
        ),
    )
    async def edit_card(
        student_card_id: UUID,
        data: CardEdit,
        students: Annotated[Students, Depends(get_students, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        card = await students.edit_card(
            actor,
            student_card_id,
            data.expected_version,
            data.model_dump(exclude_unset=True, exclude={"expected_version"}),
        )
        return card.teacher_view()

    @router.post(
        "/teacher/student-cards/{student_card_id}/archive",
        response_model=TeacherCardView,
        dependencies=csrf,
        responses=problem_responses(
            *JSON_BODY_ERRORS,
            *MUTATION_ERRORS,
            *TEACHER_ERRORS,
            ProblemCode.RESOURCE_NOT_FOUND,
            ProblemCode.VERSION_CONFLICT,
        ),
    )
    async def archive(
        student_card_id: UUID,
        data: CardVersion,
        students: Annotated[Students, Depends(get_students, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        card = await students.change_status(
            actor, student_card_id, data.expected_version, "archived"
        )
        return card.teacher_view()

    @router.post(
        "/teacher/student-cards/{student_card_id}/restore",
        response_model=TeacherCardView,
        dependencies=csrf,
        responses=problem_responses(
            *JSON_BODY_ERRORS,
            *MUTATION_ERRORS,
            *TEACHER_ERRORS,
            ProblemCode.RESOURCE_NOT_FOUND,
            ProblemCode.VERSION_CONFLICT,
        ),
    )
    async def restore(
        student_card_id: UUID,
        data: CardVersion,
        students: Annotated[Students, Depends(get_students, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        card = await students.change_status(actor, student_card_id, data.expected_version, "active")
        return card.teacher_view()

    def register_cabinet_routes(role: Literal["student", "parent"]):
        model = StudentCardView if role == "student" else ParentCardView

        @router.get(
            f"/{role}/student-cards",
            response_model=Page[model],
            operation_id=f"{role}_cards",
            responses=problem_responses(ProblemCode.AUTHENTICATION_REQUIRED, *LIST_ERRORS),
        )
        async def cabinet_cards(
            students: Annotated[Students, Depends(get_students, scope="function")],
            actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
            limit: Limit = 20,
            cursor: Cursor = None,
        ):
            page = Pagination(key, f"{role}:{actor.account_id}", limit, cursor)
            records = await students.cabinet_cards(actor, role, limit + 1, page.position)
            return page.result(
                records,
                lambda row: (row.card.updated_at, row.card.student_card_id),
                lambda row: row.view(),
            )

        @router.get(
            f"/{role}/student-cards/{{student_card_id}}",
            response_model=model,
            operation_id=f"{role}_card",
            responses=problem_responses(ProblemCode.AUTHENTICATION_REQUIRED, *OBJECT_ERRORS),
        )
        async def cabinet_card(
            student_card_id: UUID,
            students: Annotated[Students, Depends(get_students, scope="function")],
            actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
        ):
            return (await students.cabinet_card(actor, student_card_id, role)).view()

    register_cabinet_routes("student")
    register_cabinet_routes("parent")

    @router.get(
        "/teacher/student-cards/{student_card_id}/parent-access",
        response_model=Page[ParentAccessView],
        responses=problem_responses(*TEACHER_ERRORS, *LIST_ERRORS, ProblemCode.RESOURCE_NOT_FOUND),
    )
    async def access_list(
        student_card_id: UUID,
        students: Annotated[Students, Depends(get_students, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
        limit: Limit = 20,
        cursor: Cursor = None,
    ):
        page = Pagination(key, f"access:{actor.account_id}:{student_card_id}", limit, cursor)
        records = await students.access_list(actor, student_card_id, limit + 1, page.position)
        return page.result(
            records, lambda row: (row[0].created_at, row[0].parent_access_id), lambda row: row[1]
        )

    @router.delete(
        "/parent-access/{parent_access_id}",
        status_code=204,
        dependencies=csrf,
        responses=problem_responses(
            *MUTATION_ERRORS,
            *OBJECT_ERRORS,
            ProblemCode.AUTHENTICATION_REQUIRED,
        ),
    )
    async def revoke_access(
        parent_access_id: UUID,
        students: Annotated[Students, Depends(get_students, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        await students.revoke_access(actor, parent_access_id)

    @router.get(
        "/cabinets",
        response_model=CabinetsView,
        responses=problem_responses(ProblemCode.AUTHENTICATION_REQUIRED),
    )
    async def cabinets(
        students: Annotated[Students, Depends(get_students, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        return {
            "teacher_enabled": actor.teacher_enabled,
            "student_available": bool(await students.cabinet_cards(actor, "student", 1, None)),
            "parent_available": bool(await students.cabinet_cards(actor, "parent", 1, None)),
        }

    return router
