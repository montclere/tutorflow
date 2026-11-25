"""Публичные данные и порты Identity для соседних модулей."""

from dataclasses import dataclass, field
from typing import Protocol
from uuid import UUID

from app.modules.identity.domain.policies import (
    PASSWORD_MAX_LENGTH as PASSWORD_MAX_LENGTH,
)
from app.modules.identity.domain.policies import (
    PASSWORD_MIN_LENGTH as PASSWORD_MIN_LENGTH,
)
from app.modules.identity.domain.policies import (
    REGISTRATION_CODE_DIGITS as REGISTRATION_CODE_DIGITS,
)
from app.modules.identity.domain.values import Role as Role


@dataclass(frozen=True)
class Actor:
    account_id: UUID
    role: Role
    timezone: str | None


@dataclass(frozen=True)
class PublicProfile:
    account_id: UUID
    display_name: str | None
    timezone: str | None


@dataclass(frozen=True)
class StudentRegistrationProof:
    challenge_id: UUID
    invitation_id: UUID
    code: str = field(repr=False)
    password_hash: str = field(repr=False)


@dataclass(frozen=True)
class StudentSession:
    account_id: UUID
    session_token: str = field(repr=False)
    csrf_token: str = field(repr=False)


class InvitedAccounts(Protocol):
    async def lock_student(self, account_id: UUID) -> PublicProfile | None: ...

    async def profile(self, account_id: UUID) -> PublicProfile | None: ...

    async def profiles(self, account_ids: list[UUID]) -> dict[UUID, PublicProfile]: ...

    async def register(
        self, proof: StudentRegistrationProof, previous_token: str | None
    ) -> StudentSession: ...


class InvitedRegistration(Protocol):
    async def start_student(
        self, kind: str, contact: str, invitation_id: UUID, ip: str
    ) -> UUID: ...

    async def prepare_student(
        self, challenge_id: UUID, code: str, password: str, invitation_id: UUID, ip: str
    ) -> StudentRegistrationProof: ...

    async def deliver_pending(self, challenge_id: UUID | None = None) -> bool: ...
