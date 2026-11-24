from collections.abc import AsyncIterator, Iterator
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Engine, select, update

from app.main import app, create_app
from app.modules.identity.delivery import ContactKind
from app.modules.identity.models import Account, LoginSession, Registration
from app.modules.identity.service import Identity
from tests.postgres_testkit import migrated_schema, postgres_cluster

pytestmark = pytest.mark.anyio
PASSWORD = "a long teacher password"
EMAIL = {"type": "email", "value": "teacher@example.com"}
PHONE = {"type": "phone", "value": "+15551234567"}


@dataclass
class Inbox:
    messages: list[tuple[ContactKind, str, str]] = field(default_factory=list)

    def send(self, kind: ContactKind, destination: str, code: str) -> None:
        self.messages.append((kind, destination, code))


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(scope="session")
def cluster() -> Iterator[Engine]:
    with postgres_cluster() as engine:
        yield engine


@pytest.fixture
def database(cluster: Engine) -> Iterator[Engine]:
    with migrated_schema(cluster) as engine:
        yield engine


@pytest.fixture
def inbox() -> Inbox:
    return Inbox()


@pytest.fixture
def identity(database: Engine, inbox: Inbox) -> Identity:
    return Identity(
        database,
        b"test-secret-for-identity-integration",
        inbox.send,
        secure_cookie=True,
    )


@pytest.fixture
async def client(identity: Identity) -> AsyncIterator[AsyncClient]:
    async with AsyncClient(
        transport=ASGITransport(app=create_app(identity)), base_url="https://test"
    ) as client:
        yield client


async def start(client: AsyncClient, contact: dict[str, str]) -> str:
    response = await client.post(
        "/api/v1/auth/registrations", json={"login_contact": contact}
    )
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


@pytest.mark.br_001
async def test_workspace_requires_a_session():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="https://test"
    ) as client:
        response = await client.get("/api/v1/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "authentication_required"}


@pytest.mark.br_001
@pytest.mark.br_075
@pytest.mark.parametrize("contact", [EMAIL, PHONE], ids=["email", "phone"])
async def test_registration_and_login_keep_the_same_account(
    client, contact, inbox, identity
):
    response = await register(client, contact, inbox)
    auth = response.json()
    assert auth["account"]["role"] == "teacher"
    assert auth["account"]["login_contact"] == contact
    assert auth["account"]["workspace_id"] == auth["account"]["id"]
    assert inbox.messages[-1][:2] == (contact["type"], contact["value"])
    cookie = response.headers["set-cookie"].lower()
    assert all(
        part in cookie for part in ("__host-", "httponly", "secure", "samesite=lax")
    )
    assert (await client.get("/api/v1/me")).json() == auth["account"]
    submitted_cookie = client.cookies[identity.cookie_name]

    with identity.sessions() as db:
        account = db.scalar(select(Account))
        session = db.scalar(select(LoginSession))
        assert account and account.password_hash.startswith("$argon2id$")
        assert session and session.token_digest != submitted_cookie

    logout = await client.delete(
        "/api/v1/auth/session", headers={"x-csrf-token": auth["csrf_token"]}
    )
    assert logout.status_code == 204
    assert (
        await client.get(
            "/api/v1/me",
            headers={"Cookie": f"{identity.cookie_name}={submitted_cookie}"},
        )
    ).status_code == 401
    response = await client.post(
        "/api/v1/auth/login", json={"login_contact": contact, "password": PASSWORD}
    )
    assert response.status_code == 200
    assert response.json()["account"] == auth["account"]
    assert client.cookies[identity.cookie_name] != submitted_cookie

    await start(client, contact)
    assert len(inbox.messages) == 1


@pytest.mark.br_001
async def test_challenge_is_single_use_and_cannot_assign_a_role(client, inbox):
    challenge = await start(client, EMAIL)
    code = inbox.messages[-1][2]
    attempted = await finish(client, challenge, code, role="adult")
    assert attempted.status_code == 422
    assert PASSWORD not in attempted.text
    assert code not in attempted.text
    created = await finish(client, challenge, code)
    assert created.status_code == 201
    assert created.json()["account"]["role"] == "teacher"
    assert (await finish(client, challenge, code)).json() == {
        "detail": "challenge_invalid"
    }


@pytest.mark.br_001
async def test_wrong_attempts_and_expired_codes_do_not_create_accounts(
    client, inbox, identity
):
    first = await start(client, EMAIL)
    code = inbox.messages[-1][2]
    wrong = "00000000" if code != "00000000" else "00000001"
    for _ in range(5):
        assert (await finish(client, first, wrong)).json() == {
            "detail": "challenge_invalid"
        }
    assert (await finish(client, first, code)).status_code == 400

    second = await start(client, PHONE)
    with identity.sessions.begin() as db:
        db.execute(
            update(Registration).values(
                expires_at=datetime.now(UTC) - timedelta(seconds=1)
            )
        )
    assert (await finish(client, second, inbox.messages[-1][2])).status_code == 400
    with identity.sessions() as db:
        assert db.scalar(select(Account)) is None


@pytest.mark.br_001
async def test_unknown_and_wrong_password_have_the_same_error_and_are_throttled(
    client, inbox
):
    await register(client, EMAIL, inbox)
    unknown = await client.post(
        "/api/v1/auth/login",
        json={
            "login_contact": {**EMAIL, "value": "missing@example.com"},
            "password": PASSWORD,
        },
    )
    assert unknown.status_code == 401
    for _ in range(10):
        wrong = await client.post(
            "/api/v1/auth/login",
            json={"login_contact": EMAIL, "password": "wrong password"},
        )
        assert wrong.status_code == 401
        assert wrong.json() == unknown.json() == {"detail": "invalid_credentials"}
    limited = await client.post(
        "/api/v1/auth/login", json={"login_contact": EMAIL, "password": PASSWORD}
    )
    assert limited.status_code == 429


@pytest.mark.br_002
async def test_profile_is_optional_owned_and_editable(client, identity, inbox):
    first = (await register(client, EMAIL, inbox)).json()
    assert (await client.get("/api/v1/me/profile")).json() == {
        "display_name": None,
        "timezone": None,
    }
    assert (await client.get("/api/v1/auth/csrf")).json()["csrf_token"] == first[
        "csrf_token"
    ]
    denied = await client.patch(
        "/api/v1/me/profile", json={"display_name": "Чужое имя"}
    )
    assert denied.status_code == 403
    assert (await client.get("/api/v1/me/profile")).json()["display_name"] is None
    headers = {"x-csrf-token": first["csrf_token"]}
    updated = await client.patch(
        "/api/v1/me/profile",
        headers=headers,
        json={"display_name": "  Анна  ", "timezone": "Asia/Krasnoyarsk"},
    )
    assert updated.json() == {"display_name": "Анна", "timezone": "Asia/Krasnoyarsk"}
    for payload in (
        {"timezone": "Wrong/Zone"},
        {"account_id": first["account"]["id"]},
        {},
    ):
        invalid = await client.patch(
            "/api/v1/me/profile", headers=headers, json=payload
        )
        assert invalid.status_code == 422

    async with AsyncClient(
        transport=ASGITransport(app=create_app(identity)), base_url="https://test"
    ) as second:
        await register(second, PHONE, inbox)
        assert (await second.get("/api/v1/me/profile")).json()["display_name"] is None

    cleared = await client.patch(
        "/api/v1/me/profile", headers=headers, json={"display_name": None}
    )
    assert cleared.json() == {"display_name": None, "timezone": "Asia/Krasnoyarsk"}


@pytest.mark.br_004
async def test_new_calendar_block_uses_the_profile_timezone(client, identity, inbox):
    auth = (await register(client, EMAIL, inbox)).json()
    headers = {"x-csrf-token": auth["csrf_token"]}
    data = {"local_start": "2026-12-01T10:00:00", "duration_minutes": 45}
    utc = await client.post("/api/v1/me/calendar-blocks", json=data, headers=headers)
    assert utc.status_code == 201
    assert utc.json()["timezone"] == "UTC"
    assert datetime.fromisoformat(utc.json()["starts_at"]) == datetime(
        2026, 12, 1, 10, tzinfo=UTC
    )

    saved = await client.patch(
        "/api/v1/me/profile", json={"timezone": "Asia/Krasnoyarsk"}, headers=headers
    )
    assert saved.status_code == 200
    local = await client.post("/api/v1/me/calendar-blocks", json=data, headers=headers)
    assert local.status_code == 201
    assert local.json()["timezone"] == "Asia/Krasnoyarsk"
    assert datetime.fromisoformat(local.json()["starts_at"]) == datetime(
        2026, 12, 1, 3, tzinfo=UTC
    )

    changed = await client.patch(
        "/api/v1/me/profile", json={"timezone": "Europe/Berlin"}, headers=headers
    )
    assert changed.status_code == 200
    for invalid in ("2026-10-25T02:30:00", "2026-03-29T02:30:00"):
        rejected = await client.post(
            "/api/v1/me/calendar-blocks",
            json={**data, "local_start": invalid},
            headers=headers,
        )
        assert rejected.status_code == 422
        assert rejected.json() == {"detail": "invalid_local_start"}

    blocks = (await client.get("/api/v1/me/calendar-blocks")).json()
    assert {block["id"]: block for block in blocks} == {
        utc.json()["id"]: utc.json(),
        local.json()["id"]: local.json(),
    }

    async with AsyncClient(
        transport=ASGITransport(app=create_app(identity)), base_url="https://test"
    ) as second:
        await register(second, PHONE, inbox)
        assert (await second.get("/api/v1/me/calendar-blocks")).json() == []
