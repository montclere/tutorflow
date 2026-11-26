"""Проверки групп, персональных цен, границ доступа и жизненного цикла карточек."""

from asyncio import gather

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

from app.modules.groups.infrastructure.persistence.repository import PostgresGroupsRepository


pytestmark = pytest.mark.anyio
BASE = "/api/v1"


async def group(client, headers, name="Группа"):
    response = await client.post(
        f"{BASE}/groups", json={"name": name, "notes": "Личная заметка"}, headers=headers
    )

    assert response.status_code == 201, response.text

    return response.json()


async def add_member(client, headers, group_id, card_id, amount="125.50"):
    return await client.post(
        f"{BASE}/groups/{group_id}/members",
        json={"card_id": card_id, "price": {"amount": amount}},
        headers=headers,
    )


@pytest.mark.br_021
@pytest.mark.br_023
@pytest.mark.br_024
@pytest.mark.br_091
async def test_group_is_independent_with_personal_prices_and_computed_total(client, inbox):
    headers = await teacher(client, inbox, "teacher@example.com")
    first, second = await card(client, headers), await card(client, headers)
    item = await group(client, headers)
    duplicate = await group(client, headers)
    profile = await client.post(
        f"{BASE}/students/cards/{first['id']}/profiles",
        json={"price": {"amount": "300"}},
        headers=headers,
    )

    assert profile.status_code == 201

    assert item["id"] != duplicate["id"]
    assert item["total_price"] == {"amount": "0.00", "currency": "RUB"}
    assert (await add_member(client, headers, item["id"], first["id"])).status_code == 201
    assert (await add_member(client, headers, item["id"], second["id"], "0")).status_code == 201

    response = await client.get(f"{BASE}/groups/{item['id']}")

    assert response.json()["total_price"]["amount"] == "125.50"
    assert (await client.get(f"{BASE}/students/cards/{first['id']}/profiles")).json()["items"][0][
        "price"
    ]["amount"] == "300.00"
    assert (await client.get(f"{BASE}/groups", params={"limit": 1})).json()[
        "next_after"
    ] is not None

    changed = await client.patch(
        f"{BASE}/groups/{item['id']}/members/{second['id']}",
        json={"price": {"amount": "45.10"}},
        headers=headers,
    )

    assert changed.status_code == 200, changed.text
    assert (await client.get(f"{BASE}/groups/{item['id']}")).json()["total_price"][
        "amount"
    ] == "170.60"


@pytest.mark.br_022
async def test_card_can_join_multiple_groups_but_foreign_card_and_duplicates_are_rejected(
    client, inbox, services
):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    first, second = await group(client, headers), await group(client, headers)

    assert (await add_member(client, headers, first["id"], student["id"])).status_code == 201
    assert (await add_member(client, headers, second["id"], student["id"])).status_code == 201
    assert (await add_member(client, headers, first["id"], student["id"])).status_code == 409

    async with client_for(services) as other:
        other_headers = await teacher(other, inbox, "other@example.com")
        foreign = await card(other, other_headers)

        assert (await add_member(client, headers, first["id"], foreign["id"])).status_code == 404

        for method, path, payload in [
            ("GET", f"{BASE}/groups/{first['id']}", None),
            ("PATCH", f"{BASE}/groups/{first['id']}", {"name": "Подмена"}),
            ("GET", f"{BASE}/groups/{first['id']}/members", None),
            ("DELETE", f"{BASE}/groups/{first['id']}", None),
        ]:
            assert (
                await other.request(method, path, json=payload, headers=other_headers)
            ).status_code == 404


@pytest.mark.br_027
@pytest.mark.br_093
async def test_group_archive_preserves_members_but_card_archive_requires_manual_rejoin(
    client, inbox
):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    item = await group(client, headers)
    path = f"{BASE}/groups/{item['id']}"

    assert (await add_member(client, headers, item["id"], student["id"])).status_code == 201
    assert (await client.post(f"{path}/archive", headers=headers)).status_code == 200
    assert not (await client.get(f"{BASE}/groups")).json()["items"]
    assert (await client.get(f"{BASE}/groups", params={"include_archived": True})).json()["items"]
    assert (await client.get(f"{path}/members")).json()["items"]
    assert (await client.patch(path, json={"name": "Новое"}, headers=headers)).status_code == 409
    assert (
        await client.delete(f"{path}/members/{student['id']}", headers=headers)
    ).status_code == 409
    assert (await client.post(f"{path}/restore", headers=headers)).status_code == 200
    assert (
        await client.post(f"{BASE}/students/cards/{student['id']}/archive", headers=headers)
    ).status_code == 200
    assert not (await client.get(f"{path}/members")).json()["items"]
    assert (await add_member(client, headers, item["id"], student["id"])).status_code == 409
    assert (
        await client.post(f"{BASE}/students/cards/{student['id']}/restore", headers=headers)
    ).status_code == 200
    assert not (await client.get(f"{path}/members")).json()["items"]
    assert (await add_member(client, headers, item["id"], student["id"], "50")).status_code == 201
    assert (await client.delete(path, headers=headers)).status_code == 204
    assert (await client.get(f"{BASE}/students/cards/{student['id']}")).status_code == 200


@pytest.mark.br_022
@pytest.mark.br_093
async def test_concurrent_join_and_card_archive_leave_no_current_membership(client, inbox):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    item = await group(client, headers)
    joined, archived = await gather(
        add_member(client, headers, item["id"], student["id"]),
        client.post(f"{BASE}/students/cards/{student['id']}/archive", headers=headers),
    )

    assert joined.status_code in (201, 409), joined.text
    assert archived.status_code == 200
    assert not (await client.get(f"{BASE}/groups/{item['id']}/members")).json()["items"]


@pytest.mark.br_092
async def test_student_reads_only_own_participation_without_roster_or_private_prices(
    client, inbox, services
):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    other = await card(client, headers, "Чужое имя")
    item = await group(client, headers)
    token = await invitation(client, headers, student["id"])

    await add_member(client, headers, item["id"], student["id"])
    await add_member(client, headers, item["id"], other["id"], "999")

    async with client_for(services) as person:
        person_headers = await signup(person, inbox, token, "student@example.com")
        own = await person.get(f"{BASE}/me/teachers/{student['id']}/groups")

        assert own.status_code == 200, own.text
        assert set(own.json()["items"][0]) == {
            "group_id",
            "teacher_id",
            "name",
            "archived",
            "card_id",
            "price",
        }
        assert (
            "Чужое имя" not in own.text
            and "Личная заметка" not in own.text
            and "999" not in own.text
        )
        assert (await person.get(f"{BASE}/groups/{item['id']}/members")).status_code == 403
        assert (await person.get(f"{BASE}/me/teachers/{other['id']}/groups")).status_code == 404
        assert (
            await person.get(f"{BASE}/me/teachers/{student['id']}/groups/{item['id']}")
        ).status_code == 200
        assert (
            await person.delete(
                f"{BASE}/me/teachers/{student['id']}/connection", headers=person_headers
            )
        ).status_code == 204
        assert (await person.get(f"{BASE}/me/teachers/{student['id']}/groups")).status_code == 404


@pytest.mark.br_022
@pytest.mark.br_091
async def test_concurrent_duplicate_join_and_large_total_are_exact(client, inbox):
    headers = await teacher(client, inbox, "teacher@example.com")
    first, second = await card(client, headers), await card(client, headers)
    item = await group(client, headers)
    responses = await gather(
        *(add_member(client, headers, item["id"], first["id"], "9999999999.99") for _ in range(2))
    )

    assert sorted(response.status_code for response in responses) == [201, 409]
    assert (
        await add_member(client, headers, item["id"], second["id"], "9999999999.99")
    ).status_code == 201
    assert (await client.get(f"{BASE}/groups/{item['id']}")).json()["total_price"][
        "amount"
    ] == "19999999999.98"
    assert (
        await client.delete(f"{BASE}/students/cards/{first['id']}", headers=headers)
    ).status_code == 204
    assert (await client.get(f"{BASE}/groups/{item['id']}")).json()["total_price"][
        "amount"
    ] == "9999999999.99"


@pytest.mark.br_093
async def test_membership_cleanup_failure_rolls_back_card_archive(client, inbox, monkeypatch):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    item = await group(client, headers)

    assert (await add_member(client, headers, item["id"], student["id"])).status_code == 201

    original = PostgresGroupsRepository.remove_card


    async def fail(self, card_id):
        await original(self, card_id)

        raise RuntimeError("cleanup failed")


    with monkeypatch.context() as patch:
        patch.setattr(PostgresGroupsRepository, "remove_card", fail)

        response = await client.post(
            f"{BASE}/students/cards/{student['id']}/archive", headers=headers
        )

    assert response.status_code == 500
    assert (await client.get(f"{BASE}/students/cards/{student['id']}")).json()["archived"] is False
    assert len((await client.get(f"{BASE}/groups/{item['id']}/members")).json()["items"]) == 1


@pytest.mark.br_092
async def test_adult_reads_only_linked_child_group_and_loses_access_after_disconnect(
    client, inbox, services
):
    headers = await teacher(client, inbox, "teacher@example.com")
    student, other = await card(client, headers), await card(client, headers)
    item = await group(client, headers)
    link = await adult_invitation(client, headers, student["id"])

    assert (await add_member(client, headers, item["id"], student["id"])).status_code == 201
    assert (await add_member(client, headers, item["id"], other["id"], "999")).status_code == 201

    async with client_for(services) as adult:
        adult_headers = await register_adult(adult, inbox, link["token"], "adult@example.com")
        path = f"{BASE}/me/students/{student['id']}/groups"
        response = await adult.get(path)

        assert response.status_code == 200, response.text
        assert response.json()["items"][0]["price"]["amount"] == "125.50"
        assert "notes" not in response.text and "999" not in response.text
        assert (await adult.get(f"{BASE}/me/students/{other['id']}/groups")).status_code == 404
        assert (await adult.get(f"{BASE}/me/teachers/{student['id']}/groups")).status_code == 403
        assert (
            await adult.delete(
                f"{BASE}/me/students/{student['id']}/connection", headers=adult_headers
            )
        ).status_code == 204
        assert (await adult.get(path)).status_code == 404


@pytest.mark.br_021
@pytest.mark.br_091
async def test_group_mutations_validate_csrf_money_and_page_bounds(client, inbox):
    assert (await client.post(f"{BASE}/groups", json={"name": "Группа"})).status_code == 401

    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    item = await group(client, headers)

    assert (await client.post(f"{BASE}/groups", json={"name": "Группа"})).status_code == 403
    assert (
        await client.patch(f"{BASE}/groups/{item['id']}", json={}, headers=headers)
    ).status_code == 422
    assert (
        await client.patch(f"{BASE}/groups/{item['id']}", json={"name": None}, headers=headers)
    ).status_code == 422

    for amount in ("-1", "NaN", "Infinity", "0.001"):
        assert (
            await add_member(client, headers, item["id"], student["id"], amount)
        ).status_code == 422

    for limit in (0, 101):
        assert (await client.get(f"{BASE}/groups", params={"limit": limit})).status_code == 422
