"""Маршруты отмены и рассмотрения запросов без раскрытия чужого участия."""

from collections.abc import Awaitable, Callable
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.modules.identity.public import Actor
from app.modules.scheduling.application.services.lesson_collection import LessonServices
from app.modules.scheduling.domain.change_requests import (
    ChangeKind,
    ChangeState,
    LessonChangeRequest,
)
from app.modules.scheduling.domain.values import TEXT_MAX_LENGTH
from app.modules.scheduling.presentation.http.lesson_schemas import Input, LessonOperationView
from app.shared.presentation.http import RequestAccess, require_json


class CancellationInput(Input):
    expected_version: Annotated[int, Field(ge=1)]
    cancelled: bool
    reason: Annotated[str | None, Field(max_length=TEXT_MAX_LENGTH)] = None
    card_id: UUID | None = None


class ChangeRequestInput(Input):
    expected_version: Annotated[int, Field(ge=1)]
    kind: ChangeKind
    reason: Annotated[str | None, Field(max_length=TEXT_MAX_LENGTH)] = None
    proposed_start: AwareDatetime | None = None


class ChangeDecisionInput(Input):
    expected_version: Annotated[int, Field(ge=1)]
    state: Literal["accepted", "rejected"]
    starts_at: AwareDatetime | None = None


class WithdrawalInput(Input):
    expected_version: Annotated[int, Field(ge=1)]


class ChangeRequestView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    lesson_id: UUID
    card_id: UUID
    author_id: UUID
    lesson_version: int
    kind: ChangeKind
    reason: str | None
    proposed_start: datetime | None
    created_at: datetime
    state: ChangeState
    decided_by: UUID | None
    decided_at: datetime | None


class ChangeRequestPage(BaseModel):
    items: list[ChangeRequestView]
    next_after: UUID | None


def change_requests_router(
    get_services: Callable[[Request], Awaitable[LessonServices]],
    teacher: RequestAccess[Actor],
    student: RequestAccess[Actor],
    adult: RequestAccess[Actor],
) -> APIRouter:
    router = APIRouter(tags=["Изменения занятий"])


    @router.post("/lessons/{lesson_id}/cancellation")
    async def cancellation(
        lesson_id: UUID,
        command: CancellationInput,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[LessonServices, Depends(get_services)],
    ) -> LessonOperationView:
        require_json(request)

        return LessonOperationView.from_result(
            await services.cancellation.change(
                actor,
                lesson_id,
                command.expected_version,
                command.cancelled,
                command.reason,
                command.card_id,
            )
        )


    @router.get("/lessons/{lesson_id}/change-requests")
    async def requests(
        lesson_id: UUID,
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[LessonServices, Depends(get_services)],
        after_id: UUID | None = None,
        limit: Annotated[int | None, Query(ge=1)] = None,
    ) -> ChangeRequestPage:
        size = services.policy.page_size(limit)
        rows = await services.requests.list_requests(actor, lesson_id, None, after_id, size)

        return request_page(rows, size)


    @router.post("/lessons/{lesson_id}/change-requests/{request_id}/decision")
    async def decide(
        lesson_id: UUID,
        request_id: UUID,
        command: ChangeDecisionInput,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[LessonServices, Depends(get_services)],
    ) -> ChangeRequestView:
        require_json(request)

        return ChangeRequestView.model_validate(
            await services.requests.decide(
                actor,
                lesson_id,
                request_id,
                ChangeState(command.state),
                command.expected_version,
                starts_at=command.starts_at,
            )
        )


    router.include_router(own_requests_router("/me/teachers", student, get_services))
    router.include_router(own_requests_router("/me/students", adult, get_services))

    return router


def request_page(rows: list[LessonChangeRequest], size: int) -> ChangeRequestPage:
    return ChangeRequestPage(
        items=[ChangeRequestView.model_validate(row) for row in rows[:size]],
        next_after=rows[size - 1].id if len(rows) > size else None,
    )


def own_requests_router(
    prefix: str,
    access: RequestAccess[Actor],
    get_services: Callable[[Request], Awaitable[LessonServices]],
) -> APIRouter:
    router = APIRouter(prefix=prefix)


    @router.post("/{card_id}/lessons/{lesson_id}/change-requests", status_code=201)
    async def create(
        card_id: UUID,
        lesson_id: UUID,
        command: ChangeRequestInput,
        request: Request,
        actor: Annotated[Actor, Depends(access.write)],
        services: Annotated[LessonServices, Depends(get_services)],
    ) -> ChangeRequestView:
        require_json(request)

        return ChangeRequestView.model_validate(
            await services.requests.create(
                actor,
                card_id,
                lesson_id,
                command.expected_version,
                command.kind,
                command.reason,
                command.proposed_start,
            )
        )


    @router.get("/{card_id}/lessons/{lesson_id}/change-requests")
    async def requests(
        card_id: UUID,
        lesson_id: UUID,
        actor: Annotated[Actor, Depends(access.read)],
        services: Annotated[LessonServices, Depends(get_services)],
        after_id: UUID | None = None,
        limit: Annotated[int | None, Query(ge=1)] = None,
    ) -> ChangeRequestPage:
        size = services.policy.page_size(limit)
        rows = await services.requests.list_requests(actor, lesson_id, card_id, after_id, size)

        return request_page(rows, size)


    @router.post("/{card_id}/lessons/{lesson_id}/change-requests/{request_id}/withdraw")
    async def withdraw(
        card_id: UUID,
        lesson_id: UUID,
        request_id: UUID,
        command: WithdrawalInput,
        request: Request,
        actor: Annotated[Actor, Depends(access.write)],
        services: Annotated[LessonServices, Depends(get_services)],
    ) -> ChangeRequestView:
        require_json(request)

        return ChangeRequestView.model_validate(
            await services.requests.decide(
                actor,
                lesson_id,
                request_id,
                ChangeState.WITHDRAWN,
                command.expected_version,
                card_id,
            )
        )


    return router
