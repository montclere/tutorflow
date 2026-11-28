"""API создания детского аккаунта и управления его входом."""

from collections.abc import Awaitable, Callable
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from app.modules.identity.public import Actor
from app.modules.students.application.services.child_accounts import ChildAccountService
from app.shared.presentation.http import RequestAccess, require_json


class ChildTransferInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target_id: UUID


class ChildCredentialsView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    account_id: UUID
    login: str = Field(repr=False)
    password: str = Field(repr=False)


class ChildManagementView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    account_id: UUID
    manager_id: UUID | None
    pending_manager_id: UUID | None


class TransferTargetView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    account_id: UUID
    display_name: str | None


class ChildAccountStatusView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    can_create: bool
    management: ChildManagementView | None
    transfer_targets: list[TransferTargetView]


def child_accounts_router(
    get_service: Callable[[Request], Awaitable[ChildAccountService]], adult: RequestAccess[Actor]
) -> APIRouter:
    router = APIRouter(tags=["Детский вход"])


    @router.get("/me/students/{card_id}/child-account")
    async def status(
        card_id: UUID,
        actor: Annotated[Actor, Depends(adult.read)],
        service: Annotated[ChildAccountService, Depends(get_service)],
    ) -> ChildAccountStatusView:
        return ChildAccountStatusView.model_validate(await service.status(actor, card_id))


    @router.post("/me/students/{card_id}/child-account", status_code=201)
    async def create(
        card_id: UUID,
        response: Response,
        actor: Annotated[Actor, Depends(adult.write)],
        service: Annotated[ChildAccountService, Depends(get_service)],
    ) -> ChildCredentialsView:
        response.headers["Cache-Control"] = "no-store"

        return ChildCredentialsView.model_validate(await service.create(actor, card_id))


    @router.post("/me/students/{card_id}/child-account/transfer", status_code=204)
    async def request_transfer(
        card_id: UUID,
        command: ChildTransferInput,
        request: Request,
        actor: Annotated[Actor, Depends(adult.write)],
        service: Annotated[ChildAccountService, Depends(get_service)],
    ) -> None:
        require_json(request)

        await service.request_transfer(actor, card_id, command.target_id)


    @router.post("/me/students/{card_id}/child-account/transfer/accept")
    async def accept_transfer(
        card_id: UUID,
        response: Response,
        actor: Annotated[Actor, Depends(adult.write)],
        service: Annotated[ChildAccountService, Depends(get_service)],
    ) -> ChildCredentialsView:
        response.headers["Cache-Control"] = "no-store"

        return ChildCredentialsView.model_validate(await service.accept_transfer(actor, card_id))


    @router.post("/me/child-accounts/{child_id}/password/reset")
    async def reset_password(
        child_id: UUID,
        response: Response,
        actor: Annotated[Actor, Depends(adult.write)],
        service: Annotated[ChildAccountService, Depends(get_service)],
    ) -> ChildCredentialsView:
        response.headers["Cache-Control"] = "no-store"

        return ChildCredentialsView.model_validate(await service.reset_password(actor, child_id))


    @router.get("/me/child-accounts")
    async def list_managed(
        response: Response,
        actor: Annotated[Actor, Depends(adult.read)],
        service: Annotated[ChildAccountService, Depends(get_service)],
    ) -> list[ChildManagementView]:
        response.headers["Cache-Control"] = "no-store"

        return [
            ChildManagementView.model_validate(child) for child in await service.list_managed(actor)
        ]


    @router.delete("/me/child-accounts/{child_id}/transfer", status_code=204)
    async def cancel_transfer(
        child_id: UUID,
        actor: Annotated[Actor, Depends(adult.write)],
        service: Annotated[ChildAccountService, Depends(get_service)],
    ) -> None:
        await service.cancel_transfer(actor, child_id)


    @router.delete("/me/child-accounts/{child_id}/management", status_code=204)
    async def release(
        child_id: UUID,
        actor: Annotated[Actor, Depends(adult.write)],
        service: Annotated[ChildAccountService, Depends(get_service)],
    ) -> None:
        await service.release(actor, child_id)


    return router
