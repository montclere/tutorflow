"""Преподавательский API завершения и очереди необработанных занятий."""

from collections.abc import Awaitable, Callable
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import AwareDatetime, Field

from app.modules.identity.public import Actor
from app.modules.scheduling.application.services.lesson_collection import LessonServices
from app.modules.scheduling.domain.completion import Attendance, LessonOutcome
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.values import TEXT_MAX_LENGTH
from app.modules.scheduling.presentation.http.lesson_schemas import (
    Input,
    LessonOperationView,
    LessonView,
)
from app.shared.presentation.http import RequestAccess, require_json


class AttendanceInput(Input):
    card_id: UUID
    attendance: Attendance


class CompletionInput(Input):
    expected_version: Annotated[int, Field(ge=1)]
    outcome: Literal["held", "not_held"]
    attendance: list[AttendanceInput] = Field(default_factory=list)
    notes: Annotated[str | None, Field(max_length=TEXT_MAX_LENGTH)] = None


class UnfinishedPage(Input):
    items: list[LessonView]
    next_after: UUID | None


def completion_router(
    get_services: Callable[[Request], Awaitable[LessonServices]], teacher: RequestAccess[Actor]
) -> APIRouter:
    router = APIRouter(tags=["Проведение занятий"])


    @router.post("/lessons/{lesson_id}/completion")
    async def complete(
        lesson_id: UUID,
        command: CompletionInput,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[LessonServices, Depends(get_services)],
    ) -> LessonOperationView:
        require_json(request)

        attendance = {item.card_id: item.attendance for item in command.attendance}

        if len(attendance) != len(command.attendance):
            raise LessonError("invalid_lesson_completion")

        return LessonOperationView.from_result(
            await services.completion.complete(
                actor,
                lesson_id,
                command.expected_version,
                LessonOutcome(command.outcome),
                attendance,
                command.notes,
            )
        )


    @router.get("/lessons/needs-completion")
    async def unfinished(
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[LessonServices, Depends(get_services)],
        from_: Annotated[AwareDatetime, Query(alias="from")],
        to: AwareDatetime,
        limit: Annotated[int | None, Query(ge=1)] = None,
        after_id: UUID | None = None,
    ) -> UnfinishedPage:
        size = services.policy.page_size(limit)
        rows = await services.completion.unfinished(actor, from_, to, size, after_id)

        return UnfinishedPage(
            items=[LessonView.from_lesson(row.lesson, row.observed_at) for row in rows[:size]],
            next_after=rows[size - 1].lesson.id if len(rows) > size else None,
        )


    return router
