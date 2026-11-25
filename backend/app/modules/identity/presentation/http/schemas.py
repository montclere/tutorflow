"""Входные и выходные схемы HTTP API аккаунта."""

from dataclasses import dataclass, field
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, PrivateAttr, SecretStr, model_validator

from app.modules.identity.application.contracts import ContactInput
from app.modules.identity.domain.entities import Account as DomainAccount
from app.modules.identity.domain.policies import (
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
    REGISTRATION_CODE_DIGITS,
)
from app.modules.identity.domain.values import (
    CONTACT_MAX_LENGTH,
    DISPLAY_NAME_MAX_LENGTH,
    TIMEZONE_MAX_LENGTH,
    ContactKind,
    ProfileChange,
)


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Contact(Input):
    type: Literal["email", "phone"]
    value: Annotated[str, Field(min_length=1, max_length=CONTACT_MAX_LENGTH)]

    def to_input(self) -> ContactInput:
        return ContactInput(ContactKind(self.type), self.value)


class StartRegistration(Input):
    login_contact: Contact


class CompleteRegistration(Input):
    challenge_id: UUID
    code: Annotated[str, Field(pattern=rf"^[0-9]{{{REGISTRATION_CODE_DIGITS}}}$", repr=False)]
    password: Annotated[
        SecretStr, Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    ]


class Login(StartRegistration):
    password: Annotated[SecretStr, Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)]


class ProfilePatch(Input):
    display_name: Annotated[str | None, Field(max_length=DISPLAY_NAME_MAX_LENGTH)] = None
    timezone: Annotated[str | None, Field(max_length=TIMEZONE_MAX_LENGTH)] = None
    _change: ProfileChange = PrivateAttr()

    @model_validator(mode="after")
    def validate_patch(self) -> Self:
        self._change = ProfileChange(self.model_dump(exclude_unset=True))

        return self

    @property
    def change(self) -> ProfileChange:
        return self._change


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


@dataclass(frozen=True)
class AuthenticatedSession:
    token: str = field(repr=False)
    account: DomainAccount
