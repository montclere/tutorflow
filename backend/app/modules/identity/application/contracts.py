"""Результаты сценариев и задания доставки Identity."""

from dataclasses import dataclass, field
from uuid import UUID

from app.modules.identity.domain.entities import Account
from app.modules.identity.domain.values import Contact, ContactKind


@dataclass(frozen=True)
class SignedIn:
    account: Account
    session_token: str = field(repr=False)
    csrf_token: str = field(repr=False)


@dataclass(frozen=True)
class RegistrationDelivery:
    challenge_id: UUID
    contact: Contact
    attempt: int


@dataclass(frozen=True)
class PurgedIdentityRecords:
    registrations: int
    sessions: int
    rate_windows: int


@dataclass(frozen=True)
class ContactInput:
    kind: ContactKind
    value: str = field(repr=False)
