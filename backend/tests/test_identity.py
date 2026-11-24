import os
import secrets
import subprocess
import time
from collections.abc import AsyncIterator, Iterator
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from sqlalchemy import URL, Engine, create_engine, select, update
from sqlalchemy.exc import OperationalError
from sqlalchemy.schema import CreateSchema, DropSchema

from app.main import app, create_app
from app.modules.identity.delivery import ContactKind
from app.modules.identity.models import Account, LoginSession, Registration
from app.modules.identity.service import Identity

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
def postgres_url() -> Iterator[URL | str]:
    configured = os.environ.get("TEST_IDENTITY_DATABASE_URL")
    if configured:
        yield configured
        return

    password = secrets.token_urlsafe(24)
    deployed = subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "-d",
            "-e",
            "POSTGRES_PASSWORD",
            "-p",
            "127.0.0.1::5432",
            "postgres:17-alpine",
        ],
        env={**os.environ, "POSTGRES_PASSWORD": password},
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    try:
        mapping = subprocess.check_output(
            ["docker", "port", deployed, "5432/tcp"], text=True
        )
        port = int(mapping.strip().rsplit(":", 1)[1])
        yield URL.create(
            "postgresql+psycopg", "postgres", password, "127.0.0.1", port, "postgres"
        )
    finally:
        subprocess.run(
            ["docker", "rm", "-f", deployed], check=True, capture_output=True
        )


@pytest.fixture(scope="session")
def cluster(postgres_url: URL | str) -> Iterator[Engine]:
    engine = create_engine(postgres_url)
    try:
        for attempt in range(80):
            try:
                with engine.connect():
                    break
            except OperationalError:
                if attempt == 79:
                    raise
                time.sleep(0.25)
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def database(cluster: Engine) -> Iterator[Engine]:
    schema = f"identity_test_{secrets.token_hex(12)}"
    with cluster.begin() as connection:
        connection.execute(CreateSchema(schema))
    engine = create_engine(
        cluster.url, connect_args={"options": f"-csearch_path={schema}"}
    )
    try:
        config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
        yield engine
    finally:
        engine.dispose()
        with cluster.begin() as connection:
            connection.execute(DropSchema(schema, cascade=True))


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
