from collections.abc import Callable
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request, Response

from app.shared.application.contracts.accounts import AccountSummary
from app.shared.application.contracts.student_cards import LessonRole
from app.shared.domain.errors import Problem, ProblemCode
from app.shared.presentation.api.errors import (
    CREATED_RESOURCE,
    JSON_BODY_ERRORS,
    MUTATION_ERRORS,
    JsonRoute,
    LocalTimeProblem,
    problem_response,
    problem_responses,
)
from app.shared.presentation.api.pagination import Pagination
from app.shared.presentation.api.schemas import Page

from ..application.schedule import Schedule
from ..domain.calendar import LocalTimeIssue, instant
from .schemas import (
    AbsenceView,
    Attendance,
    CabinetLesson,
    CancelSeries,
    CreateLesson,
    CreateSeries,
    Decision,
    EditLesson,
    MoveSeries,
    Propose,
    ProposeSeries,
    ReasonBody,
    RequestView,
    SeriesPlan,
    TeacherLesson,
    TeacherPropose,
    TeacherSeries,
    VersionBody,
)

Limit = Annotated[int, Query(ge=1, le=100)]
Cursor = Annotated[str | None, Query(max_length=256)]


def lessons_router(get_schedule: Callable, get_actor: Callable, get_csrf: Callable, key: str):
    router = APIRouter(
        tags=["lessons"],
        route_class=JsonRoute,
        responses=problem_responses(
            ProblemCode.AUTHENTICATION_REQUIRED,
            ProblemCode.RESOURCE_NOT_FOUND,
            ProblemCode.TEACHER_CABINET_REQUIRED,
            ProblemCode.DEPENDENCY_UNAVAILABLE,
            ProblemCode.VALIDATION_FAILED,
        ),
    )
    csrf = [Depends(get_csrf, scope="function")]
    listing_errors = problem_responses(ProblemCode.CURSOR_INVALID, ProblemCode.VALIDATION_FAILED)
    write_errors = problem_responses(
        *JSON_BODY_ERRORS,
        *MUTATION_ERRORS,
        ProblemCode.VERSION_CONFLICT,
        ProblemCode.LESSON_STATE_CONFLICT,
    )
    create_errors = {
        **CREATED_RESOURCE,
        **write_errors,
        **problem_responses(
            ProblemCode.LESSON_TIME_CONFLICT,
            ProblemCode.LESSON_CREATE_CONFLICT,
            ProblemCode.LESSON_STUDENT_NOT_LINKED,
        ),
    }
    propose_errors = {
        **CREATED_RESOURCE,
        **write_errors,
        **problem_responses(
            ProblemCode.LESSON_RESCHEDULE_PENDING,
            ProblemCode.LESSON_TIME_CONFLICT,
        ),
    }

    def created(response, new, location):
        if new:
            response.status_code = 201
            response.headers["Location"] = "/api/v1" + location
        else:
            response.status_code = 200

    def paginate(rows, scope, actor, limit, cursor, date, identifier, *, reverse=False):
        page = Pagination(key, f"lessons:{actor.account_id}:{scope}", limit, cursor)
        after = page.position

        def position(row):
            return instant(row[date]), UUID(row[identifier])

        ordered = sorted(rows, key=position, reverse=reverse)
        if after:
            ordered = [
                row
                for row in ordered
                if (position(row) < after if reverse else position(row) > after)
            ]
        return page.result(ordered, position, lambda item: item)

    def role_router(role: LessonRole):
        prefix = "/" + role
        model = TeacherLesson if role == "teacher" else CabinetLesson

        @router.get(prefix + "/lessons", response_model=Page[model], responses=listing_errors)
        async def list_lessons(
            service: Annotated[Schedule, Depends(get_schedule, scope="function")],
            actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
            start: Annotated[datetime, Query(alias="from")],
            end: Annotated[datetime, Query(alias="to")],
            view: Literal["calendar", "history"] = "calendar",
            student_card_id: UUID | None = None,
            limit: Limit = 20,
            cursor: Cursor = None,
        ):
            rows = await service.listing(actor, role, start, end, view, student_card_id)
            return paginate(
                rows,
                f"{role}:{start}:{end}:{view}:{student_card_id}",
                actor,
                limit,
                cursor,
                "starts_at",
                "lesson_id",
            )

        @router.get(prefix + "/lessons/{lesson_id}", response_model=model)
        async def detail(
            lesson_id: UUID,
            service: Annotated[Schedule, Depends(get_schedule, scope="function")],
            actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
            response: Response,
        ):
            record = await service.detail(actor, role, str(lesson_id))
            if role == "teacher":
                response.headers["ETag"] = f'"{record["version"]}"'
            return record

        @router.get(prefix + "/lessons/{lesson_id}/activity", responses=listing_errors)
        async def activity(
            lesson_id: UUID,
            service: Annotated[Schedule, Depends(get_schedule, scope="function")],
            actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
            limit: Limit = 20,
            cursor: Cursor = None,
        ):
            rows = await service.history(actor, role, str(lesson_id))
            return paginate(
                rows,
                f"{role}:activity:{lesson_id}",
                actor,
                limit,
                cursor,
                "occurred_at",
                "event_id",
                reverse=True,
            )

        @router.get(
            prefix + "/lessons/{lesson_id}/reschedule-requests",
            response_model=Page[RequestView],
            responses=listing_errors,
        )
        async def proposals(
            lesson_id: UUID,
            service: Annotated[Schedule, Depends(get_schedule, scope="function")],
            actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
            limit: Limit = 20,
            cursor: Cursor = None,
        ):
            rows = await service.request_list(actor, role, str(lesson_id))
            return paginate(
                rows,
                f"{role}:requests:{lesson_id}",
                actor,
                limit,
                cursor,
                "created_at",
                "request_id",
                reverse=True,
            )

        ProposalBody = TeacherPropose if role == "teacher" else Propose

        @router.post(
            prefix + "/lessons/{lesson_id}/reschedule-requests",
            response_model=RequestView,
            status_code=201,
            dependencies=csrf,
            responses=propose_errors,
        )
        async def propose(
            lesson_id: UUID,
            data: ProposalBody,  # pyright: ignore[reportInvalidTypeForm]
            service: Annotated[Schedule, Depends(get_schedule, scope="function")],
            actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
            response: Response,
        ):
            result, new = await service.propose(actor, role, str(lesson_id), data.payload())
            created(response, new, prefix + "/reschedule-requests/" + result["request_id"])
            return result

        @router.get(prefix + "/reschedule-requests/{request_id}", response_model=RequestView)
        async def request_detail(
            request_id: UUID,
            service: Annotated[Schedule, Depends(get_schedule, scope="function")],
            actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
        ):
            return await service.request_action(actor, role, str(request_id))

        @router.post(
            prefix + "/reschedule-requests/{request_id}/withdraw",
            response_model=RequestView,
            dependencies=csrf,
            responses=write_errors,
        )
        async def withdraw_request(
            request_id: UUID,
            data: VersionBody,
            service: Annotated[Schedule, Depends(get_schedule, scope="function")],
            actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
        ):
            return await service.request_action(
                actor, role, str(request_id), "withdraw", data.payload()
            )

        if role != "parent":

            @router.post(
                prefix + "/reschedule-requests/{request_id}/resolve",
                response_model=RequestView,
                dependencies=csrf,
                responses={**write_errors, **problem_responses(ProblemCode.LESSON_TIME_CONFLICT)},
            )
            async def resolve(
                request_id: UUID,
                data: Decision,
                service: Annotated[Schedule, Depends(get_schedule, scope="function")],
                actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
            ):
                return await service.request_action(
                    actor, role, str(request_id), "resolve", data.payload()
                )

        @router.get(
            prefix + "/lessons/{lesson_id}/absence-notices",
            response_model=Page[AbsenceView],
            responses=listing_errors,
        )
        async def absences(
            lesson_id: UUID,
            service: Annotated[Schedule, Depends(get_schedule, scope="function")],
            actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
            limit: Limit = 20,
            cursor: Cursor = None,
        ):
            rows = await service.absence(actor, role, str(lesson_id))
            return paginate(
                rows,
                f"{role}:notices:{lesson_id}",
                actor,
                limit,
                cursor,
                "created_at",
                "notice_id",
                reverse=True,
            )

        @router.get(prefix + "/absence-notices/{notice_id}", response_model=AbsenceView)
        async def notice_detail(
            notice_id: UUID,
            service: Annotated[Schedule, Depends(get_schedule, scope="function")],
            actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
        ):
            return await service.absence_action(actor, role, str(notice_id))

        if role != "teacher":

            @router.post(
                prefix + "/lessons/{lesson_id}/absence-notices",
                response_model=AbsenceView,
                status_code=201,
                dependencies=csrf,
                responses={
                    **CREATED_RESOURCE,
                    **write_errors,
                    **problem_responses(ProblemCode.LESSON_ABSENCE_NOTICE_PENDING),
                },
            )
            async def report_absence(
                lesson_id: UUID,
                data: ReasonBody,
                service: Annotated[Schedule, Depends(get_schedule, scope="function")],
                actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
                response: Response,
            ):
                result, new = await service.absence(actor, role, str(lesson_id), data.payload())
                created(response, new, prefix + "/absence-notices/" + result["notice_id"])
                return result

            @router.post(
                prefix + "/absence-notices/{notice_id}/withdraw",
                response_model=AbsenceView,
                dependencies=csrf,
                responses=write_errors,
            )
            async def withdraw_absence(
                notice_id: UUID,
                data: VersionBody,
                service: Annotated[Schedule, Depends(get_schedule, scope="function")],
                actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
            ):
                return await service.absence_action(
                    actor, role, str(notice_id), data.expected_version
                )

        @router.get(prefix + "/lesson-notifications", responses=listing_errors)
        async def notifications(
            service: Annotated[Schedule, Depends(get_schedule, scope="function")],
            actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
            limit: Limit = 20,
            cursor: Cursor = None,
        ):
            return paginate(
                await service.inbox(actor, role),
                f"{role}:inbox",
                actor,
                limit,
                cursor,
                "occurred_at",
                "notification_id",
                reverse=True,
            )

        @router.post(
            prefix + "/student-cards/{card_id}/lesson-notifications/{notification_id}/read",
            status_code=204,
            dependencies=csrf,
            responses=write_errors,
        )
        async def read_notification(
            card_id: UUID,
            notification_id: UUID,
            service: Annotated[Schedule, Depends(get_schedule, scope="function")],
            actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
        ):
            await service.mark_read(actor, role, card_id, str(notification_id))
            return Response(status_code=204)

    for role in ("teacher", "student", "parent"):
        role_router(role)

    @router.get("/teacher/lessons/{lesson_id}/history", responses=listing_errors)
    async def history(
        lesson_id: UUID,
        service: Annotated[Schedule, Depends(get_schedule, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
        limit: Limit = 20,
        cursor: Cursor = None,
    ):
        rows = await service.history(actor, "teacher", str(lesson_id), full=True)
        return paginate(
            rows,
            f"history:{lesson_id}",
            actor,
            limit,
            cursor,
            "occurred_at",
            "event_id",
            reverse=True,
        )

    @router.post(
        "/teacher/lessons",
        response_model=TeacherLesson,
        status_code=201,
        dependencies=csrf,
        responses=create_errors,
    )
    async def create(
        data: CreateLesson,
        service: Annotated[Schedule, Depends(get_schedule, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
        response: Response,
    ):
        result, new = await service.create(actor, data.payload())
        created(response, new, "/teacher/lessons/" + result["lesson_id"])
        return result

    @router.post(
        "/teacher/lessons/record-completed",
        response_model=TeacherLesson,
        status_code=201,
        dependencies=csrf,
        responses=create_errors,
    )
    async def record_completed(
        data: CreateLesson,
        service: Annotated[Schedule, Depends(get_schedule, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
        response: Response,
    ):
        result, new = await service.create(actor, data.payload(), past=True)
        created(response, new, "/teacher/lessons/" + result["lesson_id"])
        return result

    @router.patch(
        "/teacher/lessons/{lesson_id}",
        response_model=TeacherLesson,
        dependencies=csrf,
        responses=write_errors,
    )
    async def edit(
        lesson_id: UUID,
        data: EditLesson,
        service: Annotated[Schedule, Depends(get_schedule, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        return await service.change(actor, str(lesson_id), "edit", data.payload(patch=True))

    @router.post(
        "/teacher/lessons/{lesson_id}/cancel",
        response_model=TeacherLesson,
        dependencies=csrf,
        responses=write_errors,
    )
    async def cancel(
        lesson_id: UUID,
        data: ReasonBody,
        service: Annotated[Schedule, Depends(get_schedule, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        return await service.change(actor, str(lesson_id), "cancel", data.payload())

    @router.post(
        "/teacher/lessons/{lesson_id}/attendance",
        response_model=TeacherLesson,
        dependencies=csrf,
        responses=write_errors,
    )
    async def attendance(
        lesson_id: UUID,
        data: Attendance,
        service: Annotated[Schedule, Depends(get_schedule, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        return await service.change(actor, str(lesson_id), "attendance", data.payload())

    @router.post(
        "/teacher/lessons/{lesson_id}/attendance/reset",
        response_model=TeacherLesson,
        dependencies=csrf,
        responses=write_errors,
    )
    async def reset_attendance(
        lesson_id: UUID,
        data: VersionBody,
        service: Annotated[Schedule, Depends(get_schedule, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        return await service.change(actor, str(lesson_id), "reset", data.payload())

    @router.post(
        "/teacher/lessons/{lesson_id}/restore",
        response_model=TeacherLesson,
        dependencies=csrf,
        responses={**write_errors, **problem_responses(ProblemCode.LESSON_TIME_CONFLICT)},
    )
    async def restore(
        lesson_id: UUID,
        data: VersionBody,
        service: Annotated[Schedule, Depends(get_schedule, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        return await service.change(actor, str(lesson_id), "restore", data.payload())

    @router.delete(
        "/teacher/lessons/{lesson_id}",
        status_code=204,
        dependencies=csrf,
        responses=problem_responses(
            *MUTATION_ERRORS, ProblemCode.PRECONDITION_FAILED, ProblemCode.PRECONDITION_REQUIRED
        ),
    )
    async def delete(
        lesson_id: UUID,
        service: Annotated[Schedule, Depends(get_schedule, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
        if_match: Annotated[str | None, Header()] = None,
    ):
        await service.delete(actor, str(lesson_id), if_match)
        return Response(status_code=204)

    def local_time_failure(request: Request, error: LocalTimeIssue):
        return problem_response(
            request,
            Problem(ProblemCode.VALIDATION_FAILED),
            local_time_issue=LocalTimeProblem.model_validate(vars(error)),
        )

    @router.post("/teacher/lesson-series/preview", dependencies=csrf, responses=write_errors)
    async def preview_series(
        data: SeriesPlan,
        request: Request,
        service: Annotated[Schedule, Depends(get_schedule, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        try:
            result, _ = await service.new_series(actor, data.payload(), preview=True)
        except LocalTimeIssue as error:
            return local_time_failure(request, error)
        return result

    @router.post(
        "/teacher/lesson-series",
        response_model=TeacherSeries,
        status_code=201,
        dependencies=csrf,
        responses=create_errors,
    )
    async def create_series(
        data: CreateSeries,
        request: Request,
        service: Annotated[Schedule, Depends(get_schedule, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
        response: Response,
    ):
        try:
            result, new = await service.new_series(actor, data.payload())
        except LocalTimeIssue as error:
            return local_time_failure(request, error)
        created(response, new, f"/teacher/lesson-series/{result['series_id']}")
        return result

    @router.get("/teacher/lesson-series/{series_id}", response_model=TeacherSeries)
    async def series(
        series_id: UUID,
        service: Annotated[Schedule, Depends(get_schedule, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        return await service.series_detail(actor, str(series_id))

    @router.patch(
        "/teacher/lesson-series/{series_id}/content",
        response_model=TeacherSeries,
        dependencies=csrf,
        responses=write_errors,
    )
    async def edit_series(
        series_id: UUID,
        data: EditLesson,
        service: Annotated[Schedule, Depends(get_schedule, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        return await service.edit_series(actor, str(series_id), data.payload(patch=True))

    @router.post(
        "/teacher/lesson-series/{series_id}/reschedule/preview",
        dependencies=csrf,
        responses=write_errors,
    )
    async def preview_move(
        series_id: UUID,
        data: MoveSeries,
        request: Request,
        service: Annotated[Schedule, Depends(get_schedule, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        try:
            result, _ = await service.propose_series(
                actor, str(series_id), data.payload(), preview=True
            )
        except LocalTimeIssue as error:
            return local_time_failure(request, error)
        return result

    @router.post(
        "/teacher/lesson-series/{series_id}/reschedule-requests",
        response_model=RequestView,
        status_code=201,
        dependencies=csrf,
        responses=propose_errors,
    )
    async def move_series(
        series_id: UUID,
        data: ProposeSeries,
        request: Request,
        service: Annotated[Schedule, Depends(get_schedule, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
        response: Response,
    ):
        try:
            result, new = await service.propose_series(actor, str(series_id), data.payload())
        except LocalTimeIssue as error:
            return local_time_failure(request, error)
        created(response, new, f"/teacher/reschedule-requests/{result['request_id']}")
        return result

    @router.post(
        "/teacher/lesson-series/{series_id}/cancel",
        response_model=TeacherSeries,
        dependencies=csrf,
        responses=write_errors,
    )
    async def cancel_series(
        series_id: UUID,
        data: CancelSeries,
        service: Annotated[Schedule, Depends(get_schedule, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        return await service.cancel_series(actor, str(series_id), data.payload())

    return router
