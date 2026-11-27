"""Собственное расписание и ответ ответственного из кабинета ученика или взрослого."""

from collections.abc import Awaitable, Callable
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request

from app.modules.identity.public import Actor
from app.modules.scheduling.application.services.series_collection import SeriesServices
from app.modules.scheduling.domain.lessons import ReplyState
from app.modules.scheduling.presentation.http.lesson_schemas import ReplyInput
from app.modules.scheduling.presentation.http.series_schemas import OwnSeriesView
from app.shared.presentation.http import RequestAccess, require_json


def series_participation_router(
    prefix: str,
    access: RequestAccess[Actor],
    get_services: Callable[[Request], Awaitable[SeriesServices]],
) -> APIRouter:
    router = APIRouter(prefix=prefix)


    @router.get("/{card_id}/lesson-series/{series_id}")
    async def get(
        card_id: UUID,
        series_id: UUID,
        actor: Annotated[Actor, Depends(access.read)],
        services: Annotated[SeriesServices, Depends(get_services)],
    ) -> OwnSeriesView:
        return OwnSeriesView.from_result(await services.queries.own(actor, card_id, series_id))


    @router.post("/{card_id}/lesson-series/{series_id}/reply")
    async def reply(
        card_id: UUID,
        series_id: UUID,
        command: ReplyInput,
        request: Request,
        actor: Annotated[Actor, Depends(access.write)],
        services: Annotated[SeriesServices, Depends(get_services)],
    ) -> OwnSeriesView:
        require_json(request)

        return OwnSeriesView.from_result(
            await services.replies.reply(
                actor, card_id, series_id, ReplyState(command.answer), command.expected_version
            )
        )


    return router
