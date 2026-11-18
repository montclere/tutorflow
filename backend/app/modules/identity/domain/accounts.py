from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True)
class Account:
    account_id: UUID
    status: str
    login_contact_type: str
    normalized_login_contact: str
    login_contact_verified_at: datetime
    password_hash: str

    def self_view(self) -> dict:
        return {
            "account_id": self.account_id,
            "status": self.status,
            "login_contact": {
                "type": self.login_contact_type,
                "value": self.normalized_login_contact,
                "verified_at": self.login_contact_verified_at,
            },
        }


@dataclass(frozen=True)
class AccountProfile:
    display_name: str
    timezone: str
    version: int


@dataclass(frozen=True)
class Session:
    session_id: UUID
    account_id: UUID | None
    csrf_token: str
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime


@dataclass(frozen=True)
class Challenge:
    challenge_id: UUID
    contact_type: str
    contact: str
    purpose: str
    code_digest: str
    invitation_digest: str | None
    expires_at: datetime
    consumed_at: datetime | None
    account_id: UUID | None
    failed_attempts: int


@dataclass(frozen=True)
class Contact:
    type: str
    value: str
