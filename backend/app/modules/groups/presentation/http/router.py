"""Тонкая HTTP-граница управления группами и условиями участия."""

from collections.abc import Awaitable, Callable
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request

from app.modules.groups.application.contracts import DEFAULT_PAGE_SIZE
from app.modules.groups.application.services.collection import GroupServices
from app.modules.groups.presentation.http.participation_router import participation_router
from app.modules.groups.presentation.http.schemas import (
    Amount,
    GroupCreate,
    GroupPatch,
    GroupView,
    MemberCreate,
    MemberPatch,
    MemberPrice,
    MemberView,
    Page,
    PageSize,
)
from app.modules.identity.public import Actor
from app.shared.presentation.http import RequestAccess, require_json


def groups_router(
    get_services: Callable[[Request], Awaitable[GroupServices]],
    teacher: RequestAccess[Actor],
    student: RequestAccess[Actor],
    adult: RequestAccess[Actor],
) -> APIRouter:
    router = APIRouter(tags=["Группы"])


    @router.post("/groups", status_code=201)
    async def create(
        command: GroupCreate,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[GroupServices, Depends(get_services)],
    ) -> GroupView:
        require_json(request)

        return GroupView.from_overview(
            await services.groups.create(actor, command.name, command.notes)
        )


    @router.get("/groups")
    async def groups(
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[GroupServices, Depends(get_services)],
        limit: PageSize = DEFAULT_PAGE_SIZE,
        after_id: UUID | None = None,
        include_archived: bool = False,
    ) -> Page[GroupView]:
        rows = await services.groups.list(actor, include_archived, after_id, limit)

        return Page(
            items=[GroupView.from_overview(row) for row in rows[:limit]],
            next_after=rows[limit - 1].group.id if len(rows) > limit else None,
        )


    @router.get("/groups/{group_id}")
    async def group(
        group_id: UUID,
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[GroupServices, Depends(get_services)],
    ) -> GroupView:
        return GroupView.from_overview(await services.groups.get(actor, group_id))


    @router.patch("/groups/{group_id}")
    async def update(
        group_id: UUID,
        command: GroupPatch,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[GroupServices, Depends(get_services)],
    ) -> GroupView:
        require_json(request)

        return GroupView.from_overview(
            await services.groups.update(actor, group_id, command.model_dump(exclude_unset=True))
        )


    @router.post("/groups/{group_id}/archive")
    async def archive(
        group_id: UUID,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[GroupServices, Depends(get_services)],
    ) -> GroupView:
        return GroupView.from_overview(await services.groups.archive(actor, group_id, True))


    @router.post("/groups/{group_id}/restore")
    async def restore(
        group_id: UUID,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[GroupServices, Depends(get_services)],
    ) -> GroupView:
        return GroupView.from_overview(await services.groups.archive(actor, group_id, False))


    @router.delete("/groups/{group_id}", status_code=204)
    async def delete(
        group_id: UUID,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[GroupServices, Depends(get_services)],
    ) -> None:
        await services.groups.delete(actor, group_id)


    @router.post("/groups/{group_id}/members", status_code=201)
    async def add_member(
        group_id: UUID,
        command: MemberCreate,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[GroupServices, Depends(get_services)],
    ) -> MemberView:
        require_json(request)

        row = await services.memberships.add(
            actor, group_id, command.card_id, command.price.to_price()
        )

        return MemberView(
            card_id=row.member.card_id, name=row.name, price=Amount(amount=row.member.price.amount)
        )


    @router.get("/groups/{group_id}/members")
    async def members(
        group_id: UUID,
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[GroupServices, Depends(get_services)],
        limit: PageSize = DEFAULT_PAGE_SIZE,
        after_id: UUID | None = None,
    ) -> Page[MemberView]:
        rows = await services.memberships.list(actor, group_id, after_id, limit)

        return Page(
            items=[
                MemberView(
                    card_id=row.member.card_id,
                    name=row.name,
                    price=Amount(amount=row.member.price.amount),
                )
                for row in rows[:limit]
            ],
            next_after=rows[limit - 1].member.card_id if len(rows) > limit else None,
        )


    @router.patch("/groups/{group_id}/members/{card_id}")
    async def update_member(
        group_id: UUID,
        card_id: UUID,
        command: MemberPatch,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[GroupServices, Depends(get_services)],
    ) -> MemberPrice:
        require_json(request)

        return MemberPrice.from_member(
            await services.memberships.update(actor, group_id, card_id, command.price.to_price())
        )


    @router.delete("/groups/{group_id}/members/{card_id}", status_code=204)
    async def remove_member(
        group_id: UUID,
        card_id: UUID,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[GroupServices, Depends(get_services)],
    ) -> None:
        await services.memberships.remove(actor, group_id, card_id)


    router.include_router(participation_router("/me/teachers", student, get_services))
    router.include_router(participation_router("/me/students", adult, get_services))

    return router
