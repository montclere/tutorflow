"""HTTP-адаптер регистрации, сессий и собственного профиля аккаунта."""

from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response

from app.modules.identity.application.contracts import SignedIn
from app.modules.identity.application.services.authentication import AuthenticationService
from app.modules.identity.application.services.profiles import ProfileService
from app.modules.identity.application.services.registration import RegistrationService
from app.modules.identity.application.services.roles import RoleService
from app.modules.identity.domain.entities import Account
from app.modules.identity.domain.exceptions import IdentityError
from app.modules.identity.domain.values import Role
from app.modules.identity.presentation.http.schemas import (
    AccountView,
    ChildPassword,
    CompleteRegistration,
    CsrfView,
    Login,
    LoginContact,
    Profile,
    ProfilePatch,
    RegistrationView,
    SessionView,
    StartRegistration,
)
from app.modules.identity.presentation.http.session import IdentityHttpSession, raise_identity_error
from app.shared.presentation.http import request_ip, require_json


def account_view(account: Account) -> AccountView:
    return AccountView(
        id=account.id,
        roles=sorted(account.roles, key=lambda role: role.value),
        workspace_id=account.id,
        login_contact=LoginContact.model_validate(
            {"type": account.contact.kind.value, "value": account.contact.value}
        ),
    )


def session_view(response: Response, session: IdentityHttpSession, result: SignedIn) -> SessionView:
    session.set_cookie(response, result)

    return SessionView(account=account_view(result.account), csrf_token=result.csrf_token)


def identity_router(
    get_session: Callable[[Request], Awaitable[IdentityHttpSession]],
    require_session: Callable[[Request], Awaitable[IdentityHttpSession]],
    get_registration: Callable[[Request], Awaitable[RegistrationService]],
    get_authentication: Callable[[Request], Awaitable[AuthenticationService]],
    get_profile: Callable[[Request], Awaitable[ProfileService]],
    get_roles: Callable[[Request], Awaitable[RoleService]],
) -> APIRouter:
    router = APIRouter(tags=["Аккаунт"])


    @router.post("/auth/registrations", status_code=202)
    async def register(
        command: StartRegistration,
        request: Request,
        background: BackgroundTasks,
        registration: Annotated[RegistrationService, Depends(get_registration)],
    ) -> RegistrationView:
        require_json(request)

        contact = command.login_contact.to_input()

        try:
            challenge_id = await registration.start(contact, request_ip(request))
        except IdentityError as error:
            raise_identity_error(error)

        background.add_task(registration.deliver_pending, challenge_id)

        return RegistrationView(challenge_id=challenge_id)


    @router.post("/auth/registrations/complete", status_code=201)
    async def complete(
        command: CompleteRegistration,
        request: Request,
        response: Response,
        session: Annotated[IdentityHttpSession, Depends(get_session)],
        registration: Annotated[RegistrationService, Depends(get_registration)],
    ) -> SessionView:
        require_json(request)

        try:
            result = await registration.complete(
                command.challenge_id,
                command.code,
                command.password.get_secret_value(),
                request_ip(request),
                session.token(request),
            )
        except IdentityError as error:
            raise_identity_error(error)

        return session_view(response, session, result)


    @router.post("/auth/login")
    async def login(
        command: Login,
        request: Request,
        response: Response,
        session: Annotated[IdentityHttpSession, Depends(get_session)],
        authentication: Annotated[AuthenticationService, Depends(get_authentication)],
    ) -> SessionView:
        require_json(request)

        try:
            result = await authentication.login(
                command.login_contact.to_input(),
                command.password.get_secret_value(),
                request_ip(request),
                session.token(request),
                role=command.role,
            )
        except IdentityError as error:
            raise_identity_error(error)

        return session_view(response, session, result)


    @router.get("/auth/csrf")
    async def csrf_token(
        request: Request, session: Annotated[IdentityHttpSession, Depends(require_session)]
    ) -> CsrfView:
        current = await session.authenticate(request)

        return CsrfView(csrf_token=session.csrf_token(current))


    @router.delete("/auth/session", status_code=204)
    async def logout(
        request: Request,
        response: Response,
        session: Annotated[IdentityHttpSession, Depends(require_session)],
    ) -> None:
        current = await session.authenticate(request, csrf=True)

        await session.logout(current, response)


    @router.get("/me")
    async def me(
        request: Request,
        session: Annotated[IdentityHttpSession, Depends(require_session)],
        role: Role | None = None,
    ) -> AccountView:
        current = await session.authenticate(request)

        if role is not None:
            current.account.require_role(role)

        return account_view(current.account)


    @router.post("/me/roles/teacher")
    async def activate_teacher(
        request: Request,
        session: Annotated[IdentityHttpSession, Depends(require_session)],
        roles: Annotated[RoleService, Depends(get_roles)],
    ) -> AccountView:
        current = await session.authenticate(request, csrf=True)

        return account_view(await roles.activate_teacher(current.account.id))


    @router.put("/me/child-account/password", status_code=204)
    async def change_child_password(
        command: ChildPassword,
        request: Request,
        response: Response,
        session: Annotated[IdentityHttpSession, Depends(require_session)],
        authentication: Annotated[AuthenticationService, Depends(get_authentication)],
    ) -> None:
        require_json(request)

        current = await session.authenticate(request, csrf=True)

        await authentication.change_child_password(
            current.account.id, command.password.get_secret_value(), current.token
        )
        session.clear_cookie(response)


    @router.get("/me/profile")
    async def profile(
        request: Request, session: Annotated[IdentityHttpSession, Depends(require_session)]
    ) -> Profile:
        current = await session.authenticate(request)

        return Profile.model_validate(current.account.profile)


    @router.patch("/me/profile")
    async def change_profile(
        command: ProfilePatch,
        request: Request,
        session: Annotated[IdentityHttpSession, Depends(require_session)],
        profiles: Annotated[ProfileService, Depends(get_profile)],
    ) -> Profile:
        require_json(request)

        current = await session.authenticate(request, csrf=True)

        try:
            updated = await profiles.update(current.account.id, command.change)
        except IdentityError as error:
            raise_identity_error(error)

        return Profile.model_validate(updated.profile)


    return router
