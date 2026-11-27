"""Запись на свободное время, права, резервы, альтернативы и личные удобные часы."""

from asyncio import gather
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from tests.identity_testkit import IDENTITY_SECRET
from tests.students_testkit import (
    adult_invitation,
    card,
    client_for,
    invitation,
    register_adult,
    signup,
    teacher,
)
from tests.test_lessons_api import BASE, create_lesson, lesson_body

from app.composition import build_services
from app.modules.scheduling.domain.availability_policy import AvailabilityPolicy


pytestmark = [
    pytest.mark.anyio,
    *[
        pytest.mark.br_062,
        pytest.mark.br_063,
        pytest.mark.br_064,
        pytest.mark.br_065,
        pytest.mark.br_066,
        pytest.mark.br_067,
        pytest.mark.br_068,
        pytest.mark.br_069,
        pytest.mark.br_070,
    ],
]


def start_time():
    return (datetime.now(UTC) + timedelta(days=2)).replace(
        hour=10, minute=0, second=0, microsecond=0
    )


def publication_body(start=None, **overrides):
    start = start or start_time()

    return {
        "windows": [
            {"starts_at": start.isoformat(), "ends_at": (start + timedelta(hours=4)).isoformat()}
        ],
        "price": {"amount": "250"},
        "duration_minutes": 60,
        "step_minutes": 30,
    } | overrides


async def publish(owner, headers, body=None):
    response = await owner.post(
        f"{BASE}/availability", json=body or publication_body(), headers=headers
    )

    assert response.status_code == 201, response.text

    return response.json()


async def connect(owner, headers, student, inbox, email):
    item = await card(owner, headers)
    token = await invitation(owner, headers, item["id"])
    student_headers = await signup(student, inbox, token, email)

    return item, student_headers


def query(start=None):
    start = start or start_time()

    return {"from": start.isoformat(), "to": (start + timedelta(hours=4)).isoformat()}


def book_body(publication, start=None):
    return {
        "publication_id": publication["id"],
        "expected_version": publication["version"],
        "starts_at": (start or start_time()).isoformat(),
        "request_id": str(uuid4()),
    }


async def test_instant_booking_replays_and_preserves_remaining_slots(client, inbox, services):
    headers = await teacher(client, inbox, "teacher@example.com")

    async with client_for(services) as student:
        item, student_headers = await connect(
            client, headers, student, inbox, "student@example.com"
        )
        publication = await publish(client, headers)
        own = f"{BASE}/me/teachers/{item['id']}"
        slots = await student.get(f"{own}/available-slots", params=query())

        assert slots.status_code == 200, slots.text
        assert len(slots.json()) == 7
        assert set(slots.json()[0]) == {
            "publication_id",
            "version",
            "starts_at",
            "ends_at",
            "price",
        }

        body = book_body(publication)
        booked = await student.post(f"{own}/bookings", json=body, headers=student_headers)

        assert booked.status_code == 201, booked.text
        assert booked.json()["state"] == "accepted"

        replay = await student.post(f"{own}/bookings", json=body, headers=student_headers)

        assert replay.status_code == 201 and replay.json()["id"] == booked.json()["id"]
        assert (
            await student.post(
                f"{own}/bookings",
                json=body | {"starts_at": (start_time() + timedelta(hours=2)).isoformat()},
                headers=student_headers,
            )
        ).status_code == 409

        remaining = (await student.get(f"{own}/available-slots", params=query())).json()
        lesson = (await student.get(f"{own}/lessons/{booked.json()['lesson_id']}")).json()

        assert len(remaining) == 5 and remaining[0]["starts_at"] == (
            start_time() + timedelta(hours=1)
        ).isoformat().replace("+00:00", "Z")
        assert lesson["price"]["amount"] == "250.00"
        assert len((await client.get(f"{BASE}/lessons", params=query())).json()["items"]) == 1


async def test_competing_students_cannot_book_same_time(client, inbox, services):
    headers = await teacher(client, inbox, "teacher@example.com")

    async with client_for(services) as first, client_for(services) as second:
        first_card, first_headers = await connect(
            client, headers, first, inbox, "first@example.com"
        )
        second_card, second_headers = await connect(
            client, headers, second, inbox, "second@example.com"
        )
        publication = await publish(client, headers)
        responses = await gather(
            first.post(
                f"{BASE}/me/teachers/{first_card['id']}/bookings",
                json=book_body(publication),
                headers=first_headers,
            ),
            second.post(
                f"{BASE}/me/teachers/{second_card['id']}/bookings",
                json=book_body(publication),
                headers=second_headers,
            ),
        )

        assert sorted(response.status_code for response in responses) == [201, 409], [
            response.text for response in responses
        ]
        assert len((await client.get(f"{BASE}/lessons", params=query())).json()["items"]) == 1


async def test_approval_reserves_expires_and_teacher_accepts_current_request(database, inbox):
    clock = [datetime.now(UTC)]
    services = await build_services(
        database,
        IDENTITY_SECRET,
        inbox,
        secure_cookie=True,
        lesson_clock=lambda: clock[0],
        availability_policy=AvailabilityPolicy(reservation_hours=1),
    )

    async with client_for(services) as owner, client_for(services) as student:
        headers = await teacher(owner, inbox, "teacher@example.com")
        item, student_headers = await connect(owner, headers, student, inbox, "student@example.com")
        publication = await publish(owner, headers, publication_body(mode="approval"))
        own = f"{BASE}/me/teachers/{item['id']}"
        pending = await student.post(
            f"{own}/bookings", json=book_body(publication), headers=student_headers
        )

        assert pending.status_code == 201, pending.text
        assert pending.json()["state"] == "pending" and pending.json()["lesson_id"] is None
        assert (
            await student.post(
                f"{own}/bookings",
                json=book_body(publication, start_time() + timedelta(hours=2)),
                headers=student_headers,
            )
        ).status_code == 409
        assert len((await student.get(f"{own}/available-slots", params=query())).json()) == 5

        clock[0] += timedelta(hours=2)

        assert (await student.get(f"{own}/bookings")).json()["items"][0]["state"] == "expired"
        assert len((await student.get(f"{own}/available-slots", params=query())).json()) == 7

        requested = (
            await student.post(
                f"{own}/bookings", json=book_body(publication), headers=student_headers
            )
        ).json()
        accepted = await owner.post(
            f"{BASE}/bookings/{requested['id']}/decision",
            json={"state": "accepted"},
            headers=headers,
        )

        assert accepted.status_code == 200, accepted.text
        assert accepted.json()["state"] == "accepted"
        assert (
            await owner.post(
                f"{BASE}/bookings/{requested['id']}/decision",
                json={"state": "accepted"},
                headers=headers,
            )
        ).status_code == 409


async def test_blocks_breaks_and_group_visibility_with_recurring_windows(client, inbox, services):
    headers = await teacher(client, inbox, "teacher@example.com")

    async with client_for(services) as student, client_for(services) as stranger:
        item, _ = await connect(client, headers, student, inbox, "student@example.com")
        other, _ = await connect(client, headers, stranger, inbox, "other@example.com")
        group = (
            await client.post(f"{BASE}/groups", json={"name": "Группа"}, headers=headers)
        ).json()

        assert (
            await client.post(
                f"{BASE}/groups/{group['id']}/members",
                json={"card_id": item["id"], "price": {"amount": "100"}},
                headers=headers,
            )
        ).status_code == 201

        start = start_time()
        body = publication_body(
            break_minutes=10, audience={"all_connected": False, "group_ids": [group["id"]]}
        )

        body["windows"][0]["recurrence"] = {"frequency": "daily", "count": 2}

        publication = await publish(client, headers, body)

        assert publication["windows"][0]["recurrence"]["frequency"] == "daily"
        assert (
            await client.post(
                f"{BASE}/me/calendar-blocks",
                json={
                    "local_start": (start + timedelta(hours=1)).replace(tzinfo=None).isoformat(),
                    "duration_minutes": 60,
                },
                headers=headers,
            )
        ).status_code == 201

        slots = await student.get(
            f"{BASE}/me/teachers/{item['id']}/available-slots", params=query()
        )

        assert slots.status_code == 200, slots.text
        assert len(slots.json()) == 2
        assert (
            await stranger.get(f"{BASE}/me/teachers/{other['id']}/available-slots", params=query())
        ).json() == []

        tomorrow = await student.get(
            f"{BASE}/me/teachers/{item['id']}/available-slots",
            params=query(start + timedelta(days=1)),
        )

        assert len(tomorrow.json()) == 7


async def test_selecting_one_time_option_moves_existing_lesson_once(client, inbox, services):
    headers = await teacher(client, inbox, "teacher@example.com")

    async with client_for(services) as student:
        item, student_headers = await connect(
            client, headers, student, inbox, "student@example.com"
        )
        saved = await create_lesson(
            client, headers, lesson_body([item["id"]], starts_at=start_time().isoformat())
        )
        options = [start_time() + timedelta(hours=1), start_time() + timedelta(hours=2)]
        offered = await client.post(
            f"{BASE}/lessons/{saved['id']}/time-options",
            json={"expected_version": 1, "starts_at": [start.isoformat() for start in options]},
            headers=headers,
        )

        assert offered.status_code == 201, offered.text

        body = book_body(offered.json(), options[0])
        own = f"{BASE}/me/teachers/{item['id']}"
        selected = await student.post(f"{own}/bookings", json=body, headers=student_headers)

        assert selected.status_code == 201, selected.text
        assert selected.json()["lesson_id"] == saved["id"]
        assert (await student.post(f"{own}/bookings", json=body, headers=student_headers)).json()[
            "id"
        ] == selected.json()["id"]
        assert (await student.get(f"{own}/available-slots", params=query())).json() == []
        assert len((await client.get(f"{BASE}/lessons", params=query())).json()["items"]) == 1

        history = (await client.get(f"{BASE}/lessons/{saved['id']}/history")).json()["items"]
        student_id = (await student.get(f"{BASE}/me")).json()["id"]

        assert history[-1]["actor_id"] == student_id


async def test_student_hours_only_expose_free_intervals_and_suggest_matches(
    client, inbox, services
):
    headers = await teacher(client, inbox, "teacher@example.com")

    async with client_for(services) as student, client_for(services) as other:
        item, student_headers = await connect(
            client, headers, student, inbox, "student@example.com"
        )
        start = start_time()
        free = publication_body()["windows"]
        busy = [
            {
                "starts_at": (start + timedelta(hours=1)).isoformat(),
                "ends_at": (start + timedelta(hours=2)).isoformat(),
            }
        ]
        own = f"{BASE}/me/teachers/{item['id']}/availability"
        updated = await student.put(
            own, json={"expected_version": 0, "free": free, "busy": busy}, headers=student_headers
        )

        assert updated.status_code == 200, updated.text
        assert (
            await student.put(
                own, json={"expected_version": 0, "free": free}, headers=student_headers
            )
        ).status_code == 409

        teacher_view = await client.get(
            f"{BASE}/students/cards/{item['id']}/availability", params=query()
        )

        assert teacher_view.status_code == 200, teacher_view.text
        assert len(teacher_view.json()) == 2
        assert all(set(interval) == {"starts_at", "ends_at"} for interval in teacher_view.json())

        await publish(client, headers)

        matches = await client.get(
            f"{BASE}/students/cards/{item['id']}/availability/matches", params=query()
        )

        assert matches.status_code == 200, matches.text
        assert len(matches.json()) == 4

        await teacher(other, inbox, "other@example.com")

        assert (
            await other.get(f"{BASE}/students/cards/{item['id']}/availability", params=query())
        ).status_code == 404


async def test_observer_permissions_responsibility_transfer_and_foreign_owner(
    client, inbox, services
):
    headers = await teacher(client, inbox, "teacher@example.com")

    async with (
        client_for(services) as student,
        client_for(services) as adult,
        client_for(services) as other,
    ):
        item, student_headers = await connect(
            client, headers, student, inbox, "student@example.com"
        )
        token = (await adult_invitation(client, headers, item["id"]))["token"]
        adult_headers = await register_adult(adult, inbox, token, "adult@example.com")
        publication = await publish(client, headers, publication_body(mode="approval"))
        own = f"{BASE}/me/teachers/{item['id']}"
        adult_path = f"{BASE}/me/students/{item['id']}"

        assert (await adult.get(f"{adult_path}/available-slots", params=query())).status_code == 200
        assert (
            await adult.post(
                f"{adult_path}/bookings", json=book_body(publication), headers=adult_headers
            )
        ).status_code == 403
        assert (
            await student.post(f"{own}/bookings", json=book_body(publication))
        ).status_code == 403
        assert (
            await client.post(f"{BASE}/availability", json=publication_body())
        ).status_code == 403

        requested = (
            await student.post(
                f"{own}/bookings", json=book_body(publication), headers=student_headers
            )
        ).json()
        adult_id = (await adult.get(f"{BASE}/me")).json()["id"]

        assert (
            await client.put(
                f"{BASE}/students/cards/{item['id']}/responsibilities/scheduling",
                json={"account_id": adult_id},
                headers=headers,
            )
        ).status_code == 200
        assert (
            await student.post(
                f"{own}/bookings/{requested['id']}/withdraw", headers=student_headers
            )
        ).status_code == 403
        assert (
            await adult.post(
                f"{adult_path}/bookings/{requested['id']}/withdraw", headers=adult_headers
            )
        ).status_code == 200

        other_headers = await teacher(other, inbox, "other@example.com")

        assert (
            await other.put(
                f"{BASE}/availability/{publication['id']}",
                json=publication_body(expected_version=1),
                headers=other_headers,
            )
        ).status_code == 404
        assert (
            await other.delete(
                f"{BASE}/availability/{publication['id']}",
                params={"expected_version": 1},
                headers=other_headers,
            )
        ).status_code == 404
        assert (
            await other.post(
                f"{BASE}/bookings/{requested['id']}/decision",
                json={"state": "accepted"},
                headers=other_headers,
            )
        ).status_code == 404
        assert (await other.get(f"{BASE}/bookings")).json()["items"] == []
        assert (
            await adult.put(
                f"{adult_path}/availability",
                json={"expected_version": 0, "free": publication_body()["windows"]},
                headers=adult_headers,
            )
        ).status_code == 200
        assert (
            await student.put(
                f"{own}/availability",
                json={"expected_version": 1, "free": []},
                headers=student_headers,
            )
        ).status_code == 403


async def test_publication_change_invalidates_reservation_and_stale_versions(
    client, inbox, services
):
    headers = await teacher(client, inbox, "teacher@example.com")

    async with client_for(services) as student:
        item, student_headers = await connect(
            client, headers, student, inbox, "student@example.com"
        )
        publication = await publish(client, headers, publication_body(mode="approval"))
        own = f"{BASE}/me/teachers/{item['id']}"
        requested = (
            await student.post(
                f"{own}/bookings", json=book_body(publication), headers=student_headers
            )
        ).json()
        changed = await client.put(
            f"{BASE}/availability/{publication['id']}",
            json=publication_body(expected_version=1, mode="approval", price={"amount": "300"}),
            headers=headers,
        )

        assert changed.status_code == 200, changed.text
        assert (await student.get(f"{own}/bookings")).json()["items"][0]["state"] == "invalidated"
        assert (
            await client.post(
                f"{BASE}/bookings/{requested['id']}/decision",
                json={"state": "accepted"},
                headers=headers,
            )
        ).status_code == 409
        assert (
            await student.post(
                f"{own}/bookings", json=book_body(publication), headers=student_headers
            )
        ).status_code == 409

        current = changed.json()
        fresh = await student.post(
            f"{own}/bookings", json=book_body(current), headers=student_headers
        )

        assert fresh.status_code == 201, fresh.text
        assert (
            await client.delete(
                f"{BASE}/availability/{publication['id']}",
                params={"expected_version": 1},
                headers=headers,
            )
        ).status_code == 409
        assert (
            await client.delete(
                f"{BASE}/availability/{publication['id']}",
                params={"expected_version": 2},
                headers=headers,
            )
        ).status_code == 204
        assert all(
            row["state"] == "invalidated"
            for row in (await student.get(f"{own}/bookings")).json()["items"]
        )


async def test_booking_audit_failure_rolls_back_claim_and_lesson(
    client, inbox, services, monkeypatch, database
):
    from tests.postgres_testkit import check_schema

    from app.modules.scheduling.infrastructure.persistence.lesson_repository import (
        PostgresLessonsRepository,
    )


    headers = await teacher(client, inbox, "teacher@example.com")

    async with client_for(services) as student:
        item, student_headers = await connect(
            client, headers, student, inbox, "student@example.com"
        )
        publication = await publish(client, headers)
        own = f"{BASE}/me/teachers/{item['id']}"
        body = book_body(publication)
        original = PostgresLessonsRepository.append_revision


        async def fail(self, revision):
            await original(self, revision)

            raise RuntimeError("audit unavailable")


        with monkeypatch.context() as patch:
            patch.setattr(PostgresLessonsRepository, "append_revision", fail)

            assert (
                await student.post(f"{own}/bookings", json=body, headers=student_headers)
            ).status_code == 500

        assert (await student.get(f"{own}/bookings")).json()["items"] == []
        assert (await client.get(f"{BASE}/lessons", params=query())).json()["items"] == []
        assert len((await student.get(f"{own}/available-slots", params=query())).json()) == 7
        assert (
            await student.post(f"{own}/bookings", json=body, headers=student_headers)
        ).status_code == 201

    await check_schema(database)


async def test_future_series_outside_preparation_horizon_still_blocks_booking(
    client, inbox, services
):
    headers = await teacher(client, inbox, "teacher@example.com")

    async with client_for(services) as student:
        item, student_headers = await connect(
            client, headers, student, inbox, "student@example.com"
        )
        other = await card(client, headers)
        start = start_time() + timedelta(days=150)
        created = await client.post(
            f"{BASE}/lesson-series",
            json={
                "lesson": lesson_body([other["id"]], starts_at=start.isoformat()),
                "recurrence": {"frequency": "daily", "count": 2},
            },
            headers=headers,
        )

        assert created.status_code == 201, created.text

        publication = await publish(client, headers, publication_body(start))
        own = f"{BASE}/me/teachers/{item['id']}"
        attempted = await student.post(
            f"{own}/bookings", json=book_body(publication, start), headers=student_headers
        )

        assert attempted.status_code == 409, attempted.text

        slots = await student.get(f"{own}/available-slots", params=query(start))

        assert slots.status_code == 200, slots.text
        assert len(slots.json()) == 5
        assert other["id"] not in str(slots.json())


async def test_saved_break_survives_lowered_configuration(database, inbox):
    first_services = await build_services(database, IDENTITY_SECRET, inbox, secure_cookie=True)

    async with client_for(first_services) as owner, client_for(first_services) as student:
        headers = await teacher(owner, inbox, "teacher@example.com")
        item, student_headers = await connect(owner, headers, student, inbox, "student@example.com")
        first = await publish(owner, headers, publication_body(break_minutes=30))
        own = f"{BASE}/me/teachers/{item['id']}"

        assert (
            await student.post(f"{own}/bookings", json=book_body(first), headers=student_headers)
        ).status_code == 201

        second_services = await build_services(
            database,
            IDENTITY_SECRET,
            inbox,
            secure_cookie=True,
            availability_policy=AvailabilityPolicy(max_break_minutes=0),
        )

        async with (
            client_for(second_services) as revised_owner,
            client_for(second_services) as revised_student,
        ):
            revised_owner.cookies.update(owner.cookies)
            revised_student.cookies.update(student.cookies)

            second = await publish(revised_owner, headers)
            adjacent = await revised_student.post(
                f"{own}/bookings",
                json=book_body(second, start_time() + timedelta(hours=1)),
                headers=student_headers,
            )

            assert adjacent.status_code == 409, adjacent.text
            assert (
                await revised_student.post(
                    f"{own}/bookings",
                    json=book_body(second, start_time() + timedelta(minutes=90)),
                    headers=student_headers,
                )
            ).status_code == 201


async def test_database_rejects_booking_with_foreign_publication_owner(
    client, inbox, services, database
):
    from dataclasses import asdict, replace
    from uuid import UUID

    from sqlalchemy import insert
    from sqlalchemy.exc import IntegrityError
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.modules.scheduling.infrastructure.persistence.availability_models import BookingRow
    from app.modules.scheduling.infrastructure.persistence.availability_repository import (
        PostgresAvailabilityRepository,
    )


    headers = await teacher(client, inbox, "teacher@example.com")

    async with client_for(services) as student, client_for(services) as other:
        item, student_headers = await connect(
            client, headers, student, inbox, "student@example.com"
        )
        publication = await publish(client, headers)
        own = f"{BASE}/me/teachers/{item['id']}"
        saved = (
            await student.post(
                f"{own}/bookings", json=book_body(publication), headers=student_headers
            )
        ).json()
        teacher_id = UUID((await client.get(f"{BASE}/me")).json()["id"])

        await teacher(other, inbox, "other@example.com")

        other_id = UUID((await other.get(f"{BASE}/me")).json()["id"])

        async with AsyncSession(database) as db, db.begin():
            booking = await PostgresAvailabilityRepository(db).find_booking(
                UUID(saved["id"]), teacher_id
            )

            assert booking is not None

            invalid = replace(booking, id=uuid4(), request_id=uuid4(), teacher_id=other_id)

            with pytest.raises(IntegrityError):
                async with db.begin_nested():
                    await db.execute(insert(BookingRow).values(**asdict(invalid)))
