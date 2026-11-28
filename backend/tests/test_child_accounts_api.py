"""Сквозные проверки детского входа, управления и подключения к карточке."""

from asyncio import gather

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.students_testkit import (
    adult_invitation,
    card,
    client_for,
    invitation,
    register_adult,
    signup,
    student_finish,
    student_start,
    teacher,
)

from app.modules.identity.infrastructure.persistence.models import Account, LoginSession


pytestmark = pytest.mark.anyio
BASE = "/api/v1"
NEW_PASSWORD = "Самостоятельный-пароль-ученика"


async def child_login(client: AsyncClient, credentials: dict) -> dict[str, str]:
    result = await client.post(
        f"{BASE}/auth/login",
        json={
            "login_contact": {"type": "child", "value": credentials["login"]},
            "password": credentials["password"],
        },
    )

    assert result.status_code == 200, result.text
    assert result.json()["account"]["id"] == credentials["account_id"]

    return {"x-csrf-token": result.json()["csrf_token"]}


@pytest.mark.br_019
@pytest.mark.br_020
@pytest.mark.br_100
async def test_adult_creates_child_and_transfers_or_releases_management(client, inbox, services):
    teacher_headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, teacher_headers)
    card_id = item["id"]
    student_token = await invitation(client, teacher_headers, card_id)
    create = f"{BASE}/me/students/{card_id}/child-account"
    first = await adult_invitation(client, teacher_headers, card_id)
    second = await adult_invitation(client, teacher_headers, card_id)

    async with (
        client_for(services) as adult,
        client_for(services) as target,
        client_for(services) as child,
        client_for(services) as stranger,
    ):
        adult_headers = await register_adult(adult, inbox, first["token"], "adult@example.com")
        target_headers = await register_adult(target, inbox, second["token"], "target@example.com")
        manager_id = (await adult.get(f"{BASE}/me")).json()["id"]
        target_id = (await target.get(f"{BASE}/me")).json()["id"]
        responsibility_path = f"{BASE}/students/cards/{card_id}/responsibilities/scheduling"
        before = await client.get(responsibility_path)

        assert before.status_code == 200, before.text
        assert (await adult.post(create)).status_code == 403
        assert (await stranger.post(create)).status_code == 401
        assert (await adult.get(create)).json() == {
            "can_create": True,
            "management": None,
            "transfer_targets": [],
        }

        result = await adult.post(create, headers=adult_headers)

        assert result.status_code == 201, result.text
        assert result.headers["cache-control"] == "no-store"

        credentials = result.json()
        child_id = credentials["account_id"]
        manage = f"{BASE}/me/child-accounts/{child_id}"

        assert (await target.post(create, headers=target_headers)).status_code == 409
        assert (await client.get(responsibility_path)).json() == before.json()
        assert (await adult.get(f"{BASE}/me/child-accounts")).json() == [
            {"account_id": child_id, "manager_id": manager_id, "pending_manager_id": None}
        ]
        assert (await target.get(f"{BASE}/me/child-accounts")).json() == []
        assert (await target.get(create)).json() == {
            "can_create": False,
            "management": None,
            "transfer_targets": [],
        }
        assert (await adult.get(create)).json()["transfer_targets"] == [
            {"account_id": target_id, "display_name": None}
        ]
        assert (
            await target.post(f"{manage}/password/reset", headers=target_headers)
        ).status_code == 403
        assert (
            await stranger.post(
                f"{BASE}/student-invitations/preview", json={"token": student_token}
            )
        ).status_code == 400

        child_headers = await child_login(child, credentials)

        assert (await child.get(f"{BASE}/me")).json()["roles"] == ["student"]
        assert (await child.get(f"{BASE}/me/teachers")).json()["items"][0]["teacher_id"] == item[
            "teacher_id"
        ]
        assert (
            await child.patch(
                f"{BASE}/me/profile",
                json={"display_name": "Ученик", "timezone": "Europe/Moscow"},
                headers=child_headers,
            )
        ).status_code == 200
        assert (
            await child.put(
                f"{BASE}/me/child-account/password",
                json={"password": NEW_PASSWORD},
                headers=child_headers,
            )
        ).status_code == 403
        assert (
            await child.post(f"{BASE}/me/roles/teacher", headers=child_headers)
        ).status_code == 403

        reset = await adult.post(f"{manage}/password/reset", headers=adult_headers)

        assert reset.status_code == 200, reset.text
        assert reset.json()["login"] == credentials["login"]
        assert reset.json()["password"] != credentials["password"]
        assert (await child.get(f"{BASE}/me")).status_code == 401
        assert (
            await child.post(
                f"{BASE}/auth/login",
                json={
                    "login_contact": {"type": "child", "value": credentials["login"]},
                    "password": credentials["password"],
                },
            )
        ).status_code == 401
        await child_login(child, reset.json())

        assert (
            await target.post(f"{create}/transfer/accept", headers=target_headers)
        ).status_code == 409
        assert (
            await adult.post(
                f"{create}/transfer", json={"target_id": target_id}, headers=adult_headers
            )
        ).status_code == 204
        assert (await adult.get(f"{BASE}/me/child-accounts")).json()[0][
            "pending_manager_id"
        ] == target_id
        assert (await target.get(create)).json()["management"]["pending_manager_id"] == target_id
        assert (await adult.delete(f"{manage}/transfer", headers=adult_headers)).status_code == 204
        assert (
            await target.post(f"{create}/transfer/accept", headers=target_headers)
        ).status_code == 409
        assert (
            await adult.post(
                f"{create}/transfer", json={"target_id": target_id}, headers=adult_headers
            )
        ).status_code == 204

        accepted = await target.post(f"{create}/transfer/accept", headers=target_headers)

        assert accepted.status_code == 200, accepted.text
        assert accepted.json()["account_id"] == child_id
        assert accepted.json()["login"] == credentials["login"]
        assert (await child.get(f"{BASE}/me")).status_code == 401
        assert (await adult.get(f"{BASE}/me/child-accounts")).json() == []
        assert (
            await adult.post(f"{manage}/password/reset", headers=adult_headers)
        ).status_code == 403
        await child_login(child, accepted.json())

        assert (
            await target.delete(f"{manage}/management", headers=target_headers)
        ).status_code == 204
        assert (await child.get(f"{BASE}/me")).status_code == 401
        assert (await target.get(f"{BASE}/me/child-accounts")).json() == []
        assert (await target.get(create)).json()["management"] is None

        child_headers = await child_login(child, accepted.json())
        changed = await child.put(
            f"{BASE}/me/child-account/password",
            json={"password": NEW_PASSWORD},
            headers=child_headers,
        )

        assert changed.status_code == 204, changed.text
        assert (await child.get(f"{BASE}/me")).status_code == 401
        await child_login(child, {**accepted.json(), "password": NEW_PASSWORD})

        assert (await child.get(f"{BASE}/me/profile")).json()["display_name"] == "Ученик"
        assert (await child.get(f"{BASE}/me/teachers")).json()["items"][0]["teacher_id"] == item[
            "teacher_id"
        ]


@pytest.mark.br_019
@pytest.mark.br_020
@pytest.mark.br_100
async def test_existing_student_is_not_managed_and_child_creation_is_atomic(
    client, inbox, services
):
    teacher_headers = await teacher(client, inbox, "teacher@example.com")
    independent = await card(client, teacher_headers)
    student_token = await invitation(client, teacher_headers, independent["id"])
    managed = await card(client, teacher_headers)

    async with (
        client_for(services) as adult,
        client_for(services) as second,
        client_for(services) as student,
    ):
        await signup(student, inbox, student_token, "independent@example.com")

        student_id = (await student.get(f"{BASE}/me")).json()["id"]
        token = await adult_invitation(client, teacher_headers, independent["id"])
        adult_headers = await register_adult(adult, inbox, token["token"], "adult@example.com")
        path = f"{BASE}/me/students/{independent['id']}/child-account"

        assert (await adult.post(path, headers=adult_headers)).status_code == 409
        assert (
            await adult.post(
                f"{BASE}/me/child-accounts/{student_id}/password/reset", headers=adult_headers
            )
        ).status_code == 404

        token = await adult_invitation(client, teacher_headers, managed["id"])
        result = await adult.post(
            f"{BASE}/adult-invitations/accept",
            json={"token": token["token"]},
            headers=adult_headers,
        )

        assert result.status_code in {200, 201}, result.text

        token = await adult_invitation(client, teacher_headers, managed["id"])
        second_headers = await register_adult(second, inbox, token["token"], "second@example.com")
        path = f"{BASE}/me/students/{managed['id']}/child-account"

        results = await gather(
            adult.post(path, headers=adult_headers), second.post(path, headers=second_headers)
        )

        assert sorted(result.status_code for result in results) == [201, 409]

        lists = await gather(
            adult.get(f"{BASE}/me/child-accounts"), second.get(f"{BASE}/me/child-accounts")
        )
        credentials = next(result.json() for result in results if result.status_code == 201)
        children = [child for response in lists for child in response.json()]

        assert [child["account_id"] for child in children] == [credentials["account_id"]]


@pytest.mark.br_100
async def test_child_creation_races_with_invited_registration(client, inbox, services, database):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    card_id = item["id"]
    token = await invitation(client, headers, card_id)
    adult_token = await adult_invitation(client, headers, card_id)

    async with client_for(services) as adult, client_for(services) as student:
        adult_headers = await register_adult(
            adult, inbox, adult_token["token"], "adult@example.com"
        )
        challenge = await student_start(student, token, "student@example.com")
        code = inbox.messages[-1][2]

        created, registered = await gather(
            adult.post(f"{BASE}/me/students/{card_id}/child-account", headers=adult_headers),
            student_finish(student, token, challenge, code),
        )

        assert (created.status_code, registered.status_code) in {(201, 400), (409, 201)}

        async with AsyncSession(database) as db:
            assert await db.scalar(select(func.count(Account.id))) == 3
            assert await db.scalar(select(func.count(LoginSession.account_id))) == (
                2 if created.status_code == 201 else 3
            )
