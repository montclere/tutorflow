"""Маршруты групп собственной карточки в ученическом или взрослом контексте."""

from collections.abc import Awaitable, Callable
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request

from app.modules.groups.application.contracts import DEFAULT_PAGE_SIZE
from app.modules.groups.application.services.collection import GroupServices
from app.modules.groups.presentation.http.schemas import Page, PageSize, ParticipationView
from app.modules.identity.public import Actor
from app.shared.presentation.http import RequestAccess


def participation_router(
    prefix: str,
    access: RequestAccess[Actor],
    get_services: Callable[[Request], Awaitable[GroupServices]],
) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=["Собственные группы"])


    @router.get("/{card_id}/groups")
    async def groups(
        card_id: UUID,
        actor: Annotated[Actor, Depends(access.read)],
        services: Annotated[GroupServices, Depends(get_services)],
        limit: PageSize = DEFAULT_PAGE_SIZE,
        after_id: UUID | None = None,
    ) -> Page[ParticipationView]:
        rows = await services.participation.list(actor, card_id, after_id, limit)

        return Page(
            items=[ParticipationView.from_participation(row) for row in rows[:limit]],
            next_after=rows[limit - 1].group_id if len(rows) > limit else None,
        )


    @router.get("/{card_id}/groups/{group_id}")
    async def group(
        card_id: UUID,
        group_id: UUID,
        actor: Annotated[Actor, Depends(access.read)],
        services: Annotated[GroupServices, Depends(get_services)],
    ) -> ParticipationView:
        return ParticipationView.from_participation(
            await services.participation.get(actor, card_id, group_id)
        )


    return router
