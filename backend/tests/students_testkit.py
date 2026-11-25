"""Повторно используемые HTTP-шаги карточек и приглашённой регистрации."""

from httpx import ASGITransport, AsyncClient
from tests.identity_testkit import PASSWORD, Inbox, register

from app.composition import Services
from app.main import create_app


BASE = "/api/v1"


def client_for(services: Services) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=create_app(services)), base_url="https://test")


async def teacher(client: AsyncClient, inbox: Inbox, address: str) -> dict[str, str]:
    response = await register(client, {"type": "email", "value": address}, inbox)

    return {"x-csrf-token": response.json()["csrf_token"]}


async def card(client: AsyncClient, headers: dict[str, str], name: str = "Ученик") -> dict:
    response = await client.post(
        f"{BASE}/students/cards", json={"name": name, "notes": "Закрытая заметка"}, headers=headers
    )

    assert response.status_code == 201, response.text

    return response.json()


async def invitation(client: AsyncClient, headers: dict[str, str], card_id: str) -> str:
    response = await client.post(
        f"{BASE}/students/cards/{card_id}/invitation",
        json={"welcome": "Добро пожаловать"},
        headers=headers,
    )

    assert response.status_code == 201, response.text

    return response.json()["token"]


async def student_start(client: AsyncClient, token: str, address: str) -> str:
    response = await client.post(
        f"{BASE}/student-invitations/registrations",
        json={"token": token, "kind": "email", "contact": address},
    )

    assert response.status_code == 202, response.text

    return response.json()["challenge_id"]


async def student_finish(client: AsyncClient, token: str, challenge: str, code: str):
    return await client.post(
        f"{BASE}/student-invitations/registrations/complete",
        json={"token": token, "challenge_id": challenge, "code": code, "password": PASSWORD},
    )


async def signup(client: AsyncClient, inbox: Inbox, token: str, address: str) -> dict[str, str]:
    challenge = await student_start(client, token, address)
    result = await student_finish(client, token, challenge, inbox.messages[-1][2])

    assert result.status_code == 201, result.text

    return {"x-csrf-token": result.json()["csrf_token"]}
