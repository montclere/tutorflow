"""Почтовый ящик и HTTP-шаги регистрации для интеграционных тестов."""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

from httpx import AsyncClient
from sqlalchemy import insert, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.domain.values import Contact, ContactKind
from app.modules.identity.infrastructure.persistence.models import Account, AccountRole


PASSWORD = "a long teacher password"
IDENTITY_SECRET = b"test-secret-for-identity-integration"
EMAIL = {"type": "email", "value": "teacher@example.com"}
PHONE = {"type": "phone", "value": "+15551234567"}


@dataclass
class Inbox:
    messages: list[tuple[ContactKind, str, str]] = field(default_factory=list)

    async def send(self, contact: Contact, code: str) -> None:
        self.messages.append((contact.kind, contact.value, code))


async def start(client: AsyncClient, contact: dict[str, str]) -> str:
    response = await client.post("/api/v1/auth/registrations", json={"login_contact": contact})

    assert response.status_code == 202
    assert response.headers["cache-control"] == "no-store"

    return response.json()["challenge_id"]


async def finish(client: AsyncClient, challenge: str, code: str, **extra: str):
    return await client.post(
        "/api/v1/auth/registrations/complete",
        json={"challenge_id": challenge, "code": code, "password": PASSWORD, **extra},
    )


async def register(client: AsyncClient, contact: dict[str, str], inbox: Inbox):
    challenge = await start(client, contact)
    response = await finish(client, challenge, inbox.messages[-1][2])

    assert response.status_code == 201, response.text

    return response


async def seed_account(
    db: AsyncSession,
    *,
    account_id: UUID,
    contact_kind: str,
    contact: str,
    password_hash: str,
    verified_at: datetime,
    role: str,
    legacy: bool = False,
) -> None:
    values = dict(
        id=account_id,
        contact_kind=contact_kind,
        contact=contact,
        password_hash=password_hash,
        verified_at=verified_at,
    )

    if legacy:
        await db.execute(
            text(
                "INSERT INTO identity_accounts (id, contact_kind, contact, password_hash, "
                "verified_at, role) VALUES (:id, :contact_kind, :contact, :password_hash, "
                ":verified_at, :role)"
            ),
            values | {"role": role},
        )
    else:
        await db.execute(insert(Account).values(**values))
        await db.execute(
            insert(AccountRole).values(account_id=account_id, role=role, created_at=verified_at)
        )
