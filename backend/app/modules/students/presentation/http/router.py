"""Тонкие HTTP-адаптеры карточек, приглашений и подключений."""

from collections.abc import Awaitable, Callable
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response

from app.modules.identity.public import Actor, InvitedSession, Principal
from app.modules.students.application.contracts import DEFAULT_PAGE_SIZE, CardDetails
from app.modules.students.application.services.collection import StudentServices
from app.modules.students.domain.entities import LearningProfile
from app.modules.students.domain.values import Money
from app.modules.students.presentation.http.schemas import (
    CardCreate,
    CardPatch,
    CardView,
    ChallengeView,
    ConnectionView,
    InvitationView,
    InvitedRegistrationComplete,
    InvitedRegistrationStart,
    Page,
    PageSize,
    PreviewView,
    Price,
    ProfileInput,
    ProfileView,
    PublicProfileView,
    StudentSessionView,
    TeacherView,
    Token,
    Welcome,
)
from app.shared.presentation.http import RequestAccess, request_ip, require_json


def card_view(details: CardDetails) -> CardView:
    card = details.card

    return CardView(
        id=card.id,
        teacher_id=card.teacher_id,
        name=card.name,
        notes=card.notes,
        archived=card.archived,
        account_id=details.account_id,
    )


def profile_view(profile: LearningProfile) -> ProfileView:
    return ProfileView(
        id=profile.id,
        card_id=profile.card_id,
        price=Price(amount=profile.price.amount),
        **{
            name: getattr(profile, name)
            for name in ("subject", "level", "goal", "duration", "description")
        },
    )


def students_router(
    get_services: Callable[[Request], Awaitable[StudentServices]],
    teacher: RequestAccess[Actor],
    student: RequestAccess[Actor],
    principal: RequestAccess[Principal],
    previous_session: Callable[[Request], Awaitable[str | None]],
    set_session: Callable[[Request, Response, InvitedSession], Awaitable[None]],
) -> APIRouter:
    router = APIRouter(tags=["Ученики"])


    @router.post("/students/cards", status_code=201)
    async def create_card(
        command: CardCreate,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> CardView:
        require_json(request)

        return card_view(await services.cards.create(actor, command.name, command.notes))


    @router.get("/students/cards")
    async def list_cards(
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[StudentServices, Depends(get_services)],
        limit: PageSize = DEFAULT_PAGE_SIZE,
        after_id: UUID | None = None,
        include_archived: bool = False,
    ) -> Page[CardView]:
        rows = await services.cards.list(actor, include_archived, after_id, limit)

        return Page(
            items=[card_view(row) for row in rows[:limit]],
            next_after=rows[limit - 1].card.id if len(rows) > limit else None,
        )


    @router.get("/students/cards/{card_id}")
    async def get_card(
        card_id: UUID,
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> CardView:
        return card_view(await services.cards.get(actor, card_id))


    @router.patch("/students/cards/{card_id}")
    async def update_card(
        card_id: UUID,
        command: CardPatch,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> CardView:
        require_json(request)

        return card_view(
            await services.cards.update(actor, card_id, command.model_dump(exclude_unset=True))
        )


    @router.post("/students/cards/{card_id}/archive")
    async def archive_card(
        card_id: UUID,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> CardView:
        return card_view(await services.cards.archive(actor, card_id, True))


    @router.post("/students/cards/{card_id}/restore")
    async def restore_card(
        card_id: UUID,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> CardView:
        return card_view(await services.cards.archive(actor, card_id, False))


    @router.delete("/students/cards/{card_id}", status_code=204)
    async def delete_card(
        card_id: UUID,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> None:
        await services.cards.delete(actor, card_id)


    @router.get("/students/cards/{card_id}/account")
    async def account_profile(
        card_id: UUID,
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> PublicProfileView:
        return PublicProfileView.model_validate(
            await services.cards.account_profile(actor, card_id)
        )


    @router.post("/students/cards/{card_id}/profiles", status_code=201)
    async def create_profile(
        card_id: UUID,
        command: ProfileInput,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> ProfileView:
        require_json(request)

        value = await services.profiles.save(
            actor,
            card_id,
            None,
            Money(command.price.amount, command.price.currency),
            command.model_dump(exclude={"price"}),
        )

        return profile_view(value)


    @router.put("/students/cards/{card_id}/profiles/{profile_id}")
    async def update_profile(
        card_id: UUID,
        profile_id: UUID,
        command: ProfileInput,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> ProfileView:
        require_json(request)

        value = await services.profiles.save(
            actor,
            card_id,
            profile_id,
            Money(command.price.amount, command.price.currency),
            command.model_dump(exclude={"price"}),
        )

        return profile_view(value)


    @router.get("/students/cards/{card_id}/profiles")
    async def list_profiles(
        card_id: UUID,
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[StudentServices, Depends(get_services)],
        limit: PageSize = DEFAULT_PAGE_SIZE,
        after_id: UUID | None = None,
    ) -> Page[ProfileView]:
        rows = await services.profiles.list(actor, card_id, after_id, limit)

        return Page(
            items=[profile_view(row) for row in rows[:limit]],
            next_after=rows[limit - 1].id if len(rows) > limit else None,
        )


    @router.get("/students/cards/{card_id}/profiles/{profile_id}")
    async def get_profile(
        card_id: UUID,
        profile_id: UUID,
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> ProfileView:
        return profile_view(await services.profiles.get(actor, card_id, profile_id))


    @router.delete("/students/cards/{card_id}/profiles/{profile_id}", status_code=204)
    async def delete_profile(
        card_id: UUID,
        profile_id: UUID,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> None:
        await services.profiles.delete(actor, card_id, profile_id)


    @router.post("/students/cards/{card_id}/invitation", status_code=201)
    async def issue_invitation(
        card_id: UUID,
        command: Welcome,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> InvitationView:
        require_json(request)

        result = await services.invitations.issue(actor, card_id, command.welcome)

        return InvitationView(id=result.id, token=result.token, expires_at=result.expires_at)


    @router.delete("/students/cards/{card_id}/invitation", status_code=204)
    async def revoke_invitation(
        card_id: UUID,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> None:
        await services.invitations.revoke(actor, card_id)


    @router.post("/student-invitations/preview")
    async def preview_invitation(
        command: Token,
        request: Request,
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> PreviewView:
        require_json(request)

        return PreviewView.model_validate(
            await services.invitations.preview(
                command.token.get_secret_value(), request_ip(request)
            )
        )


    @router.post("/student-invitations/accept", status_code=201)
    async def accept_invitation(
        command: Token,
        request: Request,
        actor: Annotated[Principal, Depends(principal.write)],
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> ConnectionView:
        require_json(request)

        return ConnectionView.model_validate(
            await services.connections.accept(
                actor, command.token.get_secret_value(), request_ip(request)
            )
        )


    @router.post("/student-invitations/registrations", status_code=202)
    async def start_student_registration(
        command: InvitedRegistrationStart,
        request: Request,
        background: BackgroundTasks,
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> ChallengeView:
        require_json(request)

        challenge = await services.registration.start(
            command.token.get_secret_value(),
            command.kind,
            command.contact.get_secret_value(),
            request_ip(request),
        )

        background.add_task(services.registration.deliver_pending, challenge)

        return ChallengeView(challenge_id=challenge)


    @router.post("/student-invitations/registrations/complete", status_code=201)
    async def complete_student_registration(
        command: InvitedRegistrationComplete,
        request: Request,
        response: Response,
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> StudentSessionView:
        require_json(request)

        result = await services.registration.complete(
            command.token.get_secret_value(),
            command.challenge_id,
            command.code.get_secret_value(),
            command.password.get_secret_value(),
            request_ip(request),
            await previous_session(request),
        )

        await set_session(request, response, result)

        return StudentSessionView(account_id=result.account_id, csrf_token=result.csrf_token)


    @router.get("/me/teachers")
    async def list_teachers(
        actor: Annotated[Actor, Depends(student.read)],
        services: Annotated[StudentServices, Depends(get_services)],
        limit: PageSize = DEFAULT_PAGE_SIZE,
        after_id: UUID | None = None,
    ) -> Page[TeacherView]:
        rows = await services.connections.list(actor, after_id, limit)

        return Page(
            items=[TeacherView.model_validate(row) for row in rows[:limit]],
            next_after=rows[limit - 1].card_id if len(rows) > limit else None,
        )


    @router.delete("/students/cards/{card_id}/connection", status_code=204)
    async def disconnect(
        card_id: UUID,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> None:
        await services.connections.disconnect(actor, card_id)


    @router.delete("/me/teachers/{card_id}/connection", status_code=204)
    async def disconnect_student(
        card_id: UUID,
        actor: Annotated[Actor, Depends(student.write)],
        services: Annotated[StudentServices, Depends(get_services)],
    ) -> None:
        await services.connections.disconnect(actor, card_id)


    return router
