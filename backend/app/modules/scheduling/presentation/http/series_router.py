"""Преподавательский API регулярного расписания, исключений, пауз и истории."""

from collections.abc import Awaitable, Callable
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query, Request
from pydantic import AwareDatetime

from app.modules.identity.public import Actor
from app.modules.scheduling.application.series_contracts import SeriesResult
from app.modules.scheduling.application.services.series_collection import SeriesServices
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.series import SeriesPause
from app.modules.scheduling.presentation.http.series_participation_router import (
    series_participation_router,
)
from app.modules.scheduling.presentation.http.series_schemas import (
    PauseInput,
    PrepareInput,
    SeriesCreateInput,
    SeriesOperationView,
    SeriesPage,
    SeriesRevisionView,
    SeriesUpdateInput,
    SeriesView,
    VersionInput,
)
from app.shared.presentation.http import RequestAccess, require_json


def series_router(
    get_services: Callable[[Request], Awaitable[SeriesServices]],
    teacher: RequestAccess[Actor],
    student: RequestAccess[Actor],
    adult: RequestAccess[Actor],
) -> APIRouter:
    router = APIRouter(tags=["Регулярное расписание"])


    @router.post("/lesson-series", status_code=201)
    async def create(
        command: SeriesCreateInput,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[SeriesServices, Depends(get_services)],
    ) -> SeriesOperationView:
        require_json(request)

        return SeriesOperationView.from_operation(
            await services.creation.create(actor, command.to_command())
        )


    @router.get("/lesson-series")
    async def listing(
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[SeriesServices, Depends(get_services)],
        limit: Annotated[int | None, Query(ge=1)] = None,
        after_id: UUID | None = None,
    ) -> SeriesPage[SeriesView]:
        limit = services.policy.page_size(limit)

        rows = await services.queries.list_series(actor, limit, after_id)

        return SeriesPage(
            items=[SeriesView.from_result(row) for row in rows[:limit]],
            next_after=rows[limit - 1].series.id if len(rows) > limit else None,
        )


    @router.get("/lesson-series/{series_id}")
    async def get(
        series_id: UUID,
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[SeriesServices, Depends(get_services)],
        from_: Annotated[AwareDatetime | None, Query(alias="from")] = None,
        to: AwareDatetime | None = None,
    ) -> SeriesOperationView:
        if (from_ is None) != (to is None):
            raise LessonError("invalid_lesson_range")

        return SeriesOperationView.from_operation(
            await services.queries.get(actor, series_id, from_, to)
        )


    @router.post("/lesson-series/{series_id}/prepare")
    async def prepare(
        series_id: UUID,
        command: PrepareInput,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[SeriesServices, Depends(get_services)],
    ) -> SeriesOperationView:
        require_json(request)

        return SeriesOperationView.from_operation(
            await services.queries.get(actor, series_id, command.starts_at, command.ends_at)
        )


    @router.patch("/lesson-series/{series_id}")
    async def update(
        series_id: UUID,
        command: SeriesUpdateInput,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[SeriesServices, Depends(get_services)],
    ) -> SeriesOperationView:
        require_json(request)

        return SeriesOperationView.from_operation(
            await services.changes.update(actor, series_id, command.to_command())
        )


    @router.delete("/lesson-series/{series_id}")
    async def remove(
        series_id: UUID,
        expected_version: Annotated[int, Query(ge=1)],
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[SeriesServices, Depends(get_services)],
        preview: bool = False,
        allow_confirmed: bool = False,
    ) -> SeriesOperationView:
        return SeriesOperationView.from_operation(
            await services.pauses.remove(
                actor, series_id, expected_version, preview=preview, allow_confirmed=allow_confirmed
            )
        )


    @router.post("/lesson-series/{series_id}/pauses")
    async def pause(
        series_id: UUID,
        command: PauseInput,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[SeriesServices, Depends(get_services)],
    ) -> SeriesOperationView:
        require_json(request)

        return SeriesOperationView.from_operation(
            await services.pauses.pause(
                actor,
                series_id,
                command.expected_version,
                SeriesPause(uuid4(), command.starts_at, command.ends_at),
                preview=command.preview,
                allow_confirmed=command.allow_confirmed,
            )
        )


    @router.post("/lesson-series/{series_id}/pauses/{pause_id}/resume")
    async def resume(
        series_id: UUID,
        pause_id: UUID,
        command: VersionInput,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[SeriesServices, Depends(get_services)],
    ) -> SeriesOperationView:
        require_json(request)

        return SeriesOperationView.from_operation(
            await services.pauses.resume(actor, series_id, pause_id, command.expected_version)
        )


    @router.get("/lesson-series/{series_id}/history")
    async def history(
        series_id: UUID,
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[SeriesServices, Depends(get_services)],
        limit: Annotated[int | None, Query(ge=1)] = None,
        after_id: UUID | None = None,
    ) -> SeriesPage[SeriesRevisionView]:
        limit = services.policy.page_size(limit)

        rows = await services.queries.history(actor, series_id, limit, after_id)

        return SeriesPage(
            items=[
                SeriesRevisionView(
                    id=row.id,
                    actor_id=row.actor_id,
                    happened_at=row.happened_at,
                    kind=row.kind,
                    series=SeriesView.from_result(SeriesResult(row.series, row.happened_at)),
                )
                for row in rows[:limit]
            ],
            next_after=rows[limit - 1].id if len(rows) > limit else None,
        )


    router.include_router(series_participation_router("/me/teachers", student, get_services))
    router.include_router(series_participation_router("/me/students", adult, get_services))

    return router
