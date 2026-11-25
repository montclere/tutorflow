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
from app.modules.identity.domain.policies import require_invited_role
from app.modules.identity.domain.values import CONTACT_MAX_LENGTH as CONTACT_MAX_LENGTH
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
class InvitedRegistrationProof:
    challenge_id: UUID
    invitation_id: UUID
    code: str = field(repr=False)
    password_hash: str = field(repr=False)
    role: Role

    def __post_init__(self) -> None:
        require_invited_role(self.role)


@dataclass(frozen=True)
class InvitedSession:
    account_id: UUID
    session_token: str = field(repr=False)
    csrf_token: str = field(repr=False)


class InvitedAccounts(Protocol):
    async def lock_profile(self, account_id: UUID, role: Role) -> PublicProfile | None: ...

    async def profile(self, account_id: UUID) -> PublicProfile | None: ...

    async def profiles(self, account_ids: list[UUID]) -> dict[UUID, PublicProfile]: ...

    async def register(
        self, proof: InvitedRegistrationProof, previous_token: str | None
    ) -> InvitedSession: ...


class InvitedRegistration(Protocol):
    async def start_invited(
        self, kind: str, contact: str, invitation_id: UUID, ip: str, *, role: Role
    ) -> UUID: ...

    async def prepare_invited(
        self,
        challenge_id: UUID,
        code: str,
        password: str,
        invitation_id: UUID,
        ip: str,
        *,
        role: Role,
    ) -> InvitedRegistrationProof: ...

    async def deliver_pending(self, challenge_id: UUID | None = None) -> bool: ...
