"""Тонкие преподавательские маршруты создания, изменения и истории занятий."""

from collections.abc import Awaitable, Callable
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import AwareDatetime

from app.modules.identity.public import Actor
from app.modules.scheduling.application.services.lesson_collection import LessonServices
from app.modules.scheduling.presentation.http.lesson_participation_router import (
    lesson_cursor,
    lesson_participation_router,
)
from app.modules.scheduling.presentation.http.lesson_schemas import (
    CursorView,
    HistoryPage,
    LessonCreate,
    LessonOperationView,
    LessonPage,
    LessonUpdate,
    LessonView,
    PreferencesInput,
    PreferencesView,
    RevisionView,
)
from app.shared.presentation.http import RequestAccess, require_json


def lessons_router(
    get_services: Callable[[Request], Awaitable[LessonServices]],
    teacher: RequestAccess[Actor],
    student: RequestAccess[Actor],
    adult: RequestAccess[Actor],
) -> APIRouter:
    router = APIRouter(tags=["Занятия"])


    @router.post("/lessons", status_code=201)
    async def create(
        command: LessonCreate,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[LessonServices, Depends(get_services)],
    ) -> LessonOperationView:
        require_json(request)

        return LessonOperationView.from_result(
            await services.creation.create(actor, command.to_command())
        )


    @router.get("/lessons")
    async def lessons(
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[LessonServices, Depends(get_services)],
        from_: Annotated[AwareDatetime, Query(alias="from")],
        to: AwareDatetime,
        limit: Annotated[int | None, Query(ge=1)] = None,
        after_start: AwareDatetime | None = None,
        after_id: UUID | None = None,
        group_id: UUID | None = None,
    ) -> LessonPage[LessonView]:
        limit = services.policy.page_size(limit)

        rows = await services.queries.list_lessons(
            actor, from_, to, lesson_cursor(after_start, after_id), limit, group_id
        )
        next_after = (
            CursorView(
                starts_at=rows[limit - 1].lesson.conditions.starts_at, id=rows[limit - 1].lesson.id
            )
            if len(rows) > limit
            else None
        )

        return LessonPage(
            items=[LessonView.from_lesson(row.lesson, row.observed_at) for row in rows[:limit]],
            next_after=next_after,
        )


    @router.get("/lessons/{lesson_id}")
    async def lesson(
        lesson_id: UUID,
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[LessonServices, Depends(get_services)],
    ) -> LessonOperationView:
        return LessonOperationView.from_result(await services.queries.get(actor, lesson_id))


    @router.patch("/lessons/{lesson_id}")
    async def update(
        lesson_id: UUID,
        command: LessonUpdate,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[LessonServices, Depends(get_services)],
    ) -> LessonOperationView:
        require_json(request)

        return LessonOperationView.from_result(
            await services.changes.update(actor, lesson_id, command.to_command())
        )


    @router.delete("/lessons/{lesson_id}", status_code=204)
    async def remove(
        lesson_id: UUID,
        expected_version: Annotated[int, Query(ge=1)],
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[LessonServices, Depends(get_services)],
    ) -> None:
        await services.changes.remove(actor, lesson_id, expected_version)


    @router.get("/lessons/{lesson_id}/history")
    async def history(
        lesson_id: UUID,
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[LessonServices, Depends(get_services)],
        limit: Annotated[int | None, Query(ge=1)] = None,
        after_id: UUID | None = None,
    ) -> HistoryPage:
        limit = services.policy.page_size(limit)

        rows = await services.queries.history(actor, lesson_id, after_id, limit)

        return HistoryPage(
            items=[
                RevisionView(
                    id=row.id,
                    actor_id=row.actor_id,
                    happened_at=row.happened_at,
                    kind=row.kind,
                    lesson=LessonView.from_lesson(row.lesson, row.happened_at),
                )
                for row in rows[:limit]
            ],
            next_after=rows[limit - 1].id if len(rows) > limit else None,
        )


    @router.get("/me/teaching-settings")
    async def preferences(
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[LessonServices, Depends(get_services)],
    ) -> PreferencesView:
        return PreferencesView.from_preferences(
            await services.preferences.get(actor), services.policy.default_duration_minutes
        )


    @router.patch("/me/teaching-settings")
    async def change_preferences(
        command: PreferencesInput,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[LessonServices, Depends(get_services)],
    ) -> PreferencesView:
        require_json(request)

        return PreferencesView.from_preferences(
            await services.preferences.update(actor, command.to_command()),
            services.policy.default_duration_minutes,
        )


    @router.get("/groups/{group_id}/lessons")
    async def group_lessons(
        group_id: UUID,
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[LessonServices, Depends(get_services)],
        from_: Annotated[AwareDatetime, Query(alias="from")],
        to: AwareDatetime,
        limit: Annotated[int | None, Query(ge=1)] = None,
        after_start: AwareDatetime | None = None,
        after_id: UUID | None = None,
    ) -> LessonPage[LessonView]:
        limit = services.policy.page_size(limit)

        rows = await services.queries.list_for_group(
            actor, group_id, from_, to, lesson_cursor(after_start, after_id), limit
        )
        next_after = (
            CursorView(
                starts_at=rows[limit - 1].lesson.conditions.starts_at, id=rows[limit - 1].lesson.id
            )
            if len(rows) > limit
            else None
        )

        return LessonPage(
            items=[LessonView.from_lesson(row.lesson, row.observed_at) for row in rows[:limit]],
            next_after=next_after,
        )


    router.include_router(lesson_participation_router("/me/teachers", student, get_services))
    router.include_router(lesson_participation_router("/me/students", adult, get_services))

    return router
