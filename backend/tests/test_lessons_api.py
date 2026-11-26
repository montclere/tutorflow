"""HTTP-поток занятий, персональных условий, ответов и защиты от конфликтов записи."""

from asyncio import gather
from datetime import UTC, datetime, timedelta
from uuid import uuid4

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


pytestmark = pytest.mark.anyio
BASE = "/api/v1"


def lesson_body(card_ids=(), **values):
    return (
        dict(
            starts_at=(datetime.now(UTC) + timedelta(days=2)).isoformat(),
            participants=[{"card_id": card_id, "price": {"amount": "100"}} for card_id in card_ids],
        )
        | values
    )


async def create_lesson(client, headers, body):
    response = await client.post(f"{BASE}/lessons", json=body, headers=headers)

    assert response.status_code == 201, response.text

    return response.json()


@pytest.mark.br_028
@pytest.mark.br_029
@pytest.mark.br_030
@pytest.mark.br_031
@pytest.mark.br_094
@pytest.mark.br_095
@pytest.mark.br_097
async def test_defaults_snapshot_replay_and_deleted_source_do_not_rewrite_lesson(client, inbox):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers, "Исходное имя")
    settings = await client.patch(
        f"{BASE}/me/teaching-settings",
        json={"default_price": {"amount": "150"}, "duration_minutes": 90},
        headers=headers,
    )

    assert settings.status_code == 200, settings.text

    body = {
        "starts_at": (datetime.now(UTC) + timedelta(days=2)).isoformat(),
        "participants": [{"card_id": student["id"]}],
        "request_id": str(uuid4()),
        "private_notes": "Приватная запись",
    }
    saved = await create_lesson(client, headers, body)

    assert saved["duration_minutes"] == 90
    assert saved["participants"][0]["price"]["amount"] == "150.00"
    assert saved["participants"][0]["confirmation"]["state"] == "not_required"
    assert (
        await client.patch(
            f"{BASE}/me/teaching-settings",
            json={"default_price": {"amount": "500"}},
            headers=headers,
        )
    ).status_code == 200
    assert (
        await client.delete(f"{BASE}/students/cards/{student['id']}", headers=headers)
    ).status_code == 204

    replay = await create_lesson(client, headers, body)
    observed = (await client.get(f"{BASE}/lessons/{saved['id']}")).json()

    assert replay["id"] == saved["id"]
    assert observed["participants"][0]["name"] == "Исходное имя"
    assert observed["participants"][0]["price"]["amount"] == "150.00"
    assert len((await client.get(f"{BASE}/lessons/{saved['id']}/history")).json()["items"]) == 1
    assert (
        await client.post(f"{BASE}/lessons", json=body | {"duration_minutes": 60}, headers=headers)
    ).status_code == 409


@pytest.mark.br_028
@pytest.mark.br_031
@pytest.mark.br_032
@pytest.mark.br_033
@pytest.mark.br_095
@pytest.mark.br_096
async def test_independent_group_replies_and_current_responsible_are_enforced(
    client, inbox, services
):
    headers = await teacher(client, inbox, "teacher@example.com")
    first = await card(client, headers, "Первый")
    second = await card(client, headers, "Чужой участник")
    first_token = await invitation(client, headers, first["id"])
    second_token = await invitation(client, headers, second["id"])
    adult_token = (await adult_invitation(client, headers, first["id"]))["token"]

    async with client_for(services) as a, client_for(services) as b, client_for(services) as adult:
        a_headers = await signup(a, inbox, first_token, "first@example.com")
        b_headers = await signup(b, inbox, second_token, "second@example.com")
        adult_headers = await register_adult(adult, inbox, adult_token, "adult@example.com")
        body = lesson_body(
            [first["id"], second["id"]], confirmation=True, private_notes="Только преподавателю"
        )
        saved = await create_lesson(client, headers, body)
        a_path = f"{BASE}/me/teachers/{first['id']}/lessons/{saved['id']}"
        b_path = f"{BASE}/me/teachers/{second['id']}/lessons/{saved['id']}"
        adult_path = f"{BASE}/me/students/{first['id']}/lessons/{saved['id']}"
        own = await a.get(a_path)

        assert own.status_code == 200, own.text
        assert own.json()["can_reply"] is True
        assert (
            "private_notes" not in own.text
            and "participants" not in own.text
            and "total_price" not in own.text
        )
        assert "Чужой участник" not in own.text
        assert (await adult.get(adult_path)).json()["can_reply"] is False
        assert (
            await adult.post(
                f"{adult_path}/reply",
                json={"answer": "accepted", "expected_version": 1},
                headers=adult_headers,
            )
        ).status_code == 403

        responses = await gather(
            a.post(
                f"{a_path}/reply",
                json={"answer": "accepted", "expected_version": 1},
                headers=a_headers,
            ),
            b.post(
                f"{b_path}/reply",
                json={"answer": "declined", "expected_version": 1},
                headers=b_headers,
            ),
        )

        assert [response.status_code for response in responses] == [200, 200], [
            response.text for response in responses
        ]

        final = (await client.get(f"{BASE}/lessons/{saved['id']}")).json()

        assert {part["confirmation"]["state"] for part in final["participants"]} == {
            "accepted",
            "declined",
        }
        assert final["deleted"] is False and final["version"] == 1

        adult_id = (await adult.get(f"{BASE}/me")).json()["id"]

        assert (
            await client.put(
                f"{BASE}/students/cards/{first['id']}/responsibilities/scheduling",
                json={"account_id": adult_id},
                headers=headers,
            )
        ).status_code == 200
        assert (
            await a.post(
                f"{a_path}/reply",
                json={"answer": "declined", "expected_version": 1},
                headers=a_headers,
            )
        ).status_code == 403
        assert (
            await adult.post(
                f"{adult_path}/reply",
                json={"answer": "accepted", "expected_version": 1},
                headers=adult_headers,
            )
        ).status_code == 200

        moved = await client.patch(
            f"{BASE}/lessons/{saved['id']}",
            json={
                "expected_version": 1,
                "starts_at": (
                    datetime.fromisoformat(body["starts_at"]) + timedelta(hours=1)
                ).isoformat(),
            },
            headers=headers,
        )

        assert moved.status_code == 200, moved.text
        assert all(
            part["confirmation"]["state"] == "pending" for part in moved.json()["participants"]
        )
        assert (
            await adult.post(
                f"{adult_path}/reply",
                json={"answer": "accepted", "expected_version": 1},
                headers=adult_headers,
            )
        ).status_code == 409
        assert (
            await adult.post(
                f"{adult_path}/reply",
                json={"answer": "accepted", "expected_version": 2},
                headers=adult_headers,
            )
        ).status_code == 200
        assert (await a.get(b_path)).status_code == 404


@pytest.mark.br_025
@pytest.mark.br_028
@pytest.mark.br_094
@pytest.mark.br_095
async def test_group_and_personal_price_sources_are_snapshots_including_empty_group(client, inbox):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    created_group = await client.post(
        f"{BASE}/groups", json={"name": "Групповой контекст"}, headers=headers
    )
    group_id = created_group.json()["id"]
    empty_body = {
        "starts_at": (datetime.now(UTC) + timedelta(days=2)).isoformat(),
        "group_id": group_id,
    }
    empty = await create_lesson(client, headers, empty_body)

    assert empty["participants"] == [] and empty["total_price"]["amount"] == "0.00"
    assert (
        await client.post(
            f"{BASE}/groups/{group_id}/members",
            json={"card_id": student["id"], "price": {"amount": "120"}},
            headers=headers,
        )
    ).status_code == 201

    saved = await create_lesson(client, headers, empty_body)

    assert saved["participants"][0]["price"]["amount"] == "120.00"
    assert (
        await client.patch(
            f"{BASE}/groups/{group_id}/members/{student['id']}",
            json={"price": {"amount": "900"}},
            headers=headers,
        )
    ).status_code == 200
    assert (await client.get(f"{BASE}/lessons/{saved['id']}")).json()["participants"][0]["price"][
        "amount"
    ] == "120.00"
    assert (await client.get(f"{BASE}/lessons/{empty['id']}")).json()["participants"] == []

    overridden = await create_lesson(
        client,
        headers,
        empty_body | {"participants": [{"card_id": student["id"], "price": {"amount": "55"}}]},
    )

    assert overridden["participants"][0]["price"]["amount"] == "55.00"
    assert (await client.delete(f"{BASE}/groups/{group_id}", headers=headers)).status_code == 204
    assert (await client.get(f"{BASE}/lessons/{saved['id']}")).json()["group"][
        "name"
    ] == "Групповой контекст"
    assert (
        await client.post(f"{BASE}/lessons", json=lesson_body(), headers=headers)
    ).status_code == 422


@pytest.mark.br_034
@pytest.mark.br_035
@pytest.mark.br_036
@pytest.mark.br_099
async def test_conflicts_are_warnings_adjacent_events_are_allowed_and_foreign_events_are_private(
    client, inbox, services
):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    start = (datetime.now(UTC) + timedelta(days=2)).replace(microsecond=0)
    blocked = await client.post(
        f"{BASE}/me/calendar-blocks",
        json={"local_start": start.replace(tzinfo=None).isoformat(), "duration_minutes": 60},
        headers=headers,
    )

    assert blocked.status_code == 201, blocked.text

    saved = await create_lesson(
        client,
        headers,
        lesson_body([student["id"]], starts_at=start.isoformat(), duration_minutes=60),
    )

    assert {warning["code"] for warning in saved["warnings"]} == {"calendar_block_overlap"}

    adjacent = await create_lesson(
        client,
        headers,
        lesson_body(
            [student["id"]], starts_at=(start + timedelta(hours=1)).isoformat(), duration_minutes=60
        ),
    )

    assert adjacent["warnings"] == []

    async with client_for(services) as other:
        other_headers = await teacher(other, inbox, "other@example.com")
        other_student = await card(other, other_headers)
        foreign = await create_lesson(
            other, other_headers, lesson_body([other_student["id"]], starts_at=start.isoformat())
        )

        assert foreign["warnings"] == []
        assert (await other.get(f"{BASE}/lessons/{saved['id']}")).status_code == 404
        assert (await client.get(f"{BASE}/lessons/{foreign['id']}")).status_code == 404
        assert (
            await other.post(
                f"{BASE}/lessons", json=lesson_body([student["id"]]), headers=other_headers
            )
        ).status_code == 404


@pytest.mark.br_097
async def test_concurrent_edits_and_logical_deletion_keep_ordered_history(client, inbox):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    body = lesson_body([student["id"]], request_id=str(uuid4()))
    saved = await create_lesson(client, headers, body)
    path = f"{BASE}/lessons/{saved['id']}"
    responses = await gather(
        *(
            client.patch(
                path, json={"expected_version": 1, "duration_minutes": duration}, headers=headers
            )
            for duration in (80, 90)
        )
    )

    assert sorted(response.status_code for response in responses) == [200, 409]

    history = (await client.get(f"{path}/history")).json()

    assert [item["kind"] for item in history["items"]] == ["created", "updated"]
    assert [item["lesson"]["version"] for item in history["items"]] == [1, 2]
    assert (
        await client.delete(path, params={"expected_version": 1}, headers=headers)
    ).status_code == 409
    assert (
        await client.delete(path, params={"expected_version": 2}, headers=headers)
    ).status_code == 204
    assert (await client.get(path)).status_code == 404
    assert (await client.get(f"{path}/history")).json()["items"][-1]["kind"] == "deleted"

    replay = await create_lesson(client, headers, body)

    assert replay["id"] == saved["id"] and replay["deleted"] is True


@pytest.mark.br_096
@pytest.mark.br_099
async def test_confirmation_expiry_and_configured_limits_are_enforced(database, inbox):
    from tests.identity_testkit import IDENTITY_SECRET

    from app.composition import build_services
    from app.modules.scheduling.domain.policies import LessonPolicy


    clock = [datetime.now(UTC)]
    controlled = await build_services(
        database,
        IDENTITY_SECRET,
        inbox,
        secure_cookie=True,
        lesson_policy=LessonPolicy(
            max_duration_minutes=120,
            max_participants=2,
            max_range_days=7,
            page_max_size=2,
            confirmation_lifetime=timedelta(minutes=10),
        ),
        lesson_clock=lambda: clock[0],
    )

    async with client_for(controlled) as owner, client_for(controlled) as student:
        headers = await teacher(owner, inbox, "teacher@example.com")
        item = await card(owner, headers)
        token = await invitation(owner, headers, item["id"])
        student_headers = await signup(student, inbox, token, "student@example.com")
        saved = await create_lesson(
            owner,
            headers,
            lesson_body(
                [item["id"]],
                starts_at=(clock[0] + timedelta(days=2)).isoformat(),
                confirmation=True,
            ),
        )
        path = f"{BASE}/me/teachers/{item['id']}/lessons/{saved['id']}"

        clock[0] += timedelta(minutes=11)

        listing = await owner.get(
            f"{BASE}/lessons",
            params={"from": clock[0].isoformat(), "to": (clock[0] + timedelta(days=3)).isoformat()},
        )

        assert listing.status_code == 200, listing.text
        assert len(listing.json()["items"]) == 1

        expired = await student.get(path)

        assert expired.json()["confirmation"]["state"] == "expired"
        assert expired.json()["can_reply"] is False
        assert (
            await student.post(
                f"{path}/reply",
                json={"answer": "accepted", "expected_version": 1},
                headers=student_headers,
            )
        ).status_code == 409
        assert (await owner.get(f"{BASE}/lessons/{saved['id']}")).json()["deleted"] is False
        assert (
            await owner.post(
                f"{BASE}/lessons",
                json=lesson_body([item["id"]], duration_minutes=121),
                headers=headers,
            )
        ).status_code == 422
        assert (
            await owner.get(
                f"{BASE}/lessons",
                params={
                    "from": clock[0].isoformat(),
                    "to": (clock[0] + timedelta(days=8)).isoformat(),
                },
            )
        ).status_code == 422
        assert (
            await owner.get(
                f"{BASE}/lessons",
                params={
                    "from": clock[0].isoformat(),
                    "to": (clock[0] + timedelta(days=1)).isoformat(),
                    "limit": 3,
                },
            )
        ).status_code == 422


@pytest.mark.br_097
async def test_creation_audit_failure_rolls_back_every_row_and_request_claim(
    client, inbox, database, monkeypatch
):
    from sqlalchemy import func, select
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.modules.scheduling.infrastructure.persistence.lesson_models import (
        LessonParticipantRow,
        LessonRevisionRow,
        LessonRow,
    )
    from app.modules.scheduling.infrastructure.persistence.lesson_repository import (
        PostgresLessonsRepository,
    )


    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    body = lesson_body([student["id"]], request_id=str(uuid4()))
    original = PostgresLessonsRepository.append_revision


    async def fail(self, revision):
        await original(self, revision)

        raise RuntimeError("audit storage failed")


    with monkeypatch.context() as patch:
        patch.setattr(PostgresLessonsRepository, "append_revision", fail)

        response = await client.post(f"{BASE}/lessons", json=body, headers=headers)

    assert response.status_code == 500

    async with AsyncSession(database) as db:
        for model in (LessonRow, LessonParticipantRow, LessonRevisionRow):
            assert await db.scalar(select(func.count()).select_from(model)) == 0

    saved = await create_lesson(client, headers, body)

    assert len((await client.get(f"{BASE}/lessons/{saved['id']}/history")).json()["items"]) == 1


@pytest.mark.br_097
async def test_concurrent_repeated_creation_returns_one_lesson_and_one_revision(client, inbox):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    body = lesson_body([student["id"]], request_id=str(uuid4()))
    responses = await gather(
        *(client.post(f"{BASE}/lessons", json=body, headers=headers) for _ in range(2))
    )

    assert [response.status_code for response in responses] == [201, 201], [
        response.text for response in responses
    ]
    assert responses[0].json()["id"] == responses[1].json()["id"]

    lesson_id = responses[0].json()["id"]

    assert len((await client.get(f"{BASE}/lessons/{lesson_id}/history")).json()["items"]) == 1


@pytest.mark.br_025
@pytest.mark.br_028
@pytest.mark.br_095
async def test_group_calendar_filters_context_and_cursor_pagination_is_stable(
    client, inbox, services
):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    group = (await client.post(f"{BASE}/groups", json={"name": "Группа"}, headers=headers)).json()
    first = await create_lesson(client, headers, lesson_body([student["id"]], group_id=group["id"]))

    await create_lesson(client, headers, lesson_body([student["id"]]))

    range_params = {
        "from": datetime.now(UTC).isoformat(),
        "to": (datetime.now(UTC) + timedelta(days=4)).isoformat(),
    }
    grouped = await client.get(f"{BASE}/groups/{group['id']}/lessons", params=range_params)

    assert grouped.status_code == 200, grouped.text
    assert [item["id"] for item in grouped.json()["items"]] == [first["id"]]

    filtered = await client.get(f"{BASE}/lessons", params=range_params | {"group_id": group["id"]})

    assert [item["id"] for item in filtered.json()["items"]] == [first["id"]]

    listing = (await client.get(f"{BASE}/lessons", params=range_params | {"limit": 1})).json()
    cursor = listing["next_after"]
    following = (
        await client.get(
            f"{BASE}/lessons",
            params=range_params
            | {"limit": 1, "after_start": cursor["starts_at"], "after_id": cursor["id"]},
        )
    ).json()

    assert listing["items"][0]["id"] != following["items"][0]["id"]
    assert following["next_after"] is None

    async with client_for(services) as other:
        await teacher(other, inbox, "other@example.com")

        assert (
            await other.get(f"{BASE}/groups/{group['id']}/lessons", params=range_params)
        ).status_code == 404


@pytest.mark.br_035
@pytest.mark.br_099
async def test_shared_student_does_not_reveal_another_teacher_busy_time(client, inbox, services):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    token = await invitation(client, headers, item["id"])
    start = (datetime.now(UTC) + timedelta(days=2)).isoformat()

    async with client_for(services) as student, client_for(services) as other:
        student_headers = await signup(student, inbox, token, "student@example.com")
        first = await create_lesson(
            client,
            headers,
            lesson_body([item["id"]], starts_at=start, private_notes="Чужое расписание"),
        )
        other_headers = await teacher(other, inbox, "other@example.com")
        other_card = await card(other, other_headers)
        other_token = await invitation(other, other_headers, other_card["id"])

        assert (
            await student.post(
                f"{BASE}/student-invitations/accept",
                json={"token": other_token},
                headers=student_headers,
            )
        ).status_code == 201

        second = await create_lesson(
            other, other_headers, lesson_body([other_card["id"]], starts_at=start)
        )

        assert second["warnings"] == []
        assert "Чужое расписание" not in str(second)
        assert (await other.get(f"{BASE}/lessons/{first['id']}")).status_code == 404


@pytest.mark.br_034
@pytest.mark.br_097
async def test_concurrent_overlaps_are_saved_but_second_writer_sees_warning(client, inbox):
    headers = await teacher(client, inbox, "teacher@example.com")
    first, second = await card(client, headers), await card(client, headers)
    start = (datetime.now(UTC) + timedelta(days=2)).isoformat()
    results = await gather(
        *(
            client.post(
                f"{BASE}/lessons", json=lesson_body([item["id"]], starts_at=start), headers=headers
            )
            for item in (first, second)
        )
    )

    assert [result.status_code for result in results] == [201, 201], [
        result.text for result in results
    ]
    assert sorted(len(result.json()["warnings"]) for result in results) == [0, 1]


@pytest.mark.br_095
@pytest.mark.br_097
async def test_group_change_during_snapshot_returns_conflict_without_consuming_request(
    client, inbox, monkeypatch
):
    from asyncio import Event, create_task, wait_for

    from app.integrations.scheduling import PostgresLessonGroups


    headers = await teacher(client, inbox, "teacher@example.com")
    first, second = await card(client, headers), await card(client, headers)
    group = (await client.post(f"{BASE}/groups", json={"name": "Группа"}, headers=headers)).json()
    path = f"{BASE}/groups/{group['id']}/members"

    assert (
        await client.post(
            path, json={"card_id": first["id"], "price": {"amount": "100"}}, headers=headers
        )
    ).status_code == 201

    entered, release = Event(), Event()
    original = PostgresLessonGroups.members


    async def pause(self, group_id, limit):
        result = await original(self, group_id, limit)

        entered.set()
        await release.wait()

        return result


    body = {
        "starts_at": (datetime.now(UTC) + timedelta(days=2)).isoformat(),
        "group_id": group["id"],
        "request_id": str(uuid4()),
    }

    with monkeypatch.context() as patch:
        patch.setattr(PostgresLessonGroups, "members", pause)

        pending = create_task(client.post(f"{BASE}/lessons", json=body, headers=headers))

        await wait_for(entered.wait(), 5)

        added = await client.post(
            path, json={"card_id": second["id"], "price": {"amount": "200"}}, headers=headers
        )

        release.set()

        response = await wait_for(pending, 5)

    assert added.status_code == 201
    assert response.status_code == 409, response.text
    assert response.json()["code"] == "group_conflict"

    saved = await create_lesson(client, headers, body)

    assert len(saved["participants"]) == 2


@pytest.mark.br_030
@pytest.mark.br_094
async def test_minimal_creation_requires_resolvable_price_and_validates_input(client, inbox):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    base = {
        "starts_at": (datetime.now(UTC) + timedelta(days=2)).isoformat(),
        "participants": [{"card_id": student["id"]}],
    }

    assert (await client.post(f"{BASE}/lessons", json=base, headers=headers)).status_code == 422
    assert (
        await client.post(f"{BASE}/lessons", json=lesson_body([student["id"]]))
    ).status_code == 403

    for extra in (
        {"timezone": "Unknown/Zone"},
        {"starts_at": "2030-01-01T10:00:00"},
        {"duration_minutes": 0},
        {"participants": [{"card_id": student["id"], "price": {"amount": "0.001"}}]},
    ):
        assert (
            await client.post(
                f"{BASE}/lessons", json=lesson_body([student["id"]]) | extra, headers=headers
            )
        ).status_code == 422


@pytest.mark.br_030
@pytest.mark.br_094
@pytest.mark.br_095
async def test_selected_profile_price_is_snapshot_and_explicit_price_takes_precedence(
    client, inbox
):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    profile_path = f"{BASE}/students/cards/{student['id']}/profiles"
    profile = (
        await client.post(
            profile_path,
            json={"subject": "Алгебра", "price": {"amount": "321.50"}},
            headers=headers,
        )
    ).json()
    participant = {"card_id": student["id"], "profile_id": profile["id"]}
    body = lesson_body(participants=[participant])
    saved = await create_lesson(client, headers, body)
    override = await create_lesson(
        client, headers, body | {"participants": [participant | {"price": {"amount": "0"}}]}
    )

    assert saved["participants"][0]["price"]["amount"] == "321.50"
    assert saved["participants"][0]["profile_subject"] == "Алгебра"
    assert override["participants"][0]["price"]["amount"] == "0.00"
    assert (
        await client.delete(f"{profile_path}/{profile['id']}", headers=headers)
    ).status_code == 204

    observed = (await client.get(f"{BASE}/lessons/{saved['id']}")).json()

    assert observed["participants"][0]["price"]["amount"] == "321.50"
    assert observed["participants"][0]["profile_subject"] == "Алгебра"


@pytest.mark.br_033
@pytest.mark.br_096
@pytest.mark.br_098
async def test_observer_cannot_become_responsible_implicitly_after_disconnect(
    client, inbox, services
):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    first_token = (await adult_invitation(client, headers, item["id"]))["token"]
    second_token = (await adult_invitation(client, headers, item["id"]))["token"]

    async with client_for(services) as first, client_for(services) as second:
        first_headers = await register_adult(first, inbox, first_token, "first@example.com")

        await register_adult(second, inbox, second_token, "second@example.com")

        second_id = (await second.get(f"{BASE}/me")).json()["id"]

        assert (
            await first.delete(f"{BASE}/me/students/{item['id']}/connection", headers=first_headers)
        ).status_code == 204
        assert (
            await client.post(
                f"{BASE}/lessons",
                json=lesson_body([item["id"]], confirmation=True),
                headers=headers,
            )
        ).status_code == 409
        assert (
            await client.put(
                f"{BASE}/students/cards/{item['id']}/responsibilities/scheduling",
                json={"account_id": second_id},
                headers=headers,
            )
        ).status_code == 200

        saved = await create_lesson(client, headers, lesson_body([item["id"]], confirmation=True))

        assert saved["participants"][0]["confirmation"]["state"] == "pending"


@pytest.mark.br_028
@pytest.mark.br_095
@pytest.mark.br_096
@pytest.mark.br_097
async def test_every_lesson_operation_checks_owner_role_and_csrf(client, inbox, services):
    headers = await teacher(client, inbox, "owner@example.com")
    item = await card(client, headers)
    token = await invitation(client, headers, item["id"])
    saved = await create_lesson(client, headers, lesson_body([item["id"]], confirmation=True))
    path = f"{BASE}/lessons/{saved['id']}"
    patch = {"expected_version": 1, "private_notes": "Подмена"}

    async with client_for(services) as other, client_for(services) as student:
        other_headers = await teacher(other, inbox, "other@example.com")
        student_headers = await signup(student, inbox, token, "student@example.com")

        assert (await other.get(path)).status_code == 404
        assert (await other.get(f"{path}/history")).status_code == 404
        assert (await other.patch(path, json=patch, headers=other_headers)).status_code == 404
        assert (
            await other.delete(path, params={"expected_version": 1}, headers=other_headers)
        ).status_code == 404
        assert (
            await other.post(
                f"{BASE}/lessons", json=lesson_body([item["id"]]), headers=other_headers
            )
        ).status_code == 404
        assert (await student.get(path)).status_code == 403
        assert (await student.patch(path, json=patch, headers=student_headers)).status_code == 403
        assert (await client.patch(path, json=patch)).status_code == 403
        assert (await client.delete(path, params={"expected_version": 1})).status_code == 403
        assert (
            await student.post(
                f"{BASE}/me/teachers/{item['id']}/lessons/{saved['id']}/reply",
                json={"answer": "accepted", "expected_version": 1},
            )
        ).status_code == 403

    assert (await client.get(path)).json()["version"] == 1
    assert len((await client.get(f"{path}/history")).json()["items"]) == 1
