import hmac
from collections.abc import Callable
from datetime import timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response

from app.shared.application.contracts.accounts import AccountSummary
from app.shared.application.ports.clock import now_utc
from app.shared.domain.errors import Problem
from app.shared.presentation.api.auth import RateLimiter
from app.shared.presentation.api.errors import problem_response
from app.shared.presentation.api.pagination import Pagination
from app.shared.presentation.api.schemas import AccountView, Page, ProfileView

from ..application.identity import Identity, NewSession
from ..domain.accounts import Session
from .schemas import (
    ChallengeResult,
    CsrfResult,
    Login,
    LoginResult,
    ProfileEdit,
    RegistrationComplete,
    RegistrationStart,
    ResetComplete,
    ResetStart,
    SessionView,
    TeacherCabinetView,
)


def identity_router(
    get_identity: Callable,
    get_session: Callable,
    get_actor: Callable,
    get_csrf: Callable,
    rate: RateLimiter,
    key: str,
    cookie_name: str,
    secure_cookie: bool,
) -> APIRouter:
    router = APIRouter(tags=["identity"])

    def set_cookie(response: Response, current: NewSession):
        lifetime = current.session.expires_at - current.session.created_at
        response.set_cookie(
            cookie_name,
            current.token,
            httponly=True,
            secure=secure_cookie,
            samesite="lax",
            path="/",
            max_age=int(lifetime.total_seconds()),
        )

    def clear_cookie(response: Response):
        response.delete_cookie(
            cookie_name, httponly=True, secure=secure_cookie, samesite="lax", path="/"
        )

    @router.get("/auth/csrf", response_model=CsrfResult)
    async def csrf(
        request: Request,
        response: Response,
        identity: Annotated[Identity, Depends(get_identity, scope="function")],
        session: Annotated[Session | None, Depends(get_session, scope="function")],
    ):
        if session is not None:
            if session.account_id is None:
                return {"csrf_token": session.csrf_token}
            try:
                await identity.actor(session)
            except Problem as problem:
                if problem.status != 401:
                    raise
            else:
                return {"csrf_token": session.csrf_token}
        await rate("session_issue", request.state.source, 100, 600)
        created = await identity.new_session()
        set_cookie(response, created)
        return {"csrf_token": created.session.csrf_token}

    @router.post("/auth/registrations", status_code=202, response_model=ChallengeResult)
    async def registration(
        data: RegistrationStart,
        request: Request,
        background_tasks: BackgroundTasks,
        identity: Annotated[Identity, Depends(get_identity, scope="function")],
        session: Annotated[Session, Depends(get_csrf, scope="function")],
    ):
        contact = data.login_contact.normalized()
        await rate("credential_send_ip", request.state.source, 60, 600)
        await rate("credential_send_contact", contact.value, 5, 3600)
        issued = await identity.registration(contact, data.invitation_token)
        background_tasks.add_task(identity.deliver_code, issued, request.state.request_id)
        return {"challenge_id": issued.challenge_id}

    @router.post("/auth/registrations/complete", status_code=201, response_model=LoginResult)
    async def complete_registration(
        data: RegistrationComplete,
        request: Request,
        response: Response,
        identity: Annotated[Identity, Depends(get_identity, scope="function")],
        session: Annotated[Session, Depends(get_csrf, scope="function")],
    ):
        await rate("credential_complete_ip", request.state.source, 100, 600)
        result = await identity.complete_registration(
            data.challenge_id,
            data.code,
            data.password,
            data.display_name,
            data.timezone,
            data.invitation_token,
            session,
        )
        if result is None:
            return problem_response(request, Problem("challenge_invalid", 400))
        account, created = result
        set_cookie(response, created)
        return {"account": account.self_view(), "csrf_token": created.session.csrf_token}

    @router.post("/auth/login", response_model=LoginResult)
    async def login(
        data: Login,
        request: Request,
        response: Response,
        identity: Annotated[Identity, Depends(get_identity, scope="function")],
        session: Annotated[Session, Depends(get_csrf, scope="function")],
    ):
        contact = data.login_contact.normalized()
        await rate("password_ip", request.state.source, 100, 600)
        await rate("password_contact", contact.value, 15, 600)
        account, created = await identity.login(contact, data.password, session)
        set_cookie(response, created)
        return {"account": account.self_view(), "csrf_token": created.session.csrf_token}

    @router.post("/auth/password-resets", status_code=202, response_model=ChallengeResult)
    async def reset(
        data: ResetStart,
        request: Request,
        background_tasks: BackgroundTasks,
        identity: Annotated[Identity, Depends(get_identity, scope="function")],
        session: Annotated[Session, Depends(get_csrf, scope="function")],
    ):
        contact = data.login_contact.normalized()
        await rate("credential_send_ip", request.state.source, 60, 600)
        await rate("credential_send_contact", contact.value, 5, 3600)
        issued = await identity.request_reset(contact)
        background_tasks.add_task(identity.deliver_code, issued, request.state.request_id)
        return {"challenge_id": issued.challenge_id}

    @router.post("/auth/password-resets/complete", status_code=204)
    async def reset_complete(
        data: ResetComplete,
        request: Request,
        response: Response,
        identity: Annotated[Identity, Depends(get_identity, scope="function")],
        session: Annotated[Session, Depends(get_csrf, scope="function")],
    ):
        await rate("credential_complete_ip", request.state.source, 100, 600)
        if not await identity.reset_password(data.challenge_id, data.code, data.password):
            return problem_response(request, Problem("challenge_invalid", 400))
        clear_cookie(response)
        response.status_code = 204
        return response

    @router.delete("/auth/session", status_code=204)
    async def logout(
        response: Response,
        identity: Annotated[Identity, Depends(get_identity, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
        session: Annotated[Session, Depends(get_csrf, scope="function")],
    ):
        await identity.store.revoke_session(session.session_id, actor.account_id, now_utc())
        clear_cookie(response)
        response.status_code = 204
        return response

    @router.get("/auth/sessions", response_model=Page[SessionView])
    async def sessions(
        identity: Annotated[Identity, Depends(get_identity, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
        session: Annotated[Session | None, Depends(get_session, scope="function")],
        limit: Annotated[int, Query(ge=1, le=100)] = 20,
        cursor: Annotated[str | None, Query(max_length=256)] = None,
    ):
        assert session is not None
        page = Pagination(key, f"session:{actor.account_id}", limit, cursor)
        now = now_utc()
        records = await identity.store.list_sessions(
            actor.account_id,
            now - timedelta(hours=identity.policy.session_idle_hours),
            now,
            limit + 1,
            page.position,
        )
        return page.result(
            records,
            lambda row: (row.created_at, row.session_id),
            lambda row: {
                "session_id": row.session_id,
                "created_at": row.created_at,
                "last_seen_at": row.last_seen_at,
                "expires_at": row.expires_at,
                "is_current": row.session_id == session.session_id,
            },
        )

    @router.delete("/auth/sessions/{session_id}", status_code=204)
    async def revoke_session(
        session_id: UUID,
        response: Response,
        identity: Annotated[Identity, Depends(get_identity, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
        session: Annotated[Session, Depends(get_csrf, scope="function")],
    ):
        if not await identity.store.revoke_session(session_id, actor.account_id, now_utc()):
            raise Problem("resource_not_found", 404)
        if session_id == session.session_id:
            clear_cookie(response)
        response.status_code = 204
        return response

    @router.post(
        "/auth/sessions/revoke-all",
        status_code=204,
        dependencies=[Depends(get_csrf, scope="function")],
    )
    async def revoke_all(
        response: Response,
        identity: Annotated[Identity, Depends(get_identity, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        await identity.store.get_account(actor.account_id, lock=True)
        await identity.store.revoke_sessions(actor.account_id, now_utc())
        clear_cookie(response)
        response.status_code = 204
        return response

    @router.get("/me", response_model=AccountView)
    async def me(
        identity: Annotated[Identity, Depends(get_identity, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        account = await identity.store.get_account(actor.account_id)
        if account is None:
            raise Problem("authentication_required", 401)
        return account.self_view()

    @router.get("/me/profile", response_model=ProfileView)
    async def profile(
        identity: Annotated[Identity, Depends(get_identity, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        return await identity.store.get_profile(actor.account_id)

    @router.patch(
        "/me/profile",
        response_model=ProfileView,
        dependencies=[Depends(get_csrf, scope="function")],
    )
    async def edit_profile(
        data: ProfileEdit,
        identity: Annotated[Identity, Depends(get_identity, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        result = await identity.store.edit_profile(
            actor.account_id,
            data.expected_version,
            data.model_dump(exclude_unset=True, exclude={"expected_version"}),
            now_utc(),
        )
        if result is None:
            raise Problem("version_conflict", 409)
        return result

    @router.put(
        "/me/teacher-cabinet",
        status_code=201,
        response_model=TeacherCabinetView,
        dependencies=[Depends(get_csrf, scope="function")],
        responses={200: {"model": TeacherCabinetView}},
    )
    async def teacher_cabinet(
        response: Response,
        identity: Annotated[Identity, Depends(get_identity, scope="function")],
        actor: Annotated[AccountSummary, Depends(get_actor, scope="function")],
    ):
        enabled, created = await identity.store.enable_teacher(actor.account_id, now_utc())
        response.status_code = 201 if created else 200
        return {"enabled_at": enabled}

    return router


def check_csrf(request: Request, session: Session | None, origin: str | None) -> Session:
    sent_origin = request.headers.get("origin")
    token = request.headers.get("X-CSRF-Token", "")
    if (
        session is None
        or (sent_origin is not None and sent_origin != origin)
        or not hmac.compare_digest(token.encode(), session.csrf_token.encode())
    ):
        raise Problem("csrf_failed", 403)
    return session
