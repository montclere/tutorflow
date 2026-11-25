"""Проверки кабинетов одного аккаунта, самосвязей и атомарного подключения."""

from asyncio import gather

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.identity_testkit import PASSWORD
from tests.students_testkit import (
    accept_adult as accept,
)
from tests.students_testkit import (
    adult_invitation as issue,
)
from tests.students_testkit import (
    card,
    client_for,
    invitation,
    register_adult,
    signup,
    teacher,
)

from app.modules.identity.infrastructure.persistence.models import Account, AccountRole
from app.modules.students.infrastructure.persistence.adult_repository import (
    PostgresAdultAccessRepository,
)
from app.modules.students.infrastructure.persistence.models import Connection
from app.modules.students.infrastructure.persistence.repository import PostgresStudentsRepository


pytestmark = [pytest.mark.anyio, pytest.mark.br_087, pytest.mark.br_088, pytest.mark.br_089]
BASE = "/api/v1"


async def accept_student(client, headers, token):
    return await client.post(
        f"{BASE}/student-invitations/accept", json={"token": token}, headers=headers
    )


async def roles(client):
    response = await client.get(f"{BASE}/me")

    assert response.status_code == 200, response.text

    return set(response.json()["roles"])


async def test_one_identity_has_independent_teacher_student_and_adult_contexts(
    client, inbox, services, database
):
    owner_headers = await teacher(client, inbox, "owner@example.com")
    student_card = await card(client, owner_headers, "Преподаватель учится")
    child_card = await card(client, owner_headers, "Ребёнок")
    student_token = await invitation(client, owner_headers, student_card["id"])
    adult_token = (await issue(client, owner_headers, child_card["id"]))["token"]

    async with client_for(services) as person:
        headers = await teacher(person, inbox, "person@example.com")
        account_id = (await person.get(f"{BASE}/me")).json()["id"]

        assert (await person.get(f"{BASE}/me/teachers")).status_code == 403
        assert (await person.get(f"{BASE}/me/students")).status_code == 403

        results = await gather(
            accept_student(person, headers, student_token), accept(person, headers, adult_token)
        )

        assert [result.status_code for result in results] == [201, 201]
        assert await roles(person) == {"teacher", "student", "adult"}
        assert (await person.get(f"{BASE}/me")).json()["id"] == account_id
        assert (await person.get(f"{BASE}/students/cards")).status_code == 200
        assert len((await person.get(f"{BASE}/me/teachers")).json()["items"]) == 1
        assert len((await person.get(f"{BASE}/me/students")).json()["items"]) == 1

        for role in ("teacher", "student", "adult"):
            result = await person.post(
                f"{BASE}/auth/login",
                json={
                    "login_contact": {"type": "email", "value": "person@example.com"},
                    "password": PASSWORD,
                    "role": role,
                },
            )

            assert result.status_code == 200, result.text
            assert result.json()["account"]["id"] == account_id

    async with AsyncSession(database) as db:
        assert await db.scalar(select(func.count()).select_from(Account)) == 2
        assert await db.scalar(select(func.count()).select_from(AccountRole)) == 4


async def test_teacher_can_parent_own_child_but_cannot_be_own_student(client, inbox, services):
    headers = await teacher(client, inbox, "owner@example.com")
    item = await card(client, headers)
    student_token = await invitation(client, headers, item["id"])
    adult_token = (await issue(client, headers, item["id"]))["token"]
    rejected = await accept_student(client, headers, student_token)

    assert rejected.status_code == 409, rejected.text
    assert rejected.json()["code"] == "self_connection_forbidden"
    assert await roles(client) == {"teacher"}

    async with client_for(services) as child:
        await signup(child, inbox, student_token, "child@example.com")

    joined = await accept(client, headers, adult_token)

    assert joined.status_code == 201, joined.text
    assert await roles(client) == {"teacher", "adult"}
    assert (await client.get(f"{BASE}/me/students")).json()["items"][0]["card_id"] == item["id"]


@pytest.mark.parametrize("first", ["student", "adult"])
async def test_student_and_parent_of_same_card_are_exclusive_in_both_orders(
    client, inbox, services, first
):
    headers = await teacher(client, inbox, "owner@example.com")
    item = await card(client, headers)
    student_token = await invitation(client, headers, item["id"])
    adult_token = (await issue(client, headers, item["id"]))["token"]

    async with client_for(services) as person:
        if first == "student":
            person_headers = await signup(person, inbox, student_token, "person@example.com")
            rejected = await accept(person, person_headers, adult_token)
        else:
            person_headers = await register_adult(person, inbox, adult_token, "person@example.com")
            rejected = await accept_student(person, person_headers, student_token)

        assert rejected.status_code == 409, rejected.text
        assert rejected.json()["code"] == "self_connection_forbidden"
        assert await roles(person) == {first}


async def test_racing_student_and_parent_acceptance_creates_only_one_relation(
    client, inbox, services, database
):
    headers = await teacher(client, inbox, "owner@example.com")
    item = await card(client, headers)
    student_token = await invitation(client, headers, item["id"])
    adult_token = (await issue(client, headers, item["id"]))["token"]

    async with client_for(services) as person:
        person_headers = await teacher(person, inbox, "person@example.com")
        results = await gather(
            accept_student(person, person_headers, student_token),
            accept(person, person_headers, adult_token),
        )

        assert sorted(result.status_code for result in results) == [201, 409]
        assert len(await roles(person)) == 2

    async with AsyncSession(database) as db:
        assert await db.scalar(select(func.count()).select_from(Connection)) == 1
        assert await db.scalar(select(func.count()).select_from(AccountRole)) == 3


async def test_teacher_activation_is_explicit_csrf_protected_and_idempotent(
    client, inbox, services, database
):
    headers = await teacher(client, inbox, "owner@example.com")
    item = await card(client, headers)
    token = (await issue(client, headers, item["id"]))["token"]

    async with client_for(services) as adult:
        adult_headers = await register_adult(adult, inbox, token, "adult@example.com")
        rejected = await adult.post(
            f"{BASE}/auth/login",
            json={
                "login_contact": {"type": "email", "value": "adult@example.com"},
                "password": PASSWORD,
                "role": "teacher",
            },
        )

        assert rejected.status_code == 403, rejected.text
        assert await roles(adult) == {"adult"}
        assert (await adult.get(f"{BASE}/me?role=teacher")).status_code == 403
        assert (await adult.post(f"{BASE}/me/roles/teacher")).status_code == 403

        responses = await gather(
            *(adult.post(f"{BASE}/me/roles/teacher", headers=adult_headers) for _ in range(2))
        )

        assert [response.status_code for response in responses] == [200, 200]
        assert await roles(adult) == {"adult", "teacher"}
        assert (await adult.get(f"{BASE}/students/cards")).status_code == 200

    async with AsyncSession(database) as db:
        assert await db.scalar(select(func.count()).select_from(AccountRole)) == 3


@pytest.mark.parametrize("target", ["student", "adult"])
async def test_final_invitation_failure_rolls_back_new_role_and_preserves_account(
    client, inbox, services, database, monkeypatch, target
):
    headers = await teacher(client, inbox, "owner@example.com")
    item = await card(client, headers)

    if target == "student":
        token = await invitation(client, headers, item["id"])

        repository = PostgresStudentsRepository
    else:
        token = (await issue(client, headers, item["id"]))["token"]

        repository = PostgresAdultAccessRepository


    async def refuse_claim(self, *arguments):
        return False


    async with client_for(services) as person:
        person_headers = await teacher(person, inbox, "person@example.com")
        identity = (await person.get(f"{BASE}/me")).json()

        with monkeypatch.context() as patch:
            patch.setattr(repository, "consume_invitation", refuse_claim)

            response = await (
                accept_student(person, person_headers, token)
                if target == "student"
                else accept(person, person_headers, token)
            )

        assert response.status_code == 400, response.text
        assert response.json()["code"] == "invitation_invalid"
        assert (await person.get(f"{BASE}/me")).json() == identity
        assert await roles(person) == {"teacher"}

        connected = await (
            accept_student(person, person_headers, token)
            if target == "student"
            else accept(person, person_headers, token)
        )

        assert connected.status_code == 201, connected.text
        assert await roles(person) == {"teacher", target}

    async with AsyncSession(database) as db:
        assert await db.scalar(select(func.count()).select_from(Account)) == 2
        assert await db.scalar(select(func.count()).select_from(Connection)) == 1
