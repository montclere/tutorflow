"""Доменные сущности аккаунта, подтверждения и сессии."""

import hmac
from dataclasses import dataclass, field, replace
from datetime import datetime
from uuid import UUID

from app.modules.identity.domain.exceptions import IdentityError
from app.modules.identity.domain.values import INVITED_ROLES, Contact, ContactKind, Profile, Role


@dataclass(frozen=True)
class Account:
    id: UUID
    contact: Contact
    roles: frozenset[Role]
    password_hash: str = field(repr=False)
    verified_at: datetime
    profile: Profile = Profile()
    manager_id: UUID | None = None
    pending_manager_id: UUID | None = None

    def __post_init__(self) -> None:
        if not self.roles or any(not isinstance(role, Role) for role in self.roles):
            raise ValueError("У аккаунта должен быть непустой набор ролей")

        object.__setattr__(self, "roles", frozenset(self.roles))

        if self.manager_id is not None and (
            self.contact.kind is not ContactKind.CHILD or self.roles != {Role.STUDENT}
        ):
            raise ValueError("Управляемый аккаунт должен быть детским аккаунтом ученика")

    def require_role_activation(self, role: Role) -> None:
        if self.manager_id is not None and role is not Role.STUDENT:
            raise IdentityError("child_account_managed")

    def require_child(self) -> None:
        if self.contact.kind is not ContactKind.CHILD:
            raise IdentityError("child_not_found")

    def require_child_manager(self, manager_id: UUID) -> None:
        self.require_child()

        if self.manager_id != manager_id:
            raise IdentityError("child_not_managed_by_actor")

    def require_independent_child(self) -> None:
        self.require_child()

        if self.manager_id is not None:
            raise IdentityError("child_account_managed")

    def require_role(self, role: Role) -> None:
        if role not in self.roles:
            raise IdentityError("role_not_enabled")


@dataclass(frozen=True)
class Registration:
    id: UUID
    contact: Contact
    code_digest: str = field(repr=False)
    sent_at: datetime
    expires_at: datetime
    remaining_attempts: int
    role: Role = Role.TEACHER
    invitation_id: UUID | None = None

    def __post_init__(self) -> None:
        if self.contact.kind is ContactKind.CHILD:
            raise IdentityError("invalid_contact")

        if not (
            self.role is Role.TEACHER
            and self.invitation_id is None
            or self.role in INVITED_ROLES
            and self.invitation_id is not None
        ):
            raise ValueError("Некорректное назначение регистрации")

        if self.remaining_attempts < 0 or self.expires_at <= self.sent_at:
            raise ValueError("Некорректный срок или количество попыток подтверждения")

    def is_active(self, now: datetime) -> bool:
        return self.expires_at > now and self.remaining_attempts > 0

    def matches(self, digest: str) -> bool:
        return hmac.compare_digest(self.code_digest, digest)

    def reject_code(self) -> "Registration":
        return replace(self, remaining_attempts=self.remaining_attempts - 1)


@dataclass(frozen=True)
class Session:
    token_digest: str
    account_id: UUID
    expires_at: datetime
