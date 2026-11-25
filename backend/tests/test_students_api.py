"""Сквозные HTTP-проверки карточек, приглашений, прав и гонок Students."""

from asyncio import Event, create_task, gather, wait_for
from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from tests.identity_testkit import PASSWORD
from tests.students_testkit import (
    card,
    client_for,
    invitation,
    signup,
    student_finish,
    student_start,
    teacher,
)

from app.main import create_app
from app.modules.identity.infrastructure.persistence.models import (
    Account,
    AccountRole,
    LoginSession,
)
from app.modules.identity.infrastructure.persistence.repository import PostgresIdentityRepository
from app.modules.students.infrastructure.persistence.models import (
    Connection,
    Invitation,
    StudentCard,
)
from app.modules.students.infrastructure.persistence.repository import PostgresStudentsRepository


pytestmark = pytest.mark.anyio
BASE = "/api/v1"


@pytest.mark.br_005
@pytest.mark.br_006
@pytest.mark.br_010
@pytest.mark.br_076
async def test_card_profile_crud_is_owned_and_money_is_exact(client, inbox, services):
    headers = await teacher(client, inbox, "owner@example.com")
    first = await card(client, headers)
    second = await card(client, headers)

    assert first["id"] != second["id"]
    assert (
        await client.post(f"{BASE}/students/cards", json={"name": " "}, headers=headers)
    ).status_code == 422
    assert (
        await client.patch(
            f"{BASE}/students/cards/{first['id']}",
            json={"teacher_id": second["id"]},
            headers=headers,
        )
    ).status_code == 422

    path = f"{BASE}/students/cards/{first['id']}/profiles"
    response = await client.post(
        path,
        json={"price": {"amount": "0", "currency": "RUB"}, "subject": "Русский"},
        headers=headers,
    )

    assert response.status_code == 201, response.text

    profile_id = response.json()["id"]

    assert response.json()["price"] == {"amount": "0.00", "currency": "RUB"}

    for price in (
        {"amount": "-1"},
        {"amount": "0.001"},
        {"amount": "NaN"},
        {"amount": "1", "currency": "USD"},
    ):
        assert (await client.post(path, json={"price": price}, headers=headers)).status_code == 422

    assert (
        await client.put(
            f"{path}/{profile_id}",
            json={"price": {"amount": "123.45"}, "subject": "Математика"},
            headers=headers,
        )
    ).status_code == 200
    assert (await client.get(path)).json()["items"][0]["subject"] == "Математика"
    assert (await client.get(f"{path}/{profile_id}")).json()["price"]["amount"] == "123.45"
    assert (
        await client.put(
            f"{BASE}/students/cards/{second['id']}/profiles/{profile_id}",
            json={"price": {"amount": "1"}},
            headers=headers,
        )
    ).status_code == 404

    assert (await client.get(f"{BASE}/students/cards", params={"limit": 1})).json()[
        "next_after"
    ] is not None

    async with client_for(services) as other:
        other_headers = await teacher(other, inbox, "other@example.com")

        for method, url, body in [
            ("GET", f"{BASE}/students/cards/{first['id']}", None),
            ("PATCH", f"{BASE}/students/cards/{first['id']}", {"name": "Взлом"}),
            ("DELETE", f"{path}/{profile_id}", None),
            ("POST", f"{BASE}/students/cards/{first['id']}/archive", None),
            ("GET", path, None),
        ]:
            result = await other.request(method, url, json=body, headers=other_headers)

            assert result.status_code == 404, result.text

    assert (await client.delete(f"{path}/{profile_id}", headers=headers)).status_code == 204


@pytest.mark.br_007
@pytest.mark.br_008
@pytest.mark.br_009
@pytest.mark.br_011
@pytest.mark.br_077
@pytest.mark.br_078
@pytest.mark.br_079
@pytest.mark.br_080
@pytest.mark.br_081
async def test_student_registration_profile_archive_and_delete_keep_accounts(
    client, inbox, services, database
):
    headers = await teacher(client, inbox, "owner@example.com")
    item = await card(client, headers)
    token = await invitation(client, headers, item["id"])

    async with client_for(services) as student:
        preview = await student.post(f"{BASE}/student-invitations/preview", json={"token": token})

        assert preview.status_code == 200
        assert "Закрытая заметка" not in preview.text

        student_headers = await signup(student, inbox, token, "student@example.com")
        identity = (await student.get(f"{BASE}/me")).json()

        assert identity["roles"] == ["student"]
        assert (await student.get(f"{BASE}/me/teachers")).json()["items"][0]["teacher_id"] == item[
            "teacher_id"
        ]
        assert (await student.get(f"{BASE}/students/cards/{item['id']}")).status_code == 403
        assert (
            await student.patch(
                f"{BASE}/me/profile",
                json={"display_name": "Своё имя", "timezone": "Europe/Moscow"},
                headers=student_headers,
            )
        ).status_code == 200

        public_profile = await client.get(f"{BASE}/students/cards/{item['id']}/account")

        assert set(public_profile.json()) == {"account_id", "display_name", "timezone"}
        assert "student@example.com" not in public_profile.text
        assert (await client.get(f"{BASE}/students/cards/{item['id']}")).json()["name"] == "Ученик"
        assert (
            await client.post(f"{BASE}/students/cards/{item['id']}/archive", headers=headers)
        ).status_code == 200
        assert not (await client.get(f"{BASE}/students/cards")).json()["items"]
        assert (await student.get(f"{BASE}/me/teachers")).json()["items"][0]["archived"] is True
        assert (
            await client.post(f"{BASE}/students/cards/{item['id']}/restore", headers=headers)
        ).status_code == 200
        assert (
            await student.delete(
                f"{BASE}/me/teachers/{item['id']}/connection", headers=student_headers
            )
        ).status_code == 204
        assert (
            await student.post(
                f"{BASE}/student-invitations/accept", json={"token": token}, headers=student_headers
            )
        ).status_code == 400

        new_token = await invitation(client, headers, item["id"])

        assert (
            await student.post(
                f"{BASE}/student-invitations/accept",
                json={"token": new_token},
                headers=student_headers,
            )
        ).status_code == 201
        assert (
            await client.delete(f"{BASE}/students/cards/{item['id']}", headers=headers)
        ).status_code == 204
        assert not (await student.get(f"{BASE}/me/teachers")).json()["items"]
        assert (await student.get(f"{BASE}/me")).status_code == 200

        async with AsyncSession(database) as db:
            assert await db.get(Account, UUID(identity["id"])) is not None
            assert await db.get(StudentCard, UUID(item["id"])) is None


@pytest.mark.br_008
@pytest.mark.br_012
@pytest.mark.br_081
async def test_one_invitation_registers_at_most_one_account_under_concurrency(
    client, inbox, services, database
):
    headers = await teacher(client, inbox, "owner@example.com")
    item = await card(client, headers)
    token = await invitation(client, headers, item["id"])

    async with client_for(services) as first, client_for(services) as second:
        challenge_a = await student_start(first, token, "first@example.com")
        code_a = inbox.messages[-1][2]
        challenge_b = await student_start(second, token, "second@example.com")
        code_b = inbox.messages[-1][2]
        results = await gather(
            student_finish(first, token, challenge_a, code_a),
            student_finish(second, token, challenge_b, code_b),
        )

        assert sorted(r.status_code for r in results) == [201, 400], [r.text for r in results]

    async with AsyncSession(database) as db:
        assert (
            await db.scalar(
                select(func.count())
                .select_from(Account)
                .where(Account.role_assignments.any(AccountRole.role == "student"))
            )
            == 1
        )
        assert await db.scalar(select(func.count()).select_from(Connection)) == 1
        assert (
            await db.scalar(
                select(func.count())
                .select_from(LoginSession)
                .join(Account, LoginSession.account_id == Account.id)
                .where(Account.role_assignments.any(AccountRole.role == "student"))
            )
            == 1
        )


@pytest.mark.br_008
@pytest.mark.br_012
@pytest.mark.parametrize("operation", ["revoke", "archive", "delete", "expire"])
async def test_invitation_invalidated_during_hashing_creates_no_account(
    client, inbox, services, database, monkeypatch, operation
):
    headers = await teacher(client, inbox, "owner@example.com")
    item = await card(client, headers)
    token = await invitation(client, headers, item["id"])

    async with client_for(services) as student:
        challenge = await student_start(student, token, "student@example.com")
        code = inbox.messages[-1][2]
        entered, release = Event(), Event()
        original = services.identity.registration.passwords.hash


        async def paused(password):
            entered.set()
            await release.wait()

            return await original(password)


        monkeypatch.setattr(services.identity.registration.passwords, "hash", paused)

        task = create_task(student_finish(student, token, challenge, code))

        try:
            await wait_for(entered.wait(), 5)

            if operation == "expire":
                now = datetime.now(UTC)

                async with AsyncSession(database) as db, db.begin():
                    await db.execute(
                        update(Invitation)
                        .where(Invitation.card_id == UUID(item["id"]))
                        .values(
                            created_at=now - timedelta(days=1),
                            expires_at=now - timedelta(seconds=1),
                        )
                    )
            else:
                method, suffix = {
                    "revoke": ("DELETE", "/invitation"),
                    "archive": ("POST", "/archive"),
                    "delete": ("DELETE", ""),
                }[operation]
                result = await wait_for(
                    client.request(
                        method, f"{BASE}/students/cards/{item['id']}{suffix}", headers=headers
                    ),
                    5,
                )

                assert result.status_code in (200, 204), result.text
        finally:
            release.set()

        response = await wait_for(task, 10)

        assert response.status_code == 400, response.text

    async with AsyncSession(database) as db:
        assert (
            await db.scalar(select(Account.id).where(Account.contact == "student@example.com"))
            is None
        )
        assert await db.scalar(select(func.count()).select_from(Connection)) == 0


@pytest.mark.br_009
@pytest.mark.br_010
@pytest.mark.br_012
async def test_existing_student_joins_teachers_and_concurrent_cards_do_not_duplicate(
    client, inbox, services, database
):
    owner_headers = await teacher(client, inbox, "first-teacher@example.com")
    first_card = await card(client, owner_headers)
    first_token = await invitation(client, owner_headers, first_card["id"])

    async with client_for(services) as student, client_for(services) as second_teacher:
        student_headers = await signup(student, inbox, first_token, "student@example.com")
        other_headers = await teacher(second_teacher, inbox, "second-teacher@example.com")
        candidates = [await card(second_teacher, other_headers) for _ in range(2)]
        tokens = [
            await invitation(second_teacher, other_headers, item["id"]) for item in candidates
        ]
        outcomes = await gather(
            *(
                student.post(
                    f"{BASE}/student-invitations/accept",
                    json={"token": value},
                    headers=student_headers,
                )
                for value in tokens
            )
        )

        assert sorted(r.status_code for r in outcomes) == [201, 409], [r.text for r in outcomes]
        assert len((await student.get(f"{BASE}/me/teachers")).json()["items"]) == 2
        assert (await client.get(f"{BASE}/students/cards/{candidates[0]['id']}")).status_code == 404

        async with AsyncSession(database) as db:
            assert (
                await db.scalar(
                    select(func.count())
                    .select_from(Account)
                    .where(Account.role_assignments.any(AccountRole.role == "student"))
                )
                == 1
            )
            assert await db.scalar(select(func.count()).select_from(Connection)) == 2


@pytest.mark.br_008
@pytest.mark.br_012
async def test_student_challenge_cannot_create_teacher_or_allow_self_connection(
    client, inbox, services, database
):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    token = await invitation(client, headers, item["id"])
    rejected = await client.post(
        f"{BASE}/student-invitations/accept", json={"token": token}, headers=headers
    )

    assert rejected.status_code == 409
    assert rejected.json()["code"] == "self_connection_forbidden"
    assert (await client.get(f"{BASE}/me")).json()["roles"] == ["teacher"]

    async with client_for(services) as student:
        challenge = await student_start(student, token, "student@example.com")
        code = inbox.messages[-1][2]
        wrong_endpoint = await student.post(
            f"{BASE}/auth/registrations/complete",
            json={"challenge_id": challenge, "code": code, "password": PASSWORD},
        )

        assert wrong_endpoint.status_code == 400, wrong_endpoint.text

        extra = await student.post(
            f"{BASE}/student-invitations/registrations/complete",
            json={
                "token": token,
                "challenge_id": challenge,
                "code": code,
                "password": PASSWORD,
                "role": "teacher",
            },
        )

        assert extra.status_code == 422

        actual = await student_finish(student, token, challenge, code)

        assert actual.status_code == 201, actual.text
        assert (await student.get(f"{BASE}/me")).json()["roles"] == ["student"]

    async with AsyncSession(database) as db:
        assert (
            await db.scalar(
                select(func.count())
                .select_from(Account)
                .where(Account.role_assignments.any(AccountRole.role == "teacher"))
            )
            == 1
        )


@pytest.mark.br_012
@pytest.mark.br_078
async def test_reissue_archive_restore_and_csrf_keep_revoked_tokens_invalid(client, inbox):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    old_token = await invitation(client, headers, item["id"])
    new_token = await invitation(client, headers, item["id"])

    assert old_token != new_token
    assert (
        await client.post(f"{BASE}/student-invitations/preview", json={"token": old_token})
    ).status_code == 400
    assert (
        await client.post(f"{BASE}/student-invitations/preview", json={"token": new_token})
    ).status_code == 200
    assert (await client.post(f"{BASE}/students/cards/{item['id']}/archive")).status_code == 403
    assert (
        await client.post(f"{BASE}/students/cards/{item['id']}/archive", headers=headers)
    ).status_code == 200
    assert (
        await client.post(
            f"{BASE}/students/cards/{item['id']}/invitation", json={}, headers=headers
        )
    ).status_code == 409
    assert (
        await client.post(f"{BASE}/students/cards/{item['id']}/restore", headers=headers)
    ).status_code == 200
    assert (
        await client.post(f"{BASE}/student-invitations/preview", json={"token": new_token})
    ).status_code == 400


@pytest.mark.br_008
@pytest.mark.br_077
async def test_disconnect_then_new_account_uses_same_card_and_old_account_remains(
    client, inbox, services
):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    first_token = await invitation(client, headers, item["id"])

    async with client_for(services) as first, client_for(services) as second:
        await signup(first, inbox, first_token, "first@example.com")

        old_id = (await first.get(f"{BASE}/me")).json()["id"]

        assert (
            await client.delete(f"{BASE}/students/cards/{item['id']}/connection", headers=headers)
        ).status_code == 204

        second_token = await invitation(client, headers, item["id"])

        await signup(second, inbox, second_token, "second@example.com")

        assert (await client.get(f"{BASE}/students/cards/{item['id']}")).json()[
            "account_id"
        ] != old_id
        assert (await first.get(f"{BASE}/me")).status_code == 200
        assert not (await first.get(f"{BASE}/me/teachers")).json()["items"]
        assert (await first.get(f"{BASE}/students/cards/{item['id']}/account")).status_code == 403


@pytest.mark.br_010
async def test_anonymous_students_request_does_not_initialize_identity():
    async with AsyncClient(
        transport=ASGITransport(app=create_app()), base_url="https://test"
    ) as anonymous:
        assert (await anonymous.get(f"{BASE}/students/cards")).status_code == 401


@pytest.mark.br_008
@pytest.mark.br_012
async def test_failure_at_final_invitation_claim_rolls_back_account_and_session(
    client, inbox, services, database, monkeypatch
):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    token = await invitation(client, headers, item["id"])
    reached = False


    async def reject_claim(repository, invitation_id, now):
        nonlocal reached

        reached = True

        assert (
            await repository.db.scalar(
                select(func.count())
                .select_from(Account)
                .where(Account.role_assignments.any(AccountRole.role == "student"))
            )
            == 1
        )
        assert (
            await repository.db.scalar(
                select(func.count())
                .select_from(LoginSession)
                .join(Account, Account.id == LoginSession.account_id)
                .where(Account.role_assignments.any(AccountRole.role == "student"))
            )
            == 1
        )

        return False


    monkeypatch.setattr(PostgresStudentsRepository, "consume_invitation", reject_claim)

    async with client_for(services) as student:
        challenge = await student_start(student, token, "student@example.com")
        response = await student_finish(student, token, challenge, inbox.messages[-1][2])

        assert response.status_code == 400, response.text
        assert not student.cookies

    assert reached

    async with AsyncSession(database) as db:
        assert (
            await db.scalar(
                select(Account.id).where(
                    Account.role_assignments.any(AccountRole.role == "student")
                )
            )
            is None
        )
        assert await db.scalar(select(Connection.card_id)) is None
        assert await db.scalar(select(func.count()).select_from(LoginSession)) == 1

        stored = await db.get(Invitation, UUID(item["id"]))

        assert stored is not None and stored.consumed_at is None
        assert stored.token_digest != token


@pytest.mark.br_001
@pytest.mark.br_008
@pytest.mark.parametrize("role", ["teacher", "student"])
async def test_code_expiring_after_account_insert_rolls_back_registration(
    client, inbox, services, database, monkeypatch, role
):
    token = None

    if role == "student":
        headers = await teacher(client, inbox, "teacher@example.com")
        item = await card(client, headers)
        token = await invitation(client, headers, item["id"])

    async with client_for(services) as registrant:
        if token is not None:
            challenge = await student_start(registrant, token, "new@example.com")
        else:
            response = await registrant.post(
                f"{BASE}/auth/registrations",
                json={"login_contact": {"type": "email", "value": "new@example.com"}},
            )

            assert response.status_code == 202, response.text

            challenge = response.json()["challenge_id"]

        code = inbox.messages[-1][2]
        registration = services.identity.registration
        original = PostgresIdentityRepository.add_account
        future = datetime.now(UTC) + registration.policy.code_lifetime + timedelta(seconds=1)


        async def delayed(repository, account):
            result = await original(repository, account)

            monkeypatch.setattr(registration, "clock", lambda: future)

            return result


        monkeypatch.setattr(PostgresIdentityRepository, "add_account", delayed)

        if token is not None:
            response = await student_finish(registrant, token, challenge, code)
        else:
            response = await registrant.post(
                f"{BASE}/auth/registrations/complete",
                json={"challenge_id": challenge, "code": code, "password": PASSWORD},
            )

        assert response.status_code == 400, response.text
        assert not registrant.cookies

    async with AsyncSession(database) as db:
        assert (
            await db.scalar(select(Account.id).where(Account.contact == "new@example.com")) is None
        )
        assert await db.scalar(select(Connection.card_id)) is None


@pytest.mark.br_008
@pytest.mark.br_010
@pytest.mark.br_012
async def test_student_login_reuses_account_and_scoped_code_cannot_move_to_another_invitation(
    client, inbox, services
):
    headers = await teacher(client, inbox, "teacher@example.com")
    first = await card(client, headers)
    second = await card(client, headers)
    first_token = await invitation(client, headers, first["id"])
    second_token = await invitation(client, headers, second["id"])

    async with client_for(services) as student:
        challenge = await student_start(student, first_token, "student@example.com")
        code = inbox.messages[-1][2]
        wrong = await student_finish(student, second_token, challenge, code)

        assert wrong.status_code == 400, wrong.text
        assert (await student_finish(student, first_token, challenge, code)).status_code == 201

        account_id = (await student.get(f"{BASE}/me")).json()["id"]

        student.cookies.clear()

        result = await student.post(
            f"{BASE}/auth/login",
            json={
                "login_contact": {"type": "email", "value": "student@example.com"},
                "password": PASSWORD,
            },
        )

        assert result.status_code == 200, result.text
        assert result.json()["account"]["id"] == account_id
        assert result.json()["account"]["roles"] == ["student"]
        assert len((await student.get(f"{BASE}/me/teachers")).json()["items"]) == 1
        assert (await student.get(f"{BASE}/me/calendar-blocks")).status_code == 403


@pytest.mark.br_007
async def test_invitation_flow_works_with_one_database_connection(database, inbox):
    from sqlalchemy.ext.asyncio import create_async_engine
    from tests.identity_testkit import IDENTITY_SECRET

    from app.composition import build_services


    engine = create_async_engine(database.url, pool_size=1, max_overflow=0, pool_timeout=1)

    try:
        services = await build_services(engine, IDENTITY_SECRET, inbox, secure_cookie=True)

        async with client_for(services) as owner, client_for(services) as student:
            headers = await teacher(owner, inbox, "teacher@example.com")
            item = await card(owner, headers)
            token = await invitation(owner, headers, item["id"])

            await signup(student, inbox, token, "student@example.com")
    finally:
        await engine.dispose()


@pytest.mark.br_012
async def test_invitation_rate_limit_and_validation_do_not_disclose_tokens(client, inbox, services):
    from dataclasses import replace


    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    token = await invitation(client, headers, item["id"])
    limiter = services.students.invitations.requests

    limiter.policy = replace(limiter.policy, invitation_access_attempts=1)
    first = await client.post(f"{BASE}/student-invitations/preview", json={"token": token})
    limited = await client.post(f"{BASE}/student-invitations/preview", json={"token": token})

    assert first.status_code == 200
    assert first.headers["cache-control"] == "no-store"
    assert limited.status_code == 429 and limited.json()["code"] == "rate_limited"
    assert token not in limited.text

    malformed = await client.post(
        f"{BASE}/student-invitations/preview", json={"token": token, "secret": token}
    )

    assert malformed.status_code == 422
    assert token not in malformed.text
