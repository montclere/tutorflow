"""Полный API отмены, запросов, восстановления, изоляции и конкурентных решений."""

from asyncio import gather
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from tests.students_testkit import card, client_for, invitation, signup, teacher
from tests.test_lessons_api import BASE, create_lesson, lesson_body


pytestmark = [
    pytest.mark.anyio,
    pytest.mark.br_044,
    pytest.mark.br_045,
    pytest.mark.br_047,
    pytest.mark.br_048,
    pytest.mark.br_052,
]


async def connected_student(client, inbox, student, headers):
    item = await card(client, headers)
    token = await invitation(client, headers, item["id"])
    student_headers = await signup(student, inbox, token, "student@example.com")

    return item, student_headers


async def test_cancel_restore_keeps_calendar_and_resets_confirmation(client, inbox, services):
    headers = await teacher(client, inbox, "teacher@example.com")

    async with client_for(services) as student:
        item, student_headers = await connected_student(client, inbox, student, headers)
        saved = await create_lesson(client, headers, lesson_body([item["id"]], confirmation=True))
        path = f"{BASE}/lessons/{saved['id']}"
        own = f"{BASE}/me/teachers/{item['id']}/lessons/{saved['id']}"

        assert (
            await student.post(
                f"{own}/reply",
                json={"answer": "accepted", "expected_version": 1},
                headers=student_headers,
            )
        ).status_code == 200

        response = await client.post(
            f"{path}/cancellation",
            json={"cancelled": True, "expected_version": 1, "reason": "Отпуск"},
            headers=headers,
        )

        assert response.status_code == 200, response.text
        assert response.json()["cancelled"] and not response.json()["deleted"]
        assert (await student.get(own)).json()["can_reply"] is False
        assert (
            await client.patch(
                path, json={"expected_version": 2, "title": "Нельзя"}, headers=headers
            )
        ).status_code == 409

        start = datetime.fromisoformat(saved["starts_at"])
        overlapping = await create_lesson(
            client, headers, lesson_body([item["id"]], starts_at=start.isoformat())
        )

        assert overlapping["warnings"] == []

        restored = await client.post(
            f"{path}/cancellation",
            json={"cancelled": False, "expected_version": 2},
            headers=headers,
        )

        assert restored.status_code == 200, restored.text
        assert restored.json()["participants"][0]["confirmation"]["state"] == "pending"
        assert restored.json()["warnings"][0]["event_id"] == overlapping["id"]
        assert [r["kind"] for r in (await client.get(f"{path}/history")).json()["items"]] == [
            "created",
            "reply",
            "cancelled",
            "restored",
        ]


async def test_group_request_cancels_only_own_member_and_hides_other_requests(
    client, inbox, services
):
    headers = await teacher(client, inbox, "teacher@example.com")

    async with client_for(services) as student:
        item, student_headers = await connected_student(client, inbox, student, headers)
        other = await card(client, headers)
        group = (
            await client.post(f"{BASE}/groups", json={"name": "Группа"}, headers=headers)
        ).json()
        saved = await create_lesson(
            client, headers, lesson_body([item["id"], other["id"]], group_id=group["id"])
        )
        path = f"{BASE}/lessons/{saved['id']}"
        own = f"{BASE}/me/teachers/{item['id']}/lessons/{saved['id']}/change-requests"

        assert (
            await student.post(
                own, json={"kind": "reschedule", "expected_version": 1}, headers=student_headers
            )
        ).status_code == 422

        request = await student.post(
            own,
            json={"kind": "cancel", "expected_version": 1, "reason": "Болею"},
            headers=student_headers,
        )

        assert request.status_code == 201, request.text
        assert (await client.get(path)).json()["version"] == 1
        assert (
            await student.post(
                own, json={"kind": "cancel", "expected_version": 1}, headers=student_headers
            )
        ).status_code == 409

        accepted = await client.post(
            f"{path}/change-requests/{request.json()['id']}/decision",
            json={"state": "accepted", "expected_version": 1},
            headers=headers,
        )

        assert accepted.status_code == 200, accepted.text

        changed = (await client.get(path)).json()
        participants = {part["card_id"]: part for part in changed["participants"]}

        assert not changed["cancelled"]
        assert participants[item["id"]]["cancelled"] and not participants[other["id"]]["cancelled"]
        assert (await student.get(own)).json()["items"][0]["state"] == "accepted"
        assert (await student.get(own.replace(item["id"], other["id"]))).status_code == 404
        assert (
            await client.post(f"{BASE}/students/cards/{other['id']}/archive", headers=headers)
        ).status_code == 200

        restored = await client.post(
            f"{path}/cancellation",
            json={"cancelled": False, "card_id": item["id"], "expected_version": 2},
            headers=headers,
        )

        assert restored.status_code == 200, restored.text
        assert all(not part["cancelled"] for part in restored.json()["participants"])


async def test_reschedule_request_is_versioned_and_concurrent_decision_runs_once(
    client, inbox, services
):
    headers = await teacher(client, inbox, "teacher@example.com")

    async with client_for(services) as student:
        item, student_headers = await connected_student(client, inbox, student, headers)
        saved = await create_lesson(client, headers, lesson_body([item["id"]]))
        path = f"{BASE}/lessons/{saved['id']}"
        own = f"{BASE}/me/teachers/{item['id']}/lessons/{saved['id']}/change-requests"
        new_time = (datetime.now(UTC) + timedelta(days=3)).isoformat()
        requested = (
            await student.post(
                own,
                json={"kind": "reschedule", "expected_version": 1, "proposed_start": new_time},
                headers=student_headers,
            )
        ).json()
        decision = f"{path}/change-requests/{requested['id']}/decision"
        results = await gather(
            *(
                client.post(
                    decision, json={"state": "accepted", "expected_version": 1}, headers=headers
                )
                for _ in range(2)
            )
        )

        assert sorted(r.status_code for r in results) == [200, 409], [r.text for r in results]
        assert (await client.get(path)).json()["starts_at"] == new_time.replace("+00:00", "Z")

        pending = (
            await student.post(
                own, json={"kind": "cancel", "expected_version": 2}, headers=student_headers
            )
        ).json()

        assert (
            await client.patch(
                path, json={"expected_version": 2, "title": "Изменённое занятие"}, headers=headers
            )
        ).status_code == 200
        assert (await student.get(own)).json()["items"][
            0 if pending["id"] < requested["id"] else 1
        ]["state"] == "superseded"
        assert (
            await client.post(
                f"{path}/change-requests/{pending['id']}/decision",
                json={"state": "accepted", "expected_version": 3},
                headers=headers,
            )
        ).status_code == 409


async def test_withdraw_reject_permissions_and_csrf(client, inbox, services):
    headers = await teacher(client, inbox, "teacher@example.com")

    async with client_for(services) as student, client_for(services) as other:
        item, student_headers = await connected_student(client, inbox, student, headers)
        saved = await create_lesson(client, headers, lesson_body([item["id"]]))
        path = f"{BASE}/lessons/{saved['id']}"
        own = f"{BASE}/me/teachers/{item['id']}/lessons/{saved['id']}/change-requests"
        other_headers = await teacher(other, inbox, "other@example.com")
        body = {"kind": "cancel", "expected_version": 1}

        assert (await student.post(own, json=body)).status_code == 403
        assert (
            await client.post(
                f"{path}/cancellation", json={"cancelled": True, "expected_version": 1}
            )
        ).status_code == 403
        assert (
            await other.post(
                f"{path}/cancellation",
                json={"cancelled": True, "expected_version": 1},
                headers=other_headers,
            )
        ).status_code == 404

        first = (await student.post(own, json=body, headers=student_headers)).json()
        withdraw = await student.post(
            f"{own}/{first['id']}/withdraw", json={"expected_version": 1}, headers=student_headers
        )

        assert withdraw.status_code == 200, withdraw.text
        assert withdraw.json()["state"] == "withdrawn"

        second = (await student.post(own, json=body, headers=student_headers)).json()
        rejected = await client.post(
            f"{path}/change-requests/{second['id']}/decision",
            json={"state": "rejected", "expected_version": 1},
            headers=headers,
        )

        assert rejected.status_code == 200 and rejected.json()["state"] == "rejected"
        assert (await client.get(path)).json()["version"] == 1
        assert (await other.get(f"{path}/change-requests")).status_code == 404
        assert (
            await client.post(
                f"{path}/change-requests/{uuid4()}/decision",
                json={"state": "accepted", "expected_version": 1},
                headers=headers,
            )
        ).status_code == 404


async def test_restored_series_occurrence_stays_exception(client, inbox):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    response = await client.post(
        f"{BASE}/lesson-series",
        json={
            "lesson": lesson_body([item["id"]]),
            "recurrence": {"frequency": "daily", "count": 3},
        },
        headers=headers,
    )

    assert response.status_code == 201, response.text

    series_id = (
        response.json()["series"]["id"] if "series" in response.json() else response.json()["id"]
    )
    start = datetime.now(UTC)
    end = start + timedelta(days=7)
    params = {"from": start.isoformat(), "to": end.isoformat()}
    lessons = (await client.get(f"{BASE}/lessons", params=params)).json()["items"]
    selected = lessons[0]
    path = f"{BASE}/lessons/{selected['id']}"

    assert (
        await client.post(
            f"{path}/cancellation", json={"expected_version": 1, "cancelled": True}, headers=headers
        )
    ).status_code == 200
    assert (
        await client.post(
            f"{BASE}/lesson-series/{series_id}/prepare",
            json={"starts_at": start.isoformat(), "ends_at": end.isoformat()},
            headers=headers,
        )
    ).status_code == 200
    assert (await client.get(path)).json()["cancelled"]
    assert (
        await client.post(
            f"{path}/cancellation",
            json={"expected_version": 2, "cancelled": False},
            headers=headers,
        )
    ).status_code == 200
    assert len((await client.get(f"{BASE}/lessons", params=params)).json()["items"]) == 3


async def test_request_acceptance_audit_failure_rolls_back(client, inbox, services, monkeypatch):
    from app.modules.scheduling.infrastructure.persistence.lesson_repository import (
        PostgresLessonsRepository,
    )


    headers = await teacher(client, inbox, "teacher@example.com")

    async with client_for(services) as student:
        item, student_headers = await connected_student(client, inbox, student, headers)
        saved = await create_lesson(client, headers, lesson_body([item["id"]]))
        path = f"{BASE}/lessons/{saved['id']}"
        own = f"{BASE}/me/teachers/{item['id']}/lessons/{saved['id']}/change-requests"
        requested = (
            await student.post(
                own, json={"kind": "cancel", "expected_version": 1}, headers=student_headers
            )
        ).json()
        original = PostgresLessonsRepository.append_revision


        async def fail(self, revision):
            await original(self, revision)

            raise RuntimeError("audit unavailable")


        with monkeypatch.context() as patch:
            patch.setattr(PostgresLessonsRepository, "append_revision", fail)

            response = await client.post(
                f"{path}/change-requests/{requested['id']}/decision",
                json={"state": "accepted", "expected_version": 1},
                headers=headers,
            )

        assert response.status_code == 500
        assert not (await client.get(path)).json()["cancelled"]
        assert (await student.get(own)).json()["items"][0]["state"] == "pending"
        assert len((await client.get(f"{path}/history")).json()["items"]) == 1


async def test_cancelled_future_lesson_can_be_removed_without_losing_history(client, inbox):
    headers = await teacher(client, inbox, "teacher@example.com")
    item = await card(client, headers)
    saved = await create_lesson(client, headers, lesson_body([item["id"]]))
    path = f"{BASE}/lessons/{saved['id']}"

    assert (
        await client.post(
            f"{path}/cancellation", json={"expected_version": 1, "cancelled": True}, headers=headers
        )
    ).status_code == 200
    assert (
        await client.delete(path, params={"expected_version": 1}, headers=headers)
    ).status_code == 409

    removed = await client.delete(path, params={"expected_version": 2}, headers=headers)

    assert removed.status_code == 204, removed.text
    assert (await client.get(path)).status_code == 404

    history = (await client.get(f"{path}/history")).json()["items"]

    assert [row["kind"] for row in history] == ["created", "cancelled", "deleted"]
    assert history[-1]["lesson"]["cancelled"] and history[-1]["lesson"]["deleted"]
