from dataclasses import dataclass
from typing import Protocol
from uuid import UUID


@dataclass(frozen=True)
class AccountSummary:
    account_id: UUID
    display_name: str
    active: bool
    contact_verified: bool
    teacher_enabled: bool

    @property
    def can_access(self) -> bool:
        return self.active and self.contact_verified


class AccountDirectory(Protocol):
    async def lookup_account(self, account_id: UUID) -> AccountSummary | None: ...


class InvitationAvailability(Protocol):
    async def require_available(self, invitation_token: str, *, lock: bool = False) -> None: ...
