"""HTTP-граница приглашений, подключений и разрешённого обзора взрослого."""

from collections.abc import Awaitable, Callable
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response

from app.modules.identity.public import Actor, InvitedSession
from app.modules.students.application.contracts import DEFAULT_PAGE_SIZE
from app.modules.students.application.services.collection import AdultServices
from app.modules.students.presentation.http.schemas import (
    AdultPreviewView,
    AdultProfileView,
    AdultSessionView,
    AdultStudentView,
    ChallengeView,
    ConnectionView,
    InvitationSummary,
    InvitationView,
    InvitedRegistrationComplete,
    InvitedRegistrationStart,
    Page,
    PageSize,
    Price,
    PublicProfileView,
    Token,
    Welcome,
)
from app.shared.presentation.http import request_ip, require_json


def adult_access_router(
    get_services: Callable[[Request], Awaitable[AdultServices]],
    read_actor: Callable[[Request], Awaitable[Actor]],
    write_actor: Callable[[Request], Awaitable[Actor]],
    previous_session: Callable[[Request], Awaitable[str | None]],
    set_session: Callable[[Request, Response, InvitedSession], Awaitable[None]],
) -> APIRouter:
    router = APIRouter(tags=["Доступ взрослых"])


    @router.post("/students/cards/{card_id}/adult-invitations", status_code=201)
    async def issue(
        card_id: UUID,
        command: Welcome,
        request: Request,
        actor: Annotated[Actor, Depends(write_actor)],
        services: Annotated[AdultServices, Depends(get_services)],
    ) -> InvitationView:
        require_json(request)

        invitation = await services.invitations.issue(actor, card_id, command.welcome)

        return InvitationView(
            id=invitation.id, token=invitation.token, expires_at=invitation.expires_at
        )


    @router.get("/students/cards/{card_id}/adult-invitations")
    async def invitations(
        card_id: UUID,
        actor: Annotated[Actor, Depends(read_actor)],
        services: Annotated[AdultServices, Depends(get_services)],
    ) -> list[InvitationSummary]:
        return [
            InvitationSummary.model_validate(item)
            for item in await services.invitations.list(actor, card_id)
        ]


    @router.delete("/students/cards/{card_id}/adult-invitations/{invitation_id}", status_code=204)
    async def revoke(
        card_id: UUID,
        invitation_id: UUID,
        actor: Annotated[Actor, Depends(write_actor)],
        services: Annotated[AdultServices, Depends(get_services)],
    ) -> None:
        await services.invitations.revoke(actor, card_id, invitation_id)


    @router.post(
        "/students/cards/{card_id}/adult-invitations/{invitation_id}/reissue", status_code=201
    )
    async def reissue(
        card_id: UUID,
        invitation_id: UUID,
        actor: Annotated[Actor, Depends(write_actor)],
        services: Annotated[AdultServices, Depends(get_services)],
    ) -> InvitationView:
        invitation = await services.invitations.reissue(actor, card_id, invitation_id)

        return InvitationView(
            id=invitation.id, token=invitation.token, expires_at=invitation.expires_at
        )


    @router.get("/students/cards/{card_id}/adults")
    async def adults(
        card_id: UUID,
        actor: Annotated[Actor, Depends(read_actor)],
        services: Annotated[AdultServices, Depends(get_services)],
    ) -> list[PublicProfileView]:
        return [
            PublicProfileView.model_validate(profile)
            for profile in await services.connections.adults(actor, card_id)
        ]


    @router.delete("/students/cards/{card_id}/adults/{account_id}", status_code=204)
    async def remove_adult(
        card_id: UUID,
        account_id: UUID,
        actor: Annotated[Actor, Depends(write_actor)],
        services: Annotated[AdultServices, Depends(get_services)],
    ) -> None:
        await services.connections.disconnect_owned(actor, card_id, account_id)


    @router.post("/adult-invitations/preview")
    async def preview(
        command: Token, request: Request, services: Annotated[AdultServices, Depends(get_services)]
    ) -> AdultPreviewView:
        require_json(request)

        return AdultPreviewView.model_validate(
            await services.invitations.preview(
                command.token.get_secret_value(), request_ip(request)
            )
        )


    @router.post("/adult-invitations/accept", status_code=201)
    async def accept(
        command: Token,
        request: Request,
        actor: Annotated[Actor, Depends(write_actor)],
        services: Annotated[AdultServices, Depends(get_services)],
    ) -> ConnectionView:
        require_json(request)

        return ConnectionView.model_validate(
            await services.connections.accept(
                actor, command.token.get_secret_value(), request_ip(request)
            )
        )


    @router.post("/adult-invitations/registrations", status_code=202)
    async def start_registration(
        command: InvitedRegistrationStart,
        request: Request,
        background: BackgroundTasks,
        services: Annotated[AdultServices, Depends(get_services)],
    ) -> ChallengeView:
        require_json(request)

        challenge_id = await services.registration.start(
            command.token.get_secret_value(),
            command.kind,
            command.contact.get_secret_value(),
            request_ip(request),
        )

        background.add_task(services.registration.deliver_pending, challenge_id)

        return ChallengeView(challenge_id=challenge_id)


    @router.post("/adult-invitations/registrations/complete", status_code=201)
    async def complete_registration(
        command: InvitedRegistrationComplete,
        request: Request,
        response: Response,
        services: Annotated[AdultServices, Depends(get_services)],
    ) -> AdultSessionView:
        require_json(request)

        session = await services.registration.complete(
            command.token.get_secret_value(),
            command.challenge_id,
            command.code.get_secret_value(),
            command.password.get_secret_value(),
            request_ip(request),
            await previous_session(request),
        )

        await set_session(request, response, session)

        return AdultSessionView(account_id=session.account_id, csrf_token=session.csrf_token)


    @router.get("/me/students")
    async def students(
        actor: Annotated[Actor, Depends(read_actor)],
        services: Annotated[AdultServices, Depends(get_services)],
        limit: PageSize = DEFAULT_PAGE_SIZE,
        after_id: UUID | None = None,
    ) -> Page[AdultStudentView]:
        rows = await services.connections.students(actor, after_id, limit)

        return Page(
            items=[AdultStudentView.model_validate(row) for row in rows[:limit]],
            next_after=rows[limit - 1].card_id if len(rows) > limit else None,
        )


    @router.get("/me/students/{card_id}/profiles")
    async def profiles(
        card_id: UUID,
        actor: Annotated[Actor, Depends(read_actor)],
        services: Annotated[AdultServices, Depends(get_services)],
        limit: PageSize = DEFAULT_PAGE_SIZE,
        after_id: UUID | None = None,
    ) -> Page[AdultProfileView]:
        rows = await services.connections.profiles(actor, card_id, after_id, limit)

        return Page(
            items=[
                AdultProfileView(
                    id=row.id, subject=row.subject, price=Price(amount=row.price.amount)
                )
                for row in rows[:limit]
            ],
            next_after=rows[limit - 1].id if len(rows) > limit else None,
        )


    @router.delete("/me/students/{card_id}/connection", status_code=204)
    async def disconnect(
        card_id: UUID,
        actor: Annotated[Actor, Depends(write_actor)],
        services: Annotated[AdultServices, Depends(get_services)],
    ) -> None:
        await services.connections.disconnect(actor, card_id)


    return router
