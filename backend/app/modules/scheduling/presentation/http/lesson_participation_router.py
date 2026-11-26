"""Собственный календарь и ответы в фиксированном ученическом или взрослом кабинете."""

from collections.abc import Awaitable, Callable
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import AwareDatetime

from app.modules.identity.public import Actor
from app.modules.scheduling.application.lesson_contracts import LessonCursor
from app.modules.scheduling.application.services.lesson_collection import LessonServices
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import ReplyState
from app.modules.scheduling.presentation.http.lesson_schemas import (
    CursorView,
    LessonPage,
    OwnLessonView,
    ReplyInput,
)
from app.shared.presentation.http import RequestAccess, require_json


def lesson_cursor(start: AwareDatetime | None, identifier: UUID | None) -> LessonCursor | None:
    if (start is None) != (identifier is None):
        raise LessonError("invalid_lesson_cursor")

    return LessonCursor(start, identifier) if start is not None and identifier is not None else None


def lesson_participation_router(
    prefix: str,
    access: RequestAccess[Actor],
    get_services: Callable[[Request], Awaitable[LessonServices]],
) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=["Собственные занятия"])


    @router.get("/{card_id}/lessons")
    async def lessons(
        card_id: UUID,
        actor: Annotated[Actor, Depends(access.read)],
        services: Annotated[LessonServices, Depends(get_services)],
        from_: Annotated[AwareDatetime, Query(alias="from")],
        to: AwareDatetime,
        limit: Annotated[int | None, Query(ge=1)] = None,
        after_start: AwareDatetime | None = None,
        after_id: UUID | None = None,
        group_id: UUID | None = None,
    ) -> LessonPage[OwnLessonView]:
        limit = services.policy.page_size(limit)

        rows = await services.queries.list_own(
            actor, card_id, from_, to, lesson_cursor(after_start, after_id), limit, group_id
        )
        next_after = (
            CursorView(
                starts_at=rows[limit - 1].lesson.conditions.starts_at, id=rows[limit - 1].lesson.id
            )
            if len(rows) > limit
            else None
        )

        return LessonPage(
            items=[OwnLessonView.from_result(row) for row in rows[:limit]], next_after=next_after
        )


    @router.get("/{card_id}/lessons/{lesson_id}")
    async def lesson(
        card_id: UUID,
        lesson_id: UUID,
        actor: Annotated[Actor, Depends(access.read)],
        services: Annotated[LessonServices, Depends(get_services)],
    ) -> OwnLessonView:
        return OwnLessonView.from_result(await services.queries.get_own(actor, card_id, lesson_id))


    @router.post("/{card_id}/lessons/{lesson_id}/reply")
    async def reply(
        card_id: UUID,
        lesson_id: UUID,
        command: ReplyInput,
        request: Request,
        actor: Annotated[Actor, Depends(access.write)],
        services: Annotated[LessonServices, Depends(get_services)],
    ) -> OwnLessonView:
        require_json(request)

        return OwnLessonView.from_result(
            await services.replies.reply(
                actor, card_id, lesson_id, ReplyState(command.answer), command.expected_version
            )
        )


    return router
