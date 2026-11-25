"""Сквозные проверки доступа взрослых, стоимости, изоляции и гонок."""

from asyncio import Event, create_task, gather, wait_for
from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from tests.identity_testkit import PASSWORD
from tests.students_testkit import card, client_for, invitation, signup, teacher

from app.modules.identity.infrastructure.persistence.models import Account, LoginSession
from app.modules.students.infrastructure.persistence.adult_models import (
    AdultConnection,
    AdultInvitation,
)
from app.modules.students.infrastructure.persistence.adult_repository import (
    PostgresAdultAccessRepository,
)
from app.modules.students.infrastructure.persistence.models import Connection


pytestmark = pytest.mark.anyio
BASE = "/api/v1"


async def issue(client, headers, card_id):
    response = await client.post(
        f"{BASE}/students/cards/{card_id}/adult-invitations",
        json={"welcome": "Здравствуйте"},
        headers=headers,
    )

    assert response.status_code == 201, response.text

    return response.json()


async def begin(client, token, contact, kind="email"):
    response = await client.post(
        f"{BASE}/adult-invitations/registrations",
        json={"token": token, "kind": kind, "contact": contact},
    )

    assert response.status_code == 202, response.text

    return response.json()["challenge_id"]


async def finish(client, token, challenge, code):
    return await client.post(
        f"{BASE}/adult-invitations/registrations/complete",
        json={"token": token, "challenge_id": challenge, "code": code, "password": PASSWORD},
    )


async def register_adult(client, inbox, token, address, kind="email"):
    challenge = await begin(client, token, address, kind)
    response = await finish(client, token, challenge, inbox.messages[-1][2])

    assert response.status_code == 201, response.text
    assert response.json()["role"] == "adult"
    assert all(
        value in response.headers["set-cookie"].lower()
        for value in ["secure", "httponly", "samesite=lax"]
    )

    return {"x-csrf-token": response.json()["csrf_token"]}


async def accept(client, headers, token):
    return await client.post(
        f"{BASE}/adult-invitations/accept", json={"token": token}, headers=headers
    )


async def preview(client, token):
    return await client.post(f"{BASE}/adult-invitations/preview", json={"token": token})


@pytest.mark.br_013
@pytest.mark.br_014
@pytest.mark.br_017
@pytest.mark.br_018
@pytest.mark.br_084
@pytest.mark.br_086
@pytest.mark.parametrize(
    "kind,contact", [("email", "adult@example.com"), ("phone", "+15551234567")]
)
async def test_adult_registers_views_price_and_updates_only_own_profile(
    client, inbox, services, kind, contact
):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers, "Ученик")
    path = f"{BASE}/students/cards/{item['id']}"
    profile = await client.post(
        f"{path}/profiles",
        json={
            "price": {"amount": "123.45"},
            "subject": "Математика",
            "description": "Закрытое описание",
        },
        headers=headers,
    )

    assert profile.status_code == 201

    link = await issue(client, headers, item["id"])

    async with client_for(services) as adult:
        information = await preview(adult, link["token"])

        assert information.status_code == 200
        assert information.json()["student_name"] == "Ученик"
        assert "Закрытая заметка" not in information.text

        adult_headers = await register_adult(adult, inbox, link["token"], contact, kind)
        account = (await adult.get(f"{BASE}/me")).json()
        response = await adult.get(f"{BASE}/me/students")

        assert response.json()["items"][0]["card_id"] == item["id"]
        assert set(response.json()["items"][0]) == {
            "card_id",
            "student_name",
            "teacher_id",
            "teacher_name",
            "archived",
        }

        prices = await adult.get(f"{BASE}/me/students/{item['id']}/profiles")

        assert prices.status_code == 200, prices.text
        assert prices.json()["items"] == [
            {
                "id": profile.json()["id"],
                "subject": "Математика",
                "price": {"amount": "123.45", "currency": "RUB"},
            }
        ]
        assert "Закрытое описание" not in prices.text
        assert (await adult.get(path)).status_code == 403
        assert (await adult.get(f"{BASE}/me/teachers")).status_code == 403
        assert (await adult.get(f"{BASE}/me/calendar-blocks")).status_code == 403
        assert (
            await adult.patch(
                f"{BASE}/me/profile", json={"display_name": "Взрослый"}, headers=adult_headers
            )
        ).status_code == 200
        assert (
            await adult.delete(f"{BASE}/me/students/{item['id']}/connection")
        ).status_code == 403

        visible = await client.get(f"{path}/adults")

        assert visible.json() == [
            {"account_id": account["id"], "display_name": "Взрослый", "timezone": None}
        ]
        assert contact not in visible.text

        adult.cookies.clear()

        login = await adult.post(
            f"{BASE}/auth/login",
            json={"login_contact": {"type": kind, "value": contact}, "password": PASSWORD},
        )

        assert login.status_code == 200 and login.json()["account"]["id"] == account["id"]
        assert (await preview(adult, link["token"])).status_code == 400


@pytest.mark.br_082
@pytest.mark.br_083
async def test_independent_invites_reissue_revoke_and_capacity(client, inbox, services, database):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    path = f"{BASE}/students/cards/{item['id']}/adult-invitations"
    first, second = (
        await issue(client, headers, item["id"]),
        await issue(client, headers, item["id"]),
    )

    assert (await client.post(path, json={}, headers=headers)).status_code == 409
    assert len((await client.get(path)).json()) == 2
    assert "token" not in (await client.get(path)).text
    assert (await preview(client, first["token"])).status_code == 200
    assert (await preview(client, second["token"])).status_code == 200

    replaced = await client.post(f"{path}/{first['id']}/reissue", headers=headers)

    assert replaced.status_code == 201
    assert replaced.json()["id"] != first["id"]
    assert (await preview(client, first["token"])).status_code == 400
    assert (await preview(client, second["token"])).status_code == 200
    assert (await client.delete(f"{path}/{second['id']}", headers=headers)).status_code == 204
    assert (await preview(client, replaced.json()["token"])).status_code == 200

    async with client_for(services) as adult:
        adult_headers = await register_adult(
            adult, inbox, replaced.json()["token"], "adult@example.com"
        )
        remaining = await issue(client, headers, item["id"])
        duplicate = await accept(adult, adult_headers, remaining["token"])

        assert (
            duplicate.status_code == 409 and duplicate.json()["code"] == "adult_already_connected"
        )
        assert (await preview(client, remaining["token"])).status_code == 200

    async with AsyncSession(database) as db:
        assert await db.scalar(select(func.count()).select_from(AdultConnection)) == 1
        assert await db.scalar(select(func.count()).select_from(AdultInvitation)) == 1

        stored = await db.scalar(select(AdultInvitation))

        assert stored is not None and stored.token_digest != remaining["token"]


@pytest.mark.br_013
@pytest.mark.br_082
@pytest.mark.br_083
async def test_concurrent_invitation_generation_cannot_create_unbounded_rows(
    client, inbox, database
):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    path = f"{BASE}/students/cards/{item['id']}/adult-invitations"
    responses = await gather(*(client.post(path, json={}, headers=headers) for _ in range(4)))

    assert sorted(r.status_code for r in responses) == [201, 201, 409, 409]

    async with AsyncSession(database) as db:
        assert await db.scalar(select(func.count()).select_from(AdultInvitation)) == 2


@pytest.mark.br_015
@pytest.mark.br_016
@pytest.mark.br_082
@pytest.mark.br_086
async def test_two_adults_join_concurrently_and_existing_adult_has_multiple_children(
    client, inbox, services, database
):
    headers = await teacher(client, inbox, "first-teacher@example.com")
    item = await card(client, headers)
    links = [await issue(client, headers, item["id"]) for _ in range(2)]

    async with (
        client_for(services) as first,
        client_for(services) as second,
        client_for(services) as other_teacher,
    ):
        challenges = []

        for browser, link, contact in [
            (first, links[0], "first@example.com"),
            (second, links[1], "second@example.com"),
        ]:
            challenge = await begin(browser, link["token"], contact)

            challenges.append((challenge, inbox.messages[-1][2]))

        results = await gather(
            *(
                finish(browser, link["token"], challenge, code)
                for browser, link, (challenge, code) in zip(
                    [first, second], links, challenges, strict=True
                )
            )
        )

        assert [r.status_code for r in results] == [201, 201], [r.text for r in results]

        first_headers = {"x-csrf-token": results[0].json()["csrf_token"]}

        assert (
            await client.post(
                f"{BASE}/students/cards/{item['id']}/adult-invitations", json={}, headers=headers
            )
        ).status_code == 409

        sibling = await card(client, headers, "Второй ученик")
        sibling_link = await issue(client, headers, sibling["id"])

        assert (await accept(first, first_headers, sibling_link["token"])).status_code == 201

        other_headers = await teacher(other_teacher, inbox, "second-teacher@example.com")
        other_card = await card(other_teacher, other_headers)
        other_link = await issue(other_teacher, other_headers, other_card["id"])

        assert (await accept(first, first_headers, other_link["token"])).status_code == 201

        listing = (await first.get(f"{BASE}/me/students", params={"limit": 1})).json()

        assert len(listing["items"]) == 1 and listing["next_after"] is not None
        assert len((await first.get(f"{BASE}/me/students")).json()["items"]) == 3
        assert (await second.get(f"{BASE}/me/students/{sibling['id']}/profiles")).status_code == 404
        assert (
            await other_teacher.get(f"{BASE}/students/cards/{item['id']}/adults")
        ).status_code == 404

    async with AsyncSession(database) as db:
        assert (
            await db.scalar(
                select(func.count()).select_from(Account).where(Account.role == "adult")
            )
            == 2
        )


@pytest.mark.br_082
@pytest.mark.br_086
async def test_race_for_last_slot_rolls_back_losing_registration(client, inbox, services, database):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    initial = await issue(client, headers, item["id"])

    async with client_for(services) as connected:
        await register_adult(connected, inbox, initial["token"], "connected@example.com")

    link = await issue(client, headers, item["id"])

    async with client_for(services) as first, client_for(services) as second:
        challenge_a = await begin(first, link["token"], "first@example.com")
        code_a = inbox.messages[-1][2]
        challenge_b = await begin(second, link["token"], "second@example.com")
        code_b = inbox.messages[-1][2]
        results = await gather(
            finish(first, link["token"], challenge_a, code_a),
            finish(second, link["token"], challenge_b, code_b),
        )

        assert sorted(r.status_code for r in results) == [201, 400], [r.text for r in results]

    async with AsyncSession(database) as db:
        assert (
            await db.scalar(
                select(func.count()).select_from(Account).where(Account.role == "adult")
            )
            == 2
        )
        assert await db.scalar(select(func.count()).select_from(AdultConnection)) == 2
        assert (
            await db.scalar(
                select(func.count())
                .select_from(LoginSession)
                .join(Account)
                .where(Account.role == "adult")
            )
            == 2
        )


@pytest.mark.br_014
@pytest.mark.br_017
@pytest.mark.br_084
async def test_invitation_roles_and_codes_cannot_be_swapped(client, inbox, services):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    child_link = await invitation(client, headers, item["id"])
    adult_link = await issue(client, headers, item["id"])

    assert (await accept(client, headers, adult_link["token"])).status_code == 403
    assert (await preview(client, child_link)).status_code == 400

    async with client_for(services) as child, client_for(services) as adult:
        child_headers = await signup(child, inbox, child_link, "child@example.com")

        assert (await accept(child, child_headers, adult_link["token"])).status_code == 403

        challenge = await begin(adult, adult_link["token"], "adult@example.com")
        code = inbox.messages[-1][2]
        payload = {"challenge_id": challenge, "code": code, "password": PASSWORD}

        assert (
            await adult.post(f"{BASE}/auth/registrations/complete", json=payload)
        ).status_code == 400
        assert (
            await adult.post(
                f"{BASE}/student-invitations/registrations/complete",
                json=payload | {"token": adult_link["token"]},
            )
        ).status_code == 400
        assert (
            await adult.post(
                f"{BASE}/adult-invitations/registrations/complete",
                json=payload | {"token": adult_link["token"], "role": "teacher"},
            )
        ).status_code == 422

        response = await finish(adult, adult_link["token"], challenge, code)

        assert response.status_code == 201
        assert (await adult.get(f"{BASE}/me")).json()["role"] == "adult"
        assert (
            await adult.post(
                f"{BASE}/student-invitations/accept",
                json={"token": child_link},
                headers={"x-csrf-token": response.json()["csrf_token"]},
            )
        ).status_code == 403


@pytest.mark.br_083
@pytest.mark.br_086
@pytest.mark.parametrize("operation", ["revoke", "reissue", "archive", "delete", "expire"])
async def test_invalidation_during_hashing_creates_no_adult(
    client, inbox, services, database, monkeypatch, operation
):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    link = await issue(client, headers, item["id"])

    async with client_for(services) as adult:
        challenge = await begin(adult, link["token"], "adult@example.com")
        code = inbox.messages[-1][2]
        entered, release = Event(), Event()
        original = services.identity.registration.passwords.hash


        async def paused(password):
            entered.set()
            await release.wait()

            return await original(password)


        monkeypatch.setattr(services.identity.registration.passwords, "hash", paused)

        task = create_task(finish(adult, link["token"], challenge, code))

        try:
            await wait_for(entered.wait(), 5)

            path = f"{BASE}/students/cards/{item['id']}"

            if operation == "expire":
                now = datetime.now(UTC)

                async with AsyncSession(database) as db, db.begin():
                    await db.execute(
                        update(AdultInvitation)
                        .where(AdultInvitation.id == UUID(link["id"]))
                        .values(
                            created_at=now - timedelta(days=1),
                            expires_at=now - timedelta(seconds=1),
                        )
                    )
            else:
                method, suffix = {
                    "revoke": ("DELETE", f"/adult-invitations/{link['id']}"),
                    "reissue": ("POST", f"/adult-invitations/{link['id']}/reissue"),
                    "archive": ("POST", "/archive"),
                    "delete": ("DELETE", ""),
                }[operation]
                response = await wait_for(client.request(method, path + suffix, headers=headers), 5)

                assert response.status_code in (200, 201, 204), response.text
        finally:
            release.set()

        result = await wait_for(task, 10)

        assert result.status_code == 400, result.text

    async with AsyncSession(database) as db:
        assert await db.scalar(select(Account.id).where(Account.role == "adult")) is None
        assert await db.scalar(select(func.count()).select_from(AdultConnection)) == 0


@pytest.mark.br_086
async def test_final_claim_failure_rolls_back_account_and_session(
    client, inbox, services, database, monkeypatch
):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    link = await issue(client, headers, item["id"])
    reached = False


    async def reject(repository, invitation_id):
        nonlocal reached

        reached = True

        assert (
            await repository.db.scalar(
                select(func.count()).select_from(Account).where(Account.role == "adult")
            )
            == 1
        )
        assert (
            await repository.db.scalar(
                select(func.count())
                .select_from(LoginSession)
                .join(Account)
                .where(Account.role == "adult")
            )
            == 1
        )

        return False


    monkeypatch.setattr(PostgresAdultAccessRepository, "consume_invitation", reject)

    async with client_for(services) as adult:
        challenge = await begin(adult, link["token"], "adult@example.com")
        result = await finish(adult, link["token"], challenge, inbox.messages[-1][2])

        assert result.status_code == 400 and not adult.cookies

    assert reached

    async with AsyncSession(database) as db:
        assert await db.scalar(select(Account.id).where(Account.role == "adult")) is None
        assert await db.scalar(select(func.count()).select_from(LoginSession)) == 1
        assert await db.get(AdultInvitation, UUID(link["id"])) is not None


@pytest.mark.br_085
async def test_disconnect_archive_and_delete_preserve_independent_accounts_and_child(
    client, inbox, services, database
):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    child_token = await invitation(client, headers, item["id"])
    links = [await issue(client, headers, item["id"]) for _ in range(2)]
    path = f"{BASE}/students/cards/{item['id']}"

    async with (
        client_for(services) as child,
        client_for(services) as first,
        client_for(services) as second,
    ):
        await signup(child, inbox, child_token, "child@example.com")

        first_headers = await register_adult(first, inbox, links[0]["token"], "first@example.com")

        await register_adult(second, inbox, links[1]["token"], "second@example.com")

        second_id = (await second.get(f"{BASE}/me")).json()["id"]

        assert (
            await first.delete(f"{BASE}/me/students/{item['id']}/connection", headers=first_headers)
        ).status_code == 204
        assert len((await client.get(f"{path}/adults")).json()) == 1

        pending = await issue(client, headers, item["id"])

        assert (await client.post(f"{path}/archive", headers=headers)).status_code == 200
        assert (await second.get(f"{BASE}/me/students")).json()["items"][0]["archived"] is True
        assert (await child.get(f"{BASE}/me/teachers")).json()["items"][0]["archived"] is True
        assert (await client.post(f"{path}/restore", headers=headers)).status_code == 200
        assert (await preview(client, pending["token"])).status_code == 400
        assert (
            await client.delete(f"{path}/adults/{second_id}", headers=headers)
        ).status_code == 204
        assert (await child.get(f"{BASE}/me/teachers")).json()["items"]

        replacement = await issue(client, headers, item["id"])

        assert (await accept(first, first_headers, replacement["token"])).status_code == 201
        assert (await client.delete(path, headers=headers)).status_code == 204
        assert not (await first.get(f"{BASE}/me/students")).json()["items"]
        assert (await first.get(f"{BASE}/me")).status_code == 200
        assert (await second.get(f"{BASE}/me")).status_code == 200
        assert (await child.get(f"{BASE}/me")).status_code == 200

    async with AsyncSession(database) as db:
        assert await db.scalar(select(func.count()).select_from(AdultConnection)) == 0
        assert await db.scalar(select(func.count()).select_from(AdultInvitation)) == 0
        assert await db.scalar(select(func.count()).select_from(Connection)) == 0


@pytest.mark.br_083
async def test_expired_invitations_release_places_without_accumulating_rows(
    client, inbox, database
):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    links = [await issue(client, headers, item["id"]) for _ in range(2)]
    now = datetime.now(UTC)

    async with AsyncSession(database) as db, db.begin():
        await db.execute(
            update(AdultInvitation)
            .where(AdultInvitation.card_id == UUID(item["id"]))
            .values(created_at=now - timedelta(days=1), expires_at=now - timedelta(seconds=1))
        )

    replacement = await issue(client, headers, item["id"])

    assert (await preview(client, replacement["token"])).status_code == 200

    for link in links:
        assert (await preview(client, link["token"])).status_code == 400

    async with AsyncSession(database) as db:
        assert await db.scalar(select(func.count()).select_from(AdultInvitation)) == 1


@pytest.mark.br_082
@pytest.mark.br_086
async def test_configured_lower_limit_and_single_connection_pool(database, inbox):
    from sqlalchemy.ext.asyncio import create_async_engine
    from tests.identity_testkit import IDENTITY_SECRET

    from app.composition import build_services
    from app.modules.students.domain.policies import AdultAccessPolicy


    engine = create_async_engine(database.url, pool_size=1, max_overflow=0, pool_timeout=1)

    try:
        services = await build_services(
            engine,
            IDENTITY_SECRET,
            inbox,
            secure_cookie=True,
            adult_policy=AdultAccessPolicy(max_connections=1),
        )

        async with client_for(services) as owner, client_for(services) as adult:
            headers = await teacher(owner, inbox, "teacher@example.com")
            item = await card(owner, headers)
            link = await issue(owner, headers, item["id"])
            path = f"{BASE}/students/cards/{item['id']}/adult-invitations"

            assert (await owner.post(path, json={}, headers=headers)).status_code == 409
            await register_adult(adult, inbox, link["token"], "adult@example.com")
            assert (await owner.post(path, json={}, headers=headers)).status_code == 409
    finally:
        await engine.dispose()


@pytest.mark.br_013
@pytest.mark.br_014
@pytest.mark.br_083
async def test_invitation_mutations_are_scoped_to_owner_and_card(client, inbox, services):
    headers = await teacher(client, inbox, "teacher@example.com")
    first, second = await card(client, headers), await card(client, headers)
    link = await issue(client, headers, first["id"])
    first_path = f"{BASE}/students/cards/{first['id']}/adult-invitations"
    second_path = f"{BASE}/students/cards/{second['id']}/adult-invitations"

    assert (await client.post(first_path, json={})).status_code == 403
    assert (
        await client.post(f"{second_path}/{link['id']}/reissue", headers=headers)
    ).status_code == 404
    assert (await client.delete(f"{second_path}/{link['id']}", headers=headers)).status_code == 204
    assert (await preview(client, link["token"])).status_code == 200

    async with client_for(services) as other:
        other_headers = await teacher(other, inbox, "other@example.com")

        for method, path, body in [
            ("POST", first_path, {}),
            ("GET", first_path, None),
            ("DELETE", f"{first_path}/{link['id']}", None),
            ("POST", f"{first_path}/{link['id']}/reissue", None),
        ]:
            response = await other.request(method, path, json=body, headers=other_headers)

            assert response.status_code == 404, response.text

    assert (await preview(client, link["token"])).status_code == 200
