"""Преподавательский API назначения единственного ответственного за расписание."""

from collections.abc import Awaitable, Callable
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict

from app.modules.identity.public import Actor, Role
from app.modules.students.application.services.collection import StudentServices
from app.shared.presentation.http import RequestAccess, require_json


class AssignmentInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    account_id: UUID


class AssignmentView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    card_id: UUID
    account_id: UUID | None
    role: Role | None
    category: Literal["scheduling"] = "scheduling"


def responsibilities_router(
    get_services: Callable[[Request], Awaitable[StudentServices]], teacher: RequestAccess[Actor]
) -> APIRouter:
    router = APIRouter(prefix="/students/cards", tags=["Полномочия карточки"])


    @router.get("/{card_id}/responsibilities/scheduling")
    async def responsibility(
        card_id: UUID,
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> AssignmentView:
        return AssignmentView.model_validate(await services.responsibilities.get(actor, card_id))


    @router.put("/{card_id}/responsibilities/scheduling")
    async def assign(
        card_id: UUID,
        command: AssignmentInput,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> AssignmentView:
        require_json(request)

        return AssignmentView.model_validate(
            await services.responsibilities.assign(actor, card_id, command.account_id)
        )


    return router
