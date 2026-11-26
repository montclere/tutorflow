"""Проверки первоначального назначения и отзыва ответственного за расписание."""

import pytest
from tests.students_testkit import (
    adult_invitation,
    card,
    client_for,
    invitation,
    register_adult,
    signup,
    teacher,
)


pytestmark = [pytest.mark.anyio, pytest.mark.br_033, pytest.mark.br_098]
BASE = "/api/v1"


async def test_first_adult_remains_responsible_when_student_joins_and_teacher_can_reassign(
    client, inbox, services
):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    path = f"{BASE}/students/cards/{item['id']}/responsibilities/scheduling"
    adult_token = (await adult_invitation(client, headers, item["id"]))["token"]
    student_token = await invitation(client, headers, item["id"])

    async with client_for(services) as adult, client_for(services) as student:
        adult_headers = await register_adult(adult, inbox, adult_token, "adult@example.com")
        adult_id = (await adult.get(f"{BASE}/me")).json()["id"]
        initial = await client.get(path)

        assert initial.status_code == 200, initial.text
        assert initial.json()["account_id"] == adult_id
        assert initial.json()["role"] == "adult"

        await signup(student, inbox, student_token, "student@example.com")

        student_id = (await student.get(f"{BASE}/me")).json()["id"]

        assert (await client.get(path)).json()["account_id"] == adult_id
        assert (
            await client.put(path, json={"account_id": student_id}, headers=headers)
        ).status_code == 200
        assert (await client.get(path)).json()["account_id"] == student_id
        assert (
            await adult.put(path, json={"account_id": adult_id}, headers=adult_headers)
        ).status_code == 403


async def test_responsible_disconnect_does_not_transfer_permission_to_another_observer(
    client, inbox, services
):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    path = f"{BASE}/students/cards/{item['id']}/responsibilities/scheduling"
    first_token = (await adult_invitation(client, headers, item["id"]))["token"]
    second_token = (await adult_invitation(client, headers, item["id"]))["token"]

    async with client_for(services) as first, client_for(services) as second:
        first_headers = await register_adult(first, inbox, first_token, "first@example.com")

        await register_adult(second, inbox, second_token, "second@example.com")

        second_id = (await second.get(f"{BASE}/me")).json()["id"]

        assert (
            await first.delete(f"{BASE}/me/students/{item['id']}/connection", headers=first_headers)
        ).status_code == 204
        assert (await client.get(path)).json()["account_id"] is None
        assert (
            await client.put(path, json={"account_id": second_id}, headers=headers)
        ).status_code == 200


async def test_responsibility_assignment_requires_owner_csrf_and_live_connection(
    client, inbox, services
):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    path = f"{BASE}/students/cards/{item['id']}/responsibilities/scheduling"
    owner_id = (await client.get(f"{BASE}/me")).json()["id"]

    assert (await client.get(path)).json()["account_id"] is None
    assert (await client.put(path, json={"account_id": owner_id})).status_code == 403
    assert (
        await client.put(path, json={"account_id": owner_id}, headers=headers)
    ).status_code == 404
    assert (await client.get(path.replace("scheduling", "finance"))).status_code == 404

    async with client_for(services) as other:
        other_headers = await teacher(other, inbox, "other@example.com")

        assert (await other.get(path)).status_code == 404
        assert (
            await other.put(path, json={"account_id": owner_id}, headers=other_headers)
        ).status_code == 404


async def test_concurrent_first_student_and_adult_connections_assign_only_one_responsible(
    client, inbox, services
):
    from asyncio import gather

    from tests.students_testkit import adult_finish, adult_start, student_finish, student_start


    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    student_token = await invitation(client, headers, item["id"])
    adult_token = (await adult_invitation(client, headers, item["id"]))["token"]

    async with client_for(services) as adult, client_for(services) as student:
        adult_challenge = await adult_start(adult, adult_token, "adult@example.com")
        adult_code = inbox.messages[-1][2]
        student_challenge = await student_start(student, student_token, "student@example.com")
        student_code = inbox.messages[-1][2]
        responses = await gather(
            adult_finish(adult, adult_token, adult_challenge, adult_code),
            student_finish(student, student_token, student_challenge, student_code),
        )

        assert [response.status_code for response in responses] == [201, 201]

        account_ids = [(await person.get(f"{BASE}/me")).json()["id"] for person in (adult, student)]
        assigned = (
            await client.get(f"{BASE}/students/cards/{item['id']}/responsibilities/scheduling")
        ).json()

        assert assigned["account_id"] in account_ids
        assert assigned["role"] in ("student", "adult")
