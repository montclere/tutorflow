import re
import unicodedata
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from email_validator import EmailNotValidError, validate_email
from pydantic import (
    BaseModel,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.shared.presentation.api.auth import Input
from app.shared.presentation.api.schemas import AccountView, OpaqueToken, Version

from ..domain.accounts import Contact

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Timezone = Annotated[str, StringConstraints(min_length=1, max_length=64)]
Password = Annotated[str, StringConstraints(min_length=15, max_length=128)]
Code = Annotated[str, StringConstraints(pattern=r"^[0-9]{8}$")]


def check_name(value: str) -> str:
    if any(unicodedata.category(character).startswith("C") for character in value):
        raise ValueError("invalid_name")
    return value


def check_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ValueError, ZoneInfoNotFoundError):
        raise ValueError("invalid_timezone") from None
    if value in {"localtime", "posixrules"} or value.startswith(("posix/", "right/")):
        raise ValueError("invalid_timezone")
    return value


class LoginContact(Input):
    type: Literal["email", "phone"]
    value: Annotated[str, StringConstraints(strip_whitespace=True, max_length=320)]

    def normalized(self) -> Contact:
        if self.type == "phone":
            if not re.fullmatch(r"\+[1-9][0-9]{7,14}", self.value):
                raise ValueError("invalid_contact")
            return Contact("phone", self.value)
        try:
            email = validate_email(self.value, check_deliverability=False, allow_smtputf8=False)
        except EmailNotValidError:
            raise ValueError("invalid_contact") from None
        return Contact("email", (email.ascii_email or email.normalized).lower())

    @model_validator(mode="after")
    def valid_contact(self):
        self.normalized()
        return self


class RegistrationStart(Input):
    login_contact: LoginContact
    entrypoint: Literal["teacher", "invitation"]
    invitation_token: OpaqueToken | None = None

    @model_validator(mode="after")
    def valid_entrypoint(self):
        if (self.entrypoint == "invitation") != bool(self.invitation_token):
            raise ValueError("invalid_entrypoint")
        return self


class ResetStart(Input):
    login_contact: LoginContact


class ChallengeResult(BaseModel):
    challenge_id: UUID


class ResetComplete(Input):
    challenge_id: UUID
    code: Code
    password: Password


class RegistrationComplete(ResetComplete):
    display_name: Name
    timezone: Timezone
    invitation_token: OpaqueToken | None = None

    @field_validator("display_name")
    @classmethod
    def valid_name(cls, value: str):
        return check_name(value)

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str):
        return check_timezone(value)


class Login(Input):
    login_contact: LoginContact
    password: Annotated[str, StringConstraints(max_length=128)]


class ProfileEdit(Input):
    display_name: Name | None = None
    timezone: Timezone | None = None
    expected_version: Version

    @model_validator(mode="after")
    def validate_changes(self):
        changes = self.model_fields_set - {"expected_version"}
        if not changes or any(getattr(self, key) is None for key in changes):
            raise ValueError("empty_profile_edit")
        if self.display_name is not None:
            check_name(self.display_name)
        if self.timezone is not None:
            check_timezone(self.timezone)
        return self


class LoginResult(BaseModel):
    account: AccountView
    csrf_token: str


class CsrfResult(BaseModel):
    csrf_token: str


class SessionView(BaseModel):
    session_id: UUID
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    is_current: bool


class TeacherCabinetView(BaseModel):
    enabled_at: datetime
