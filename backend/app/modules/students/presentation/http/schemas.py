"""Входные схемы и белые списки ответов Students API."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from fastapi import Query
from pydantic import BaseModel, ConfigDict, Field, SecretStr

from app.modules.identity.public import (
    CONTACT_MAX_LENGTH,
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
    REGISTRATION_CODE_DIGITS,
)
from app.modules.students.application.contracts import INVITATION_TOKEN_LENGTH, PAGE_MAX_SIZE
from app.modules.students.domain.values import NAME_MAX_LENGTH, TEXT_MAX_LENGTH, WELCOME_MAX_LENGTH


PageSize = Annotated[int, Query(ge=1, le=PAGE_MAX_SIZE)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CardCreate(Input):
    name: Annotated[str, Field(min_length=1, max_length=NAME_MAX_LENGTH)]
    notes: Annotated[str | None, Field(max_length=TEXT_MAX_LENGTH)] = None


class CardPatch(Input):
    name: Annotated[str | None, Field(min_length=1, max_length=NAME_MAX_LENGTH)] = None
    notes: Annotated[str | None, Field(max_length=TEXT_MAX_LENGTH)] = None


class CardView(BaseModel):
    id: UUID
    teacher_id: UUID
    name: str
    notes: str | None
    archived: bool
    account_id: UUID | None


class Price(Input):
    amount: Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2, allow_inf_nan=False)]
    currency: Literal["RUB"] = "RUB"


class ProfileInput(Input):
    price: Price
    subject: Annotated[str | None, Field(max_length=TEXT_MAX_LENGTH)] = None
    level: Annotated[str | None, Field(max_length=TEXT_MAX_LENGTH)] = None
    goal: Annotated[str | None, Field(max_length=TEXT_MAX_LENGTH)] = None
    duration: Annotated[str | None, Field(max_length=TEXT_MAX_LENGTH)] = None
    description: Annotated[str | None, Field(max_length=TEXT_MAX_LENGTH)] = None


class ProfileView(ProfileInput):
    id: UUID
    card_id: UUID


class Welcome(Input):
    welcome: Annotated[str | None, Field(max_length=WELCOME_MAX_LENGTH)] = None


class Token(Input):
    token: Annotated[
        SecretStr, Field(min_length=INVITATION_TOKEN_LENGTH, max_length=INVITATION_TOKEN_LENGTH)
    ]


class InvitedRegistrationStart(Token):
    kind: Literal["email", "phone"]
    contact: Annotated[SecretStr, Field(min_length=1, max_length=CONTACT_MAX_LENGTH)]


class InvitedRegistrationComplete(Token):
    challenge_id: UUID
    code: Annotated[
        SecretStr, Field(min_length=REGISTRATION_CODE_DIGITS, max_length=REGISTRATION_CODE_DIGITS)
    ]
    password: Annotated[
        SecretStr, Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    ]


class InvitationView(BaseModel):
    id: UUID
    token: str = Field(repr=False)
    expires_at: datetime


class PreviewView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    teacher_id: UUID
    teacher_name: str | None
    welcome: str | None
    expires_at: datetime


class ConnectionView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    card_id: UUID
    teacher_id: UUID
    account_id: UUID


class TeacherView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    card_id: UUID
    teacher_id: UUID
    teacher_name: str | None
    archived: bool


class PublicProfileView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    account_id: UUID
    display_name: str | None
    timezone: str | None


class StudentSessionView(BaseModel):
    account_id: UUID
    role: Literal["student"] = "student"
    csrf_token: str


class ChallengeView(BaseModel):
    challenge_id: UUID


class Page[T](BaseModel):
    items: list[T]
    next_after: UUID | None


class AdultPreviewView(PreviewView):
    student_name: str


class AdultStudentView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    card_id: UUID
    student_name: str
    teacher_id: UUID
    teacher_name: str | None
    archived: bool


class AdultProfileView(BaseModel):
    id: UUID
    subject: str | None
    price: Price


class AdultSessionView(BaseModel):
    account_id: UUID
    role: Literal["adult"] = "adult"
    csrf_token: str


class InvitationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    expires_at: datetime
    welcome: str | None
