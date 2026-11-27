"""Результаты проведения, персональная посещаемость и защита истории занятий."""

from asyncio import gather
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from tests.identity_testkit import IDENTITY_SECRET
from tests.students_testkit import card, client_for, invitation, signup, teacher
from tests.test_lessons_api import BASE, create_lesson, lesson_body

from app.composition import build_services


pytestmark = [
    pytest.mark.br_053,
    pytest.mark.br_054,
    pytest.mark.br_055,
    pytest.mark.br_056,
    pytest.mark.br_057,
    pytest.mark.br_061,
]


@pytest.mark.anyio
async def test_completion_is_manual_private_versioned_and_correctable(database, inbox):
    clock = [datetime.now(UTC)]
    services = await build_services(
        database, IDENTITY_SECRET, inbox, secure_cookie=True, lesson_clock=lambda: clock[0]
    )

    async with (
        client_for(services) as owner,
        client_for(services) as student,
        client_for(services) as other,
    ):
        headers = await teacher(owner, inbox, "teacher@example.com")
        item = await card(owner, headers)
        second = await card(owner, headers)
        token = await invitation(owner, headers, item["id"])
        student_headers = await signup(student, inbox, token, "student@example.com")
        start = clock[0] + timedelta(hours=1)
        saved = await create_lesson(
            owner, headers, lesson_body([item["id"], second["id"]], starts_at=start.isoformat())
        )
        path = f"{BASE}/lessons/{saved['id']}"
        body = {
            "expected_version": 1,
            "outcome": "held",
            "attendance": [
                {"card_id": item["id"], "attendance": "present"},
                {"card_id": second["id"], "attendance": "absent"},
            ],
            "notes": "Личная заметка",
        }

        assert (
            await owner.post(f"{path}/completion", json=body, headers=headers)
        ).status_code == 409

        clock[0] += timedelta(hours=3)
        query = {"from": start.isoformat(), "to": clock[0].isoformat()}
        pending = await owner.get(f"{BASE}/lessons/needs-completion", params=query)

        assert pending.status_code == 200, pending.text
        assert pending.json()["items"][0]["outcome"] == "unrecorded"
        assert (await owner.get(path)).json()["outcome"] == "unrecorded"
        assert (await owner.post(f"{path}/completion", json=body)).status_code == 403
        assert (
            await student.post(f"{path}/completion", json=body, headers=student_headers)
        ).status_code == 403

        other_headers = await teacher(other, inbox, "other@example.com")

        assert (
            await other.post(f"{path}/completion", json=body, headers=other_headers)
        ).status_code == 404

        results = await gather(
            *(owner.post(f"{path}/completion", json=body, headers=headers) for _ in range(2))
        )

        assert sorted(r.status_code for r in results) == [200, 409], [r.text for r in results]

        own = (await student.get(f"{BASE}/me/teachers/{item['id']}/lessons/{saved['id']}")).json()

        assert own["outcome"] == "held" and own["attendance"] == "present"
        assert "Личная заметка" not in str(own) and second["id"] not in str(own)
        assert (await owner.get(f"{BASE}/lessons/needs-completion", params=query)).json()[
            "items"
        ] == []

        corrected = await owner.post(
            f"{path}/completion",
            json={
                "expected_version": 2,
                "outcome": "not_held",
                "attendance": [{"card_id": item["id"], "attendance": "absent"}],
            },
            headers=headers,
        )

        assert corrected.status_code == 200, corrected.text
        assert corrected.json()["outcome"] == "not_held"
        assert [r["kind"] for r in (await owner.get(f"{path}/history")).json()["items"]] == [
            "created",
            "completed",
            "completed",
        ]


@pytest.mark.anyio
async def test_completion_failure_rolls_back_and_rejects_foreign_attendance(
    database, inbox, monkeypatch
):
    from tests.postgres_testkit import check_schema

    from app.modules.scheduling.infrastructure.persistence.lesson_repository import (
        PostgresLessonsRepository,
    )


    clock = [datetime.now(UTC)]
    services = await build_services(
        database, IDENTITY_SECRET, inbox, secure_cookie=True, lesson_clock=lambda: clock[0]
    )

    async with client_for(services) as owner:
        headers = await teacher(owner, inbox, "teacher@example.com")
        item = await card(owner, headers)
        saved = await create_lesson(
            owner,
            headers,
            lesson_body([item["id"]], starts_at=(clock[0] + timedelta(hours=1)).isoformat()),
        )
        path = f"{BASE}/lessons/{saved['id']}"
        body = {"expected_version": 1, "outcome": "held"}

        clock[0] += timedelta(hours=3)

        for attendance in (
            [{"card_id": str(uuid4()), "attendance": "present"}],
            [{"card_id": item["id"], "attendance": "present"}] * 2,
        ):
            invalid = await owner.post(
                f"{path}/completion", json=body | {"attendance": attendance}, headers=headers
            )

            assert invalid.status_code == 422, invalid.text

        original = PostgresLessonsRepository.append_revision


        async def fail(self, revision):
            await original(self, revision)

            raise RuntimeError("audit unavailable")


        with monkeypatch.context() as patch:
            patch.setattr(PostgresLessonsRepository, "append_revision", fail)

            assert (
                await owner.post(f"{path}/completion", json=body, headers=headers)
            ).status_code == 500

        unchanged = (await owner.get(path)).json()

        assert unchanged["outcome"] == "unrecorded" and unchanged["version"] == 1
        assert len((await owner.get(f"{path}/history")).json()["items"]) == 1

    await check_schema(database)
