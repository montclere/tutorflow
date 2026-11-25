"""Почтовый ящик и HTTP-шаги регистрации для интеграционных тестов."""

from dataclasses import dataclass, field

from httpx import AsyncClient

from app.modules.identity.domain.values import Contact, ContactKind


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
