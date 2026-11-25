"""Интеграционные проверки правил аккаунта через HTTP и PostgreSQL."""

from asyncio import CancelledError, Event, create_task, gather, wait_for
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession as Session
from tests.identity_testkit import (
    EMAIL,
    IDENTITY_SECRET,
    PASSWORD,
    PHONE,
    finish,
    register,
    start,
)

from app.composition import build_services
from app.main import app, create_app
from app.modules.identity.application.ports import DeliveryUnavailable
from app.modules.identity.domain.entities import Account as DomainAccount
from app.modules.identity.domain.values import Contact, ContactKind, Role
from app.modules.identity.infrastructure.monitoring import RegistrationMetrics
from app.modules.identity.infrastructure.persistence.models import (
    Account,
    LoginSession,
    Registration,
)


pytestmark = pytest.mark.anyio


@pytest.mark.br_001
async def test_workspace_requires_a_session():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        response = await client.get("/api/v1/me")

    assert response.status_code == 401
    assert response.json()["code"] == "authentication_required"


@pytest.mark.br_001
@pytest.mark.br_075
@pytest.mark.parametrize("contact", [EMAIL, PHONE], ids=["email", "phone"])
async def test_registration_and_login_keep_the_same_account(
    client, contact, inbox, services, database
):
    response = await register(client, contact, inbox)
    auth = response.json()

    assert auth["account"]["roles"] == ["teacher"]
    assert auth["account"]["login_contact"] == contact
    assert auth["account"]["workspace_id"] == auth["account"]["id"]
    assert inbox.messages[-1][:2] == (contact["type"], contact["value"])

    cookie = response.headers["set-cookie"].lower()

    assert all(part in cookie for part in ("__host-", "httponly", "secure", "samesite=lax"))
    assert (await client.get("/api/v1/me")).json() == auth["account"]

    submitted_cookie = client.cookies[services.cookie_name]

    async with Session(database) as db:
        account = await db.scalar(select(Account))
        session = await db.scalar(select(LoginSession))

        assert account and account.password_hash.startswith("$argon2id$")
        assert session and session.token_digest != submitted_cookie

    logout = await client.delete(
        "/api/v1/auth/session", headers={"x-csrf-token": auth["csrf_token"]}
    )

    assert logout.status_code == 204
    assert (
        await client.get(
            "/api/v1/me", headers={"Cookie": f"{services.cookie_name}={submitted_cookie}"}
        )
    ).status_code == 401

    response = await client.post(
        "/api/v1/auth/login", json={"login_contact": contact, "password": PASSWORD}
    )

    assert response.status_code == 200
    assert response.json()["account"] == auth["account"]
    assert client.cookies[services.cookie_name] != submitted_cookie

    existing_challenge = await start(client, contact)

    assert await start(client, contact) == existing_challenge
    assert len(inbox.messages) == 1

    async with Session(database) as db:
        suppressed = await db.scalar(select(Registration))

        assert suppressed and suppressed.delivery_due_at is None
        assert suppressed.remaining_attempts == services.identity.registration.policy.code_attempts


@pytest.mark.br_001
@pytest.mark.br_075
async def test_challenge_is_single_use_and_cannot_assign_a_role(client, inbox):
    challenge = await start(client, EMAIL)
    code = inbox.messages[-1][2]
    attempted = await finish(client, challenge, code, role="adult")

    assert attempted.status_code == 422
    assert PASSWORD not in attempted.text
    assert code not in attempted.text

    created = await finish(client, challenge, code)

    assert created.status_code == 201
    assert created.json()["account"]["roles"] == ["teacher"]
    assert (await finish(client, challenge, code)).json()["code"] == "challenge_invalid"


@pytest.mark.br_001
async def test_wrong_attempts_and_expired_codes_do_not_create_accounts(client, inbox, database):
    first = await start(client, EMAIL)
    code = inbox.messages[-1][2]
    wrong = "00000000" if code != "00000000" else "00000001"

    for _ in range(5):
        assert (await finish(client, first, wrong)).json()["code"] == "challenge_invalid"

    assert (await finish(client, first, code)).status_code == 400

    second = await start(client, PHONE)

    async with Session(database) as db:
        async with db.begin():
            await db.execute(
                update(Registration).values(
                    sent_at=datetime.now(UTC) - timedelta(minutes=10),
                    expires_at=datetime.now(UTC) - timedelta(seconds=1),
                )
            )

    assert (await finish(client, second, inbox.messages[-1][2])).status_code == 400

    async with Session(database) as db:
        assert await db.scalar(select(Account)) is None


@pytest.mark.br_001
async def test_unknown_and_wrong_password_have_the_same_error_and_are_throttled(client, inbox):
    await register(client, EMAIL, inbox)

    unknown = await client.post(
        "/api/v1/auth/login",
        json={"login_contact": {**EMAIL, "value": "missing@example.com"}, "password": PASSWORD},
    )

    assert unknown.status_code == 401

    for _ in range(10):
        wrong = await client.post(
            "/api/v1/auth/login", json={"login_contact": EMAIL, "password": "wrong password"}
        )

        assert wrong.status_code == 401
        assert wrong.json()["code"] == unknown.json()["code"] == "invalid_credentials"

    limited = await client.post(
        "/api/v1/auth/login", json={"login_contact": EMAIL, "password": PASSWORD}
    )

    assert limited.status_code == 429


@pytest.mark.br_002
async def test_profile_is_optional_owned_and_editable(client, services, inbox):
    first = (await register(client, EMAIL, inbox)).json()

    assert (await client.get("/api/v1/me/profile")).json() == {
        "display_name": None,
        "timezone": None,
    }
    assert (await client.get("/api/v1/auth/csrf")).json()["csrf_token"] == first["csrf_token"]

    denied = await client.patch("/api/v1/me/profile", json={"display_name": "Чужое имя"})

    assert denied.status_code == 403
    assert (await client.get("/api/v1/me/profile")).json()["display_name"] is None

    headers = {"x-csrf-token": first["csrf_token"]}
    updated = await client.patch(
        "/api/v1/me/profile",
        headers=headers,
        json={"display_name": "  Анна  ", "timezone": "Asia/Krasnoyarsk"},
    )

    assert updated.json() == {"display_name": "Анна", "timezone": "Asia/Krasnoyarsk"}

    for payload in ({"timezone": "Wrong/Zone"}, {"account_id": first["account"]["id"]}, {}):
        invalid = await client.patch("/api/v1/me/profile", headers=headers, json=payload)

        assert invalid.status_code == 422

    async with AsyncClient(
        transport=ASGITransport(app=create_app(services)), base_url="https://test"
    ) as second:
        await register(second, PHONE, inbox)
        assert (await second.get("/api/v1/me/profile")).json()["display_name"] is None

    cleared = await client.patch("/api/v1/me/profile", headers=headers, json={"display_name": None})

    assert cleared.json() == {"display_name": None, "timezone": "Asia/Krasnoyarsk"}


@pytest.mark.br_004
async def test_new_calendar_block_uses_the_profile_timezone(client, services, inbox):
    auth = (await register(client, EMAIL, inbox)).json()
    headers = {"x-csrf-token": auth["csrf_token"]}
    data = {"local_start": "2026-12-01T10:00:00", "duration_minutes": 45}
    utc = await client.post("/api/v1/me/calendar-blocks", json=data, headers=headers)

    assert utc.status_code == 201
    assert utc.json()["timezone"] == "UTC"
    assert datetime.fromisoformat(utc.json()["starts_at"]) == datetime(2026, 12, 1, 10, tzinfo=UTC)

    saved = await client.patch(
        "/api/v1/me/profile", json={"timezone": "Asia/Krasnoyarsk"}, headers=headers
    )

    assert saved.status_code == 200

    local = await client.post("/api/v1/me/calendar-blocks", json=data, headers=headers)

    assert local.status_code == 201
    assert local.json()["timezone"] == "Asia/Krasnoyarsk"
    assert datetime.fromisoformat(local.json()["starts_at"]) == datetime(2026, 12, 1, 3, tzinfo=UTC)

    changed = await client.patch(
        "/api/v1/me/profile", json={"timezone": "Europe/Berlin"}, headers=headers
    )

    assert changed.status_code == 200

    for invalid in ("2026-10-25T02:30:00", "2026-03-29T02:30:00"):
        rejected = await client.post(
            "/api/v1/me/calendar-blocks", json={**data, "local_start": invalid}, headers=headers
        )

        assert rejected.status_code == 422
        assert rejected.json()["code"] == "invalid_local_start"

    blocks = (await client.get("/api/v1/me/calendar-blocks")).json()

    assert {block["id"]: block for block in blocks} == {
        utc.json()["id"]: utc.json(),
        local.json()["id"]: local.json(),
    }

    async with AsyncClient(
        transport=ASGITransport(app=create_app(services)), base_url="https://test"
    ) as second:
        await register(second, PHONE, inbox)
        assert (await second.get("/api/v1/me/calendar-blocks")).json() == []


@pytest.mark.br_001
async def test_registration_is_single_use_under_concurrency(client, inbox, database):
    challenge = await start(client, EMAIL)
    code = inbox.messages[-1][2]
    results = await gather(finish(client, challenge, code), finish(client, challenge, code))

    assert sorted(response.status_code for response in results) == [201, 400]
    assert (
        next(response for response in results if response.status_code == 400).json()["code"]
        == "challenge_invalid"
    )

    async with Session(database) as db:
        assert len((await db.scalars(select(Account))).all()) == 1
        assert len((await db.scalars(select(LoginSession))).all()) == 1
        assert await db.scalar(select(Registration)) is None


@pytest.mark.br_001
async def test_failed_delivery_can_be_retried(client, inbox, database, services, monkeypatch):
    send = inbox.send
    rejected = []


    async def unavailable(contact, code):
        rejected.append((contact, code))

        raise DeliveryUnavailable


    monkeypatch.setattr(inbox, "send", unavailable)

    first = await start(client, EMAIL)

    assert len(rejected) == 1
    assert not inbox.messages
    assert await start(client, EMAIL) == first
    assert len(rejected) == 1

    async with Session(database) as db:
        async with db.begin():
            await db.execute(
                update(Registration).values(
                    delivery_due_at=datetime.now(UTC) - timedelta(seconds=1)
                )
            )

    monkeypatch.setattr(inbox, "send", send)

    restarted = await build_services(database, IDENTITY_SECRET, inbox, secure_cookie=True)

    assert await restarted.identity.registration.deliver_pending()
    assert not await restarted.identity.registration.deliver_pending()
    assert inbox.messages[0][2] == rejected[0][1]
    assert (await finish(client, first, inbox.messages[0][2])).status_code == 201


@pytest.mark.br_004
async def test_calendar_crud_is_owned_paginated_and_idempotent(client, services, inbox):
    path = "/api/v1/me/calendar-blocks"
    auth = (await register(client, EMAIL, inbox)).json()
    headers = {"x-csrf-token": auth["csrf_token"]}
    payload = {
        "request_id": str(uuid4()),
        "local_start": "2026-12-01T10:00:00",
        "duration_minutes": 45,
    }
    results = await gather(
        client.post(path, json=payload, headers=headers),
        client.post(path, json=payload, headers=headers),
    )

    assert [result.status_code for result in results] == [201, 201]

    block = results[0].json()

    assert block == results[1].json()
    assert (await client.get(path)).json() == [block]
    assert (
        await client.post(path, json={**payload, "duration_minutes": 60}, headers=headers)
    ).status_code == 409

    later = (
        await client.post(
            path,
            json={**payload, "request_id": str(uuid4()), "local_start": "2026-12-01T11:00:00"},
            headers=headers,
        )
    ).json()

    assert (await client.get(path, params={"limit": 1})).json() == [block]
    assert (
        await client.get(
            path, params={"after_start": block["starts_at"], "after_id": block["id"], "limit": 1}
        )
    ).json() == [later]
    assert (await client.get(path, params={"after_id": block["id"]})).status_code == 422

    item = f"{path}/{block['id']}"
    replacement = {"local_start": "2026-12-01T09:00:00", "duration_minutes": 90}

    async with AsyncClient(
        transport=ASGITransport(app=create_app(services)), base_url="https://test"
    ) as second:
        other = (await register(second, PHONE, inbox)).json()
        other_headers = {"x-csrf-token": other["csrf_token"]}

        assert (await second.put(item, json=replacement, headers=other_headers)).status_code == 404
        assert (await second.delete(item, headers=other_headers)).status_code == 204
        assert (await second.post(path, json=payload, headers=other_headers)).status_code == 409

    edited = await client.put(item, json=replacement, headers=headers)

    assert edited.status_code == 200
    assert edited.json()["duration_minutes"] == 90
    assert (await client.post(path, json=payload, headers=headers)).json() == edited.json()
    assert (await client.delete(item, headers=headers)).status_code == 204
    assert (await client.delete(item, headers=headers)).status_code == 204
    assert (await client.post(path, json=payload, headers=headers)).status_code == 409
    assert (await client.get(path)).json() == [later]


@pytest.mark.br_001
async def test_delivery_metrics_distinguish_final_success_from_exhaustion(
    client, services, inbox, database, monkeypatch, tmp_path
):
    send = inbox.send


    async def unavailable(contact, code):
        raise DeliveryUnavailable


    monkeypatch.setattr(inbox, "send", unavailable)

    email_challenge = await start(client, EMAIL)
    phone_challenge = await start(client, PHONE)


    async def ready():
        async with Session(database) as db:
            async with db.begin():
                await db.execute(
                    update(Registration).values(
                        delivery_due_at=datetime.now(UTC) - timedelta(seconds=1)
                    )
                )


    await ready()
    assert await services.identity.registration.deliver_pending(UUID(email_challenge))
    assert await services.identity.registration.deliver_pending(UUID(phone_challenge))
    await ready()
    monkeypatch.setattr(inbox, "send", send)
    assert await services.identity.registration.deliver_pending(UUID(email_challenge))
    monkeypatch.setattr(inbox, "send", unavailable)
    assert await services.identity.registration.deliver_pending(UUID(phone_challenge))
    assert not await services.identity.registration.deliver_pending()

    backlog = (
        await RegistrationMetrics(
            services.engine, services.identity.registration.policy.delivery_attempts
        ).render()
    ).decode()

    assert "tutorflow_delivery_pending 0.0" in backlog
    assert "tutorflow_delivery_exhausted 1.0" in backlog
    assert (
        services.metrics.registry.get_sample_value(
            "tutorflow_delivery_attempts_total", {"channel": "email", "outcome": "accepted"}
        )
        == 1
    )
    assert (
        services.metrics.registry.get_sample_value(
            "tutorflow_delivery_attempts_total", {"channel": "phone", "outcome": "failed"}
        )
        == 3
    )
    monkeypatch.setenv("TUTORFLOW_METRICS_TOKEN", "test-token")
    monkeypatch.setenv("TUTORFLOW_METRICS_DIRECTORY", str(tmp_path))

    async with AsyncClient(
        transport=ASGITransport(app=create_app(services)), base_url="https://test"
    ) as monitoring_client:
        response = await monitoring_client.get(
            "/metrics", headers={"authorization": "Bearer test-token"}
        )

    assert response.status_code == 200
    assert "tutorflow_metrics_database_available 1.0" in response.text
    assert EMAIL["value"] not in response.text
    assert PHONE["value"] not in response.text


@pytest.mark.br_001
async def test_cancelling_transaction_rolls_back_and_releases_connection(services, database):
    entered = Event()
    hold = Event()
    identifier = uuid4()
    account = DomainAccount(
        identifier,
        Contact(ContactKind.EMAIL, "cancelled@example.com"),
        frozenset({Role.TEACHER}),
        "test-hash",
        datetime.now(UTC),
    )


    async def write():
        async with services.identity.registration.persistence.transaction() as repository:
            assert await repository.add_account(account)
            entered.set()
            await hold.wait()


    task = create_task(write())

    await wait_for(entered.wait(), timeout=5)
    task.cancel()

    with pytest.raises(CancelledError):
        await task

    async with Session(database) as session:
        assert await session.get(Account, identifier) is None

    async with services.identity.registration.persistence.transaction() as repository:
        assert await repository.add_account(account)

    async with Session(database) as session:
        assert await session.get(Account, identifier) is not None


@pytest.mark.br_001
async def test_identity_storage_rejects_invalid_counters_and_contact_kinds(database):
    from sqlalchemy import insert
    from sqlalchemy.exc import IntegrityError

    from app.modules.identity.infrastructure.persistence.models import RateWindow


    now = datetime.now(UTC)
    registration = dict(
        id=uuid4(),
        contact_kind="email",
        contact="teacher@example.com",
        code_digest="digest",
        sent_at=now,
        expires_at=now + timedelta(minutes=10),
        remaining_attempts=5,
        delivery_attempts=0,
    )

    for changes in (
        {"remaining_attempts": -1},
        {"delivery_attempts": -1},
        {"contact_kind": "other"},
        {"expires_at": now},
    ):
        with pytest.raises(IntegrityError):
            async with Session(database) as db, db.begin():
                await db.execute(insert(Registration).values(**(registration | changes)))

    with pytest.raises(IntegrityError):
        async with Session(database) as db, db.begin():
            await db.execute(insert(RateWindow).values(key="invalid", attempts=0, reset_at=now))


@pytest.mark.br_001
async def test_contact_variants_share_registration_and_login_account(
    client, services, inbox, database
):
    from app.modules.identity.application.contracts import ContactInput


    registration = services.identity.registration
    first = await registration.start(
        ContactInput(ContactKind.EMAIL, " Teacher@EXAMPLE.COM "), "127.0.0.1"
    )
    repeated = await registration.start(
        ContactInput(ContactKind.EMAIL, "teacher@example.com"), "127.0.0.1"
    )

    assert first == repeated
    assert await registration.deliver_pending(first)
    assert inbox.messages[-1][1] == "teacher@example.com"

    created = await finish(client, str(first), inbox.messages[-1][2])
    signed_in = await services.identity.authentication.login(
        ContactInput(ContactKind.EMAIL, "TEACHER@example.com"), PASSWORD, "127.0.0.1", None
    )

    assert created.status_code == 201
    assert str(signed_in.account.id) == created.json()["account"]["id"]

    async with Session(database) as db:
        assert len((await db.scalars(select(Account))).all()) == 1

    invalid = await client.post(
        "/api/v1/auth/registrations", json={"login_contact": {"type": "email", "value": "invalid"}}
    )

    assert invalid.status_code == 422
    assert invalid.json()["code"] == "invalid_contact"


@pytest.mark.br_001
async def test_login_upgrades_old_password_hash_parameters(client, inbox, database):
    from asyncio import to_thread

    from argon2 import PasswordHasher

    from app.modules.identity.infrastructure.security.passwords import ArgonPasswords


    await register(client, EMAIL, inbox)

    old_hasher = PasswordHasher(time_cost=1, memory_cost=8192, parallelism=1)
    previous = await to_thread(old_hasher.hash, PASSWORD)

    async with Session(database) as db, db.begin():
        await db.execute(update(Account).values(password_hash=previous))

    responses = await gather(
        *(
            client.post("/api/v1/auth/login", json={"login_contact": EMAIL, "password": PASSWORD})
            for _ in range(2)
        )
    )

    assert [response.status_code for response in responses] == [200, 200]

    async with Session(database) as db:
        current = await db.scalar(select(Account.password_hash))

    assert current is not None and current != previous
    assert not ArgonPasswords().needs_rehash(current)


@pytest.mark.br_001
async def test_registration_upsert_returns_the_stored_challenge_during_cooldown(services):
    from app.modules.identity.domain.entities import Registration as DomainRegistration


    now = datetime.now(UTC)
    contact = Contact(ContactKind.EMAIL, "teacher@example.com")
    first = DomainRegistration(uuid4(), contact, "first", now, now + timedelta(minutes=10), 5)
    second = DomainRegistration(uuid4(), contact, "second", now, now + timedelta(minutes=10), 5)

    async with services.identity.registration.persistence.transaction() as repository:
        actual = await repository.save_registration(first, now - timedelta(seconds=45))

    assert actual == first.id

    async with services.identity.registration.persistence.transaction() as repository:
        actual = await repository.save_registration(second, now - timedelta(seconds=45))

    assert actual == first.id


@pytest.mark.br_001
async def test_existing_accounts_consume_confirmation_attempts_without_sending_a_code(
    client, services, inbox, database
):
    await register(client, EMAIL, inbox)

    challenge = await start(client, EMAIL)
    generated = services.identity.registration.security.registration_code(UUID(challenge))
    wrong = "00000000" if generated != "00000000" else "00000001"

    rejected = await finish(client, challenge, wrong)

    assert rejected.status_code == 400
    assert rejected.json()["code"] == "challenge_invalid"
    assert len(inbox.messages) == 1

    async with Session(database) as db:
        suppressed = await db.scalar(select(Registration))

        assert suppressed is not None
        assert (
            suppressed.remaining_attempts == services.identity.registration.policy.code_attempts - 1
        )
        assert suppressed.delivery_due_at is None


@pytest.mark.br_001
async def test_password_spaces_and_unicode_are_preserved(client, inbox):
    password = "  длинный пароль преподавателя  "
    challenge = await start(client, EMAIL)
    created = await finish(client, challenge, inbox.messages[-1][2], password=password)

    assert created.status_code == 201

    stripped = await client.post(
        "/api/v1/auth/login", json={"login_contact": EMAIL, "password": password.strip()}
    )
    original = await client.post(
        "/api/v1/auth/login", json={"login_contact": EMAIL, "password": password}
    )

    assert stripped.status_code == 401
    assert original.status_code == 200
