"""Сквозные проверки регулярного расписания, исключений, прав и конкурентных записей."""

from asyncio import gather
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from tests.students_testkit import card, client_for, invitation, signup, teacher


pytestmark = pytest.mark.anyio
BASE = "/api/v1"


def series_body(card_id, **values):
    return (
        dict(
            recurrence={"frequency": "daily", "count": 3},
            lesson={
                "starts_at": (datetime.now(UTC) + timedelta(days=2)).isoformat(),
                "participants": [{"card_id": card_id, "price": {"amount": "100"}}],
                "private_notes": "Только преподавателю",
            },
        )
        | values
    )


async def create_series(client, headers, body):
    response = await client.post(f"{BASE}/lesson-series", json=body, headers=headers)

    assert response.status_code == 201, response.text

    return response.json()


async def calendar(client, start=None, end=None):
    start = start or datetime.now(UTC)
    end = end or start + timedelta(days=10)
    response = await client.get(
        f"{BASE}/lessons", params={"from": start.isoformat(), "to": end.isoformat()}
    )

    assert response.status_code == 200, response.text

    return response.json()["items"]


@pytest.mark.br_037
@pytest.mark.br_038
@pytest.mark.br_042
async def test_series_materializes_stable_instances_and_replays_one_request(client, inbox):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    body = series_body(student["id"], request_id=str(uuid4()))
    saved = await create_series(client, headers, body)
    replay = await create_series(client, headers, body)
    first = await calendar(client)
    again = await calendar(client)

    assert replay["id"] == saved["id"]
    assert len(first) == 3
    assert [item["id"] for item in first] == [item["id"] for item in again]
    assert {item["series_id"] for item in first} == {saved["id"]}
    assert all(item["participants"][0]["price"]["amount"] == "100.00" for item in first)
    assert (
        len((await client.get(f"{BASE}/lesson-series/{saved['id']}/history")).json()["items"]) == 1
    )
    assert (
        await client.post(
            f"{BASE}/lesson-series",
            json=body | {"recurrence": {"frequency": "daily", "count": 4}},
            headers=headers,
        )
    ).status_code == 409


@pytest.mark.br_037
@pytest.mark.br_043
async def test_existing_lesson_becomes_first_instance_without_duplicate(client, inbox):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    lesson = (
        await client.post(
            f"{BASE}/lessons", json=series_body(student["id"])["lesson"], headers=headers
        )
    ).json()
    saved = await create_series(
        client,
        headers,
        {
            "source_lesson_id": lesson["id"],
            "source_version": lesson["version"],
            "recurrence": {"frequency": "daily", "count": 3},
        },
    )
    events = await calendar(client)

    assert len(events) == 3
    assert events[0]["id"] == lesson["id"]
    assert events[0]["series_id"] == saved["id"]
    assert (
        await client.post(
            f"{BASE}/lesson-series",
            json={
                "source_lesson_id": lesson["id"],
                "source_version": 2,
                "recurrence": {"frequency": "daily"},
            },
            headers=headers,
        )
    ).status_code == 409


@pytest.mark.br_040
@pytest.mark.br_043
async def test_moved_exception_survives_future_change_and_explicit_overwrite(client, inbox):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    saved = await create_series(client, headers, series_body(student["id"]))
    initial = await calendar(client)
    original_start = datetime.fromisoformat(initial[0]["starts_at"])
    moved_start = original_start + timedelta(hours=2)
    moved = await client.patch(
        f"{BASE}/lessons/{initial[0]['id']}",
        json={"expected_version": 1, "starts_at": moved_start.isoformat()},
        headers=headers,
    )

    assert moved.status_code == 200, moved.text

    changed = await client.patch(
        f"{BASE}/lesson-series/{saved['id']}",
        json={
            "expected_version": 1,
            "recurrence": {
                "frequency": "daily",
                "count": 3,
                "starts_at": (original_start + timedelta(hours=1)).isoformat(),
            },
        },
        headers=headers,
    )

    assert changed.status_code == 200, changed.text
    assert changed.json()["impact"]["exceptions"] == [initial[0]["id"]]

    events = await calendar(client)

    assert len(events) == 3
    assert (
        next(item for item in events if item["id"] == initial[0]["id"])["starts_at"]
        == moved.json()["starts_at"]
    )
    assert len({item["original_date"] for item in events}) == 3

    overwritten = await client.patch(
        f"{BASE}/lesson-series/{saved['id']}",
        json={
            "expected_version": 2,
            "overwrite_exceptions": True,
            "recurrence": {
                "frequency": "daily",
                "count": 3,
                "starts_at": (original_start + timedelta(hours=3)).isoformat(),
            },
        },
        headers=headers,
    )

    assert overwritten.status_code == 200, overwritten.text
    assert len(await calendar(client)) == 3
    assert initial[0]["id"] not in {item["id"] for item in await calendar(client)}


@pytest.mark.br_040
async def test_following_scope_preserves_preceding_future_lessons(client, inbox):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    saved = await create_series(client, headers, series_body(student["id"]))
    events = await calendar(client)
    cutoff = datetime.fromisoformat(events[2]["starts_at"])
    changed = await client.patch(
        f"{BASE}/lesson-series/{saved['id']}",
        json={
            "expected_version": 1,
            "effective_at": cutoff.isoformat(),
            "recurrence": {
                "frequency": "daily",
                "count": 2,
                "starts_at": (cutoff + timedelta(hours=1)).isoformat(),
            },
        },
        headers=headers,
    )

    assert changed.status_code == 200, changed.text

    revised = await calendar(client)

    assert len(revised) == 4
    assert [item["id"] for item in revised[:2]] == [item["id"] for item in events[:2]]
    assert [item["version"] for item in revised[:2]] == [1, 1]


@pytest.mark.br_039
@pytest.mark.br_040
@pytest.mark.br_041
@pytest.mark.br_043
async def test_series_consent_individual_decline_and_confirmed_pause_require_explicit_action(
    client, inbox, services
):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    token = await invitation(client, headers, student["id"])

    async with client_for(services) as learner:
        learner_headers = await signup(learner, inbox, token, "student@example.com")
        body = series_body(student["id"])

        body["lesson"]["confirmation"] = True

        saved = await create_series(client, headers, body)
        own_path = f"{BASE}/me/teachers/{student['id']}/lesson-series/{saved['id']}"
        observed = await learner.get(own_path)

        assert observed.status_code == 200, observed.text
        assert observed.json()["can_reply"] is True
        assert "private_notes" not in observed.text and "participants" not in observed.text
        assert "Только преподавателю" not in observed.text
        assert (await learner.get(f"{BASE}/lesson-series/{saved['id']}")).status_code == 403

        accepted = await learner.post(
            f"{own_path}/reply",
            json={"answer": "accepted", "expected_version": 1},
            headers=learner_headers,
        )

        assert accepted.status_code == 200, accepted.text

        events = await calendar(client)
        lesson_path = f"{BASE}/me/teachers/{student['id']}/lessons/{events[0]['id']}"
        declined = await learner.post(
            f"{lesson_path}/reply",
            json={"answer": "declined", "expected_version": events[0]["version"]},
            headers=learner_headers,
        )

        assert declined.status_code == 200, declined.text

        for answer in ("declined", "accepted"):
            assert (
                await learner.post(
                    f"{own_path}/reply",
                    json={"answer": answer, "expected_version": 1},
                    headers=learner_headers,
                )
            ).status_code == 200

        responses = await calendar(client)

        assert [item["participants"][0]["confirmation"]["state"] for item in responses] == [
            "declined",
            "accepted",
            "accepted",
        ]

        start = datetime.fromisoformat(events[1]["starts_at"])
        pause_body = {
            "expected_version": 1,
            "starts_at": start.isoformat(),
            "ends_at": (start + timedelta(hours=2)).isoformat(),
        }
        preview = await client.post(
            f"{BASE}/lesson-series/{saved['id']}/pauses",
            json=pause_body | {"preview": True},
            headers=headers,
        )

        assert preview.status_code == 200, preview.text
        assert events[1]["id"] in preview.json()["impact"]["confirmed"]
        assert (
            await client.post(
                f"{BASE}/lesson-series/{saved['id']}/pauses", json=pause_body, headers=headers
            )
        ).status_code == 409
        assert len(await calendar(client)) == 3

        paused = await client.post(
            f"{BASE}/lesson-series/{saved['id']}/pauses",
            json=pause_body | {"allow_confirmed": True},
            headers=headers,
        )

        assert paused.status_code == 200, paused.text
        assert len(await calendar(client)) == 2

        pause_id = paused.json()["pauses"][0]["id"]
        resumed = await client.post(
            f"{BASE}/lesson-series/{saved['id']}/pauses/{pause_id}/resume",
            json={"expected_version": 2},
            headers=headers,
        )

        assert resumed.status_code == 200, resumed.text
        assert len(await calendar(client)) == 3


@pytest.mark.br_038
@pytest.mark.br_040
@pytest.mark.br_043
async def test_concurrent_creation_preparation_and_changes_are_serialized(client, inbox):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    body = series_body(student["id"], request_id=str(uuid4()))
    created = await gather(
        *(client.post(f"{BASE}/lesson-series", json=body, headers=headers) for _ in range(2))
    )

    assert [item.status_code for item in created] == [201, 201], [item.text for item in created]
    assert created[0].json()["id"] == created[1].json()["id"]

    series_id = created[0].json()["id"]
    prepared = await gather(*(client.get(f"{BASE}/lesson-series/{series_id}") for _ in range(2)))

    assert [item.status_code for item in prepared] == [200, 200]
    assert len(await calendar(client)) == 3

    modifications = await gather(
        *(
            client.patch(
                f"{BASE}/lesson-series/{series_id}",
                json={"expected_version": 1, "recurrence": {"frequency": "daily", "count": count}},
                headers=headers,
            )
            for count in (4, 5)
        )
    )

    assert sorted(item.status_code for item in modifications) == [200, 409], [
        item.text for item in modifications
    ]
    assert len((await client.get(f"{BASE}/lesson-series/{series_id}/history")).json()["items"]) == 2


@pytest.mark.br_037
@pytest.mark.br_038
@pytest.mark.br_040
async def test_unbounded_series_prepares_later_range_without_ending_at_horizon(client, inbox):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    saved = await create_series(
        client, headers, series_body(student["id"], recurrence={"frequency": "weekly"})
    )
    start = datetime.now(UTC) + timedelta(days=400)
    events = await calendar(client, start, start + timedelta(days=28))

    assert len(events) == 4
    assert {item["series_id"] for item in events} == {saved["id"]}
    assert saved["segments"][0]["recurrence"]["count"] is None
    assert saved["segments"][0]["recurrence"]["until"] is None


@pytest.mark.br_037
@pytest.mark.br_040
@pytest.mark.br_041
async def test_series_operations_enforce_owner_csrf_and_source_version(client, inbox, services):
    headers = await teacher(client, inbox, "owner@example.com")
    student = await card(client, headers)
    saved = await create_series(client, headers, series_body(student["id"]))
    path = f"{BASE}/lesson-series/{saved['id']}"

    assert (await client.patch(path, json={"expected_version": 1})).status_code == 403
    assert (await client.delete(path, params={"expected_version": 1})).status_code == 403

    async with client_for(services) as other:
        other_headers = await teacher(other, inbox, "other@example.com")

        assert (await other.get(path)).status_code == 404
        assert (await other.get(f"{path}/history")).status_code == 404
        assert (
            await other.patch(path, json={"expected_version": 1}, headers=other_headers)
        ).status_code == 404
        assert (
            await other.delete(path, params={"expected_version": 1}, headers=other_headers)
        ).status_code == 404
        assert (
            await other.post(
                f"{path}/pauses",
                json={
                    "expected_version": 1,
                    "starts_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
                },
                headers=other_headers,
            )
        ).status_code == 404
        assert (
            await other.post(
                f"{BASE}/lesson-series", json=series_body(student["id"]), headers=other_headers
            )
        ).status_code == 404

    assert (
        await client.patch(path, json={"expected_version": 2}, headers=headers)
    ).status_code == 409
    assert (await client.get(path)).json()["version"] == 1


@pytest.mark.br_042
async def test_group_series_uses_snapshot_and_explicit_membership_refresh(client, inbox):
    headers = await teacher(client, inbox, "teacher@example.com")
    first = await card(client, headers, "Первый")
    second = await card(client, headers, "Второй")
    group = (await client.post(f"{BASE}/groups", json={"name": "Группа"}, headers=headers)).json()

    assert (
        await client.post(
            f"{BASE}/groups/{group['id']}/members",
            json={"card_id": first["id"], "price": {"amount": "200"}},
            headers=headers,
        )
    ).status_code == 201

    body = series_body(first["id"])

    body["lesson"].pop("participants")

    body["lesson"]["group_id"] = group["id"]

    saved = await create_series(client, headers, body)

    assert (
        await client.post(
            f"{BASE}/groups/{group['id']}/members",
            json={"card_id": second["id"], "price": {"amount": "300"}},
            headers=headers,
        )
    ).status_code == 201
    assert all(len(item["participants"]) == 1 for item in await calendar(client))

    refreshed = await client.patch(
        f"{BASE}/lesson-series/{saved['id']}",
        json={"expected_version": 1, "refresh_group": True},
        headers=headers,
    )

    assert refreshed.status_code == 200, refreshed.text
    assert all(
        {part["name"] for part in item["participants"]} == {"Первый", "Второй"}
        for item in await calendar(client)
    )
    assert all(
        {part["price"]["amount"] for part in item["participants"]} == {"200.00", "300.00"}
        for item in await calendar(client)
    )


@pytest.mark.br_039
@pytest.mark.br_040
@pytest.mark.br_041
async def test_series_creation_audit_failure_rolls_back_series_lessons_and_request(
    client, inbox, database, monkeypatch
):
    from sqlalchemy import text

    from app.modules.scheduling.infrastructure.persistence.lesson_repository import (
        PostgresLessonsRepository,
    )


    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    body = series_body(student["id"], request_id=str(uuid4()))
    original = PostgresLessonsRepository.append_revision


    async def fail(self, revision):
        raise RuntimeError("audit unavailable")


    monkeypatch.setattr(PostgresLessonsRepository, "append_revision", fail)

    failed = await client.post(f"{BASE}/lesson-series", json=body, headers=headers)

    assert failed.status_code == 500

    async with database.connect() as connection:
        for table in (
            "scheduling_series",
            "scheduling_series_members",
            "scheduling_series_revisions",
            "scheduling_series_occurrences",
            "scheduling_lessons",
        ):
            assert await connection.scalar(text(f"SELECT count(*) FROM {table}")) == 0

    monkeypatch.setattr(PostgresLessonsRepository, "append_revision", original)

    await create_series(client, headers, body)

    assert len(await calendar(client)) == 3


@pytest.mark.br_038
async def test_configured_budget_returns_error_instead_of_partial_calendar(database, inbox):
    from tests.identity_testkit import IDENTITY_SECRET

    from app.composition import build_services
    from app.modules.scheduling.domain.policies import LessonPolicy, SeriesPolicy


    controlled = await build_services(
        database,
        IDENTITY_SECRET,
        inbox,
        secure_cookie=True,
        lesson_policy=LessonPolicy(page_max_size=2),
        series_policy=SeriesPolicy(preparation_days=1, expansion_limit=2),
    )

    async with client_for(controlled) as owner:
        headers = await teacher(owner, inbox, "teacher@example.com")
        student = await card(owner, headers)
        body = series_body(student["id"])
        saved = await create_series(owner, headers, body)
        start = datetime.fromisoformat(body["lesson"]["starts_at"])
        wide = await owner.post(
            f"{BASE}/lesson-series/{saved['id']}/prepare",
            json={
                "starts_at": start.isoformat(),
                "ends_at": (start + timedelta(days=4)).isoformat(),
            },
            headers=headers,
        )

        assert wide.status_code == 422, wide.text
        assert (await owner.get(f"{BASE}/lesson-series")).status_code == 200
        assert (await owner.get(f"{BASE}/lesson-series/{saved['id']}/history")).status_code == 200

        narrow = await owner.post(
            f"{BASE}/lesson-series/{saved['id']}/prepare",
            json={
                "starts_at": start.isoformat(),
                "ends_at": (start + timedelta(days=2)).isoformat(),
            },
            headers=headers,
        )

        assert narrow.status_code == 200, narrow.text
        assert len(await calendar(owner, start, start + timedelta(days=2))) == 2


@pytest.mark.br_039
@pytest.mark.br_040
@pytest.mark.br_041
async def test_future_edits_and_series_deletion_preserve_started_lessons(database, inbox):
    from tests.identity_testkit import IDENTITY_SECRET

    from app.composition import build_services


    clock = [datetime(2030, 1, 1, tzinfo=UTC)]
    controlled = await build_services(
        database, IDENTITY_SECRET, inbox, secure_cookie=True, lesson_clock=lambda: clock[0]
    )

    async with client_for(controlled) as owner:
        headers = await teacher(owner, inbox, "teacher@example.com")
        student = await card(owner, headers)
        body = series_body(student["id"])

        body["lesson"]["starts_at"] = "2030-01-02T10:00:00Z"

        saved = await create_series(owner, headers, body)
        begin, end = clock[0], datetime(2030, 1, 10, tzinfo=UTC)
        original = await calendar(owner, begin, end)

        clock[0] = datetime(2030, 1, 3, 12, tzinfo=UTC)

        updated = await owner.patch(
            f"{BASE}/lesson-series/{saved['id']}",
            json={
                "expected_version": 1,
                "recurrence": {
                    "frequency": "daily",
                    "count": 4,
                    "starts_at": "2030-01-04T11:00:00Z",
                },
            },
            headers=headers,
        )

        assert updated.status_code == 200, updated.text
        assert len(await calendar(owner, begin, end)) == 6

        removed = await owner.delete(
            f"{BASE}/lesson-series/{saved['id']}", params={"expected_version": 2}, headers=headers
        )

        assert removed.status_code == 200, removed.text

        remaining = await calendar(owner, begin, end)

        assert [item["id"] for item in remaining] == [item["id"] for item in original[:2]]
        assert [item["version"] for item in remaining] == [1, 1]

        for item in remaining:
            history = await owner.get(f"{BASE}/lessons/{item['id']}/history")

            assert len(history.json()["items"]) == 1


@pytest.mark.br_038
async def test_calendar_materializes_lesson_that_starts_before_requested_interval(client, inbox):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    body = series_body(student["id"], recurrence={"frequency": "weekly"})

    await create_series(client, headers, body)

    future_start = datetime.fromisoformat(body["lesson"]["starts_at"]) + timedelta(weeks=120)
    inside = future_start + timedelta(minutes=30)
    events = await calendar(client, inside, inside + timedelta(minutes=5))

    assert len(events) == 1
    assert datetime.fromisoformat(events[0]["starts_at"]) == future_start


@pytest.mark.br_040
@pytest.mark.br_043
async def test_retired_revisions_do_not_consume_active_preparation_budget(database, inbox):
    from tests.identity_testkit import IDENTITY_SECRET

    from app.composition import build_services
    from app.modules.scheduling.domain.policies import SeriesPolicy


    controlled = await build_services(
        database,
        IDENTITY_SECRET,
        inbox,
        secure_cookie=True,
        series_policy=SeriesPolicy(preparation_days=5, expansion_limit=4),
    )

    async with client_for(controlled) as owner:
        headers = await teacher(owner, inbox, "teacher@example.com")
        student = await card(owner, headers)
        saved = await create_series(owner, headers, series_body(student["id"]))

        rejected = await owner.patch(
            f"{BASE}/lesson-series/{saved['id']}",
            json={
                "expected_version": 1,
                "recurrence": {
                    "frequency": "daily",
                    "count": 10,
                    "starts_at": (datetime.now(UTC) + timedelta(hours=1)).isoformat(),
                },
            },
            headers=headers,
        )

        assert rejected.status_code == 422, rejected.text
        assert (await owner.get(f"{BASE}/lesson-series/{saved['id']}")).json()["version"] == 1
        assert len(await calendar(owner)) == 3

        for version in range(1, 5):
            updated = await owner.patch(
                f"{BASE}/lesson-series/{saved['id']}",
                json={"expected_version": version},
                headers=headers,
            )

            assert updated.status_code == 200, updated.text

        assert len(await calendar(owner)) == 3
        assert (
            len((await owner.get(f"{BASE}/lesson-series/{saved['id']}/history")).json()["items"])
            == 5
        )
