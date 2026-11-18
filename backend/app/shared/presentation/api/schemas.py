from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field, StringConstraints

OpaqueToken = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{43}$")]
Version = Annotated[int, Field(strict=True, ge=1)]


class Page[T](BaseModel):
    items: list[T]
    next_cursor: str | None


class ProfileView(BaseModel):
    display_name: str
    timezone: str
    version: int


class LoginContactView(BaseModel):
    type: str
    value: str
    verified_at: datetime


class AccountView(BaseModel):
    account_id: UUID
    status: str
    login_contact: LoginContactView
