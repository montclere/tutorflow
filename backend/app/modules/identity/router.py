import hmac
import os
import re
from functools import lru_cache
from typing import Annotated, NoReturn
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, SecretStr, model_validator

from app.database import database_engine
from app.modules.identity.delivery import ContactKind, EnvironmentDelivery
from app.modules.identity.models import Account
from app.modules.identity.service import (
    SESSION_LIFETIME,
    Identity,
    IdentityError,
    SignedIn,
)

router = APIRouter(prefix="/api/v1", tags=["Аккаунт преподавателя"])


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Contact(Input):
    type: ContactKind
    value: Annotated[str, Field(min_length=1, max_length=254)]


class StartRegistration(Input):
    login_contact: Contact


class CompleteRegistration(Input):
    challenge_id: UUID
    code: Annotated[str, Field(pattern=r"^[0-9]{8}$")]
    password: Annotated[SecretStr, Field(min_length=15, max_length=128)]


class Login(StartRegistration):
    password: Annotated[SecretStr, Field(min_length=1, max_length=128)]


class ProfilePatch(Input):
    display_name: Annotated[str | None, Field(max_length=120)] = None
    timezone: Annotated[str | None, Field(max_length=80)] = None

    @model_validator(mode="after")
    def validate_patch(self):
        if not self.model_fields_set:
            raise ValueError("Укажите хотя бы одно поле")
        if self.display_name is not None:
            name = self.display_name.strip()
            if not name or any(not char.isprintable() for char in name):
                raise ValueError("Некорректное отображаемое имя")
            self.display_name = name
        if self.timezone is not None:
            try:
                ZoneInfo(self.timezone)
            except (ZoneInfoNotFoundError, ValueError):
                raise ValueError("Неизвестный часовой пояс") from None
        return self


class Profile(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    display_name: str | None
    timezone: str | None


class AccountView(BaseModel):
    id: UUID
    role: str
    login_contact: Contact
    workspace_id: UUID


class SessionView(BaseModel):
    account: AccountView
    csrf_token: str


class RegistrationView(BaseModel):
    challenge_id: UUID


class CsrfView(BaseModel):
    csrf_token: str


def account_view(account: Account) -> AccountView:
    return AccountView(
        id=account.id,
        role=account.role,
        workspace_id=account.id,
        login_contact=Contact.model_validate(
            {"type": account.contact_kind, "value": account.contact}
        ),
    )


def contact_value(contact: Contact) -> str:
    value = contact.value.strip()
    if contact.type == "phone":
        if re.fullmatch(r"\+[1-9][0-9]{7,14}", value):
            return value
    else:
        try:
            result = validate_email(
                value, check_deliverability=False, allow_smtputf8=False
            )
            if result.ascii_email is not None and len(result.ascii_email) <= 254:
                return result.ascii_email.lower()
        except EmailNotValidError:
            pass
    raise HTTPException(422, "invalid_contact")


@lru_cache(maxsize=1)
def identity_from_environment() -> Identity:
    secret = os.environ.get("IDENTITY_SECRET", "")
    if len(secret.encode()) < 32:
        raise HTTPException(503, "identity_unavailable")
    try:
        engine = database_engine()
    except RuntimeError:
        raise HTTPException(503, "identity_unavailable") from None
    return Identity(
        engine,
        secret.encode(),
        EnvironmentDelivery().send,
        secure_cookie=os.environ.get("IDENTITY_SECURE_COOKIE", "1") != "0",
    )


def service(request: Request) -> Identity:
    injected: Identity | None = getattr(request.app.state, "identity", None)
    return injected if injected is not None else identity_from_environment()


def request_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def require_json(request: Request) -> None:
    media_type = (
        request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    )
    if media_type != "application/json":
        raise HTTPException(415, "application_json_required")


def token_from_request(request: Request, identity: Identity) -> str | None:
    return request.cookies.get(identity.cookie_name)


def authenticated(
    request: Request, *, csrf: bool = False
) -> tuple[Identity, str, Account]:
    if not (
        request.cookies.get("__Host-tutorflow_session")
        or request.cookies.get("tutorflow_session")
    ):
        raise HTTPException(401, "authentication_required")
    identity = service(request)
    token = token_from_request(request, identity)
    if not token:
        raise HTTPException(401, "authentication_required")
    try:
        account = identity.current_account(token)
    except IdentityError as exc:
        raise_identity_error(exc)
    if csrf:
        supplied = request.headers.get("x-csrf-token", "")
        if not hmac.compare_digest(
            supplied.encode(), identity.csrf_token(token).encode()
        ):
            raise HTTPException(403, "csrf_invalid")
    return identity, token, account


def raise_identity_error(error: IdentityError) -> NoReturn:
    status = {
        "authentication_required": 401,
        "invalid_credentials": 401,
        "challenge_invalid": 400,
        "rate_limited": 429,
    }[error.code]
    raise HTTPException(status, error.code) from None


def session_view(
    response: Response, identity: Identity, result: SignedIn
) -> SessionView:
    response.set_cookie(
        identity.cookie_name,
        result.session_token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        path="/",
        secure=identity.secure_cookie,
        httponly=True,
        samesite="lax",
    )
    return SessionView(
        account=account_view(result.account), csrf_token=result.csrf_token
    )


@router.post("/auth/registrations", status_code=202)
def register(
    command: StartRegistration, request: Request, background: BackgroundTasks
) -> RegistrationView:
    require_json(request)
    contact = command.login_contact
    destination = contact_value(contact)
    identity = service(request)
    try:
        challenge_id, code = identity.start_registration(
            contact.type, destination, request_ip(request)
        )
    except IdentityError as exc:
        raise_identity_error(exc)
    if code is not None:
        background.add_task(identity.deliver_code, contact.type, destination, code)
    return RegistrationView(challenge_id=challenge_id)


@router.post("/auth/registrations/complete", status_code=201)
def complete(
    command: CompleteRegistration, request: Request, response: Response
) -> SessionView:
    require_json(request)
    identity = service(request)
    try:
        result = identity.finish_registration(
            command.challenge_id,
            command.code,
            command.password.get_secret_value(),
            request_ip(request),
            token_from_request(request, identity),
        )
    except IdentityError as exc:
        raise_identity_error(exc)
    return session_view(response, identity, result)


@router.post("/auth/login")
def login(command: Login, request: Request, response: Response) -> SessionView:
    require_json(request)
    identity = service(request)
    contact = command.login_contact
    try:
        result = identity.login(
            contact.type,
            contact_value(contact),
            command.password.get_secret_value(),
            request_ip(request),
            token_from_request(request, identity),
        )
    except IdentityError as exc:
        raise_identity_error(exc)
    return session_view(response, identity, result)


@router.get("/auth/csrf")
def csrf_token(request: Request) -> CsrfView:
    identity, token, _ = authenticated(request)
    return CsrfView(csrf_token=identity.csrf_token(token))


@router.delete("/auth/session", status_code=204)
def logout(request: Request, response: Response) -> None:
    identity, token, _ = authenticated(request, csrf=True)
    identity.logout(token)
    response.delete_cookie(
        identity.cookie_name,
        path="/",
        secure=identity.secure_cookie,
        httponly=True,
        samesite="lax",
    )


@router.get("/me")
def me(request: Request) -> AccountView:
    _, _, account = authenticated(request)
    return account_view(account)


@router.get("/me/profile")
def profile(request: Request) -> Profile:
    _, _, account = authenticated(request)
    return Profile.model_validate(account)


@router.patch("/me/profile")
def change_profile(command: ProfilePatch, request: Request) -> Profile:
    require_json(request)
    identity, _, account = authenticated(request, csrf=True)
    changes = command.model_dump(exclude_unset=True)
    try:
        updated = identity.update_profile(account.id, changes)
    except IdentityError as exc:
        raise_identity_error(exc)
    return Profile.model_validate(updated)
