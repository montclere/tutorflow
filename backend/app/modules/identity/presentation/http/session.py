"""HTTP-граница cookie, сессии и CSRF модуля Identity."""

from typing import NoReturn

from fastapi import HTTPException, Request, Response

from app.modules.identity.application.contracts import SignedIn
from app.modules.identity.application.services.sessions import SessionService
from app.modules.identity.domain.exceptions import IdentityError
from app.modules.identity.presentation.http.schemas import AuthenticatedSession
from app.modules.identity.public import Actor


SECURE_SESSION_COOKIE = "__Host-tutorflow_session"
LOCAL_SESSION_COOKIE = "tutorflow_session"


def raise_identity_error(error: IdentityError) -> NoReturn:
    status = {
        "authentication_required": 401,
        "invalid_credentials": 401,
        "challenge_invalid": 400,
        "rate_limited": 429,
        "invalid_contact": 422,
        "invalid_password": 422,
        "identity_busy": 503,
    }[error.code]

    raise HTTPException(status, error.code) from None


class IdentityHttpSession:
    def __init__(self, sessions: SessionService, secure: bool):
        self.sessions = sessions
        self.secure = secure

    @property
    def cookie_name(self) -> str:
        return SECURE_SESSION_COOKIE if self.secure else LOCAL_SESSION_COOKIE

    def token(self, request: Request) -> str | None:
        return request.cookies.get(self.cookie_name)

    async def authenticate(self, request: Request, *, csrf: bool = False) -> AuthenticatedSession:
        token = self.token(request)

        if not token:
            raise HTTPException(401, "authentication_required")

        try:
            account = await self.sessions.get_account(token)
        except IdentityError as error:
            raise_identity_error(error)

        if csrf and not self.sessions.matches_csrf(token, request.headers.get("x-csrf-token", "")):
            raise HTTPException(403, "csrf_invalid")

        return AuthenticatedSession(token, account)

    async def actor(self, request: Request, *, csrf: bool = False) -> Actor:
        account = (await self.authenticate(request, csrf=csrf)).account

        return Actor(account.id, account.role, account.profile.timezone)

    def set_cookie(self, response: Response, result: SignedIn) -> None:
        response.set_cookie(
            self.cookie_name,
            result.session_token,
            max_age=int(self.sessions.policy.session_lifetime.total_seconds()),
            secure=self.secure,
            httponly=True,
            samesite="lax",
        )

    def clear_cookie(self, response: Response) -> None:
        response.delete_cookie(self.cookie_name, secure=self.secure, httponly=True, samesite="lax")

    def csrf_token(self, current: AuthenticatedSession) -> str:
        return self.sessions.csrf_token(current.token)

    async def logout(self, current: AuthenticatedSession, response: Response) -> None:
        await self.sessions.delete(current.token)

        self.clear_cookie(response)
