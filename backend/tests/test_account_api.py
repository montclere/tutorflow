"""Сценарии IDN, STU, INV, PAR и ACL на мигрированной PostgreSQL."""

import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.config import Settings
from app.main import create_app

ROOT = Path(__file__).resolve().parents[1]
STUDENT = "new_student_card_for_student"
PARENT = "new_student_card_for_parent"


class Inbox:
    def __init__(self):
        self.codes: dict[str, str] = {}

    async def send(self, contact_type: str, contact: str, code: str) -> None:
        self.codes[contact] = code


@pytest.fixture(scope="module")
def database():
    url = os.getenv("TUTORFLOW_TEST_DATABASE_URL")
    if not url:
        pytest.skip("TUTORFLOW_TEST_DATABASE_URL не задан")
    config = Config(str(ROOT / "alembic.ini"))
    config.attributes["database_url"] = url
    try:
        command.upgrade(config, "head")
    except SQLAlchemyError as error:
        pytest.fail(
            f"Не удалось применить миграции тестовой БД ({type(error).__name__})", pytrace=False
        )
    return url


def peer(client: TestClient) -> TestClient:
    return TestClient(client.app, base_url="https://testserver", client=(str(uuid4()), 50000))


def start(client: TestClient):
    response = client.get("/api/v1/auth/csrf")
    assert response.status_code == 200
    client.headers["X-CSRF-Token"] = response.json()["csrf_token"]


def register(client: TestClient, inbox: Inbox, *, phone: bool = False, token: str | None = None):
    start(client)
    contact = f"+7999{uuid4().int % 10**7:07d}" if phone else f"{uuid4().hex}@example.org"
    login_contact = {"type": "phone" if phone else "email", "value": contact}
    invitation = {"invitation_token": token} if token else {}
    response = client.post(
        "/api/v1/auth/registrations",
        json={
            "login_contact": login_contact,
            "entrypoint": "invitation" if token else "teacher",
            **invitation,
        },
    )
    assert response.status_code == 202, response.text
    response = client.post(
        "/api/v1/auth/registrations/complete",
        json={
            "challenge_id": response.json()["challenge_id"],
            "code": inbox.codes[contact],
            "password": "correct horse battery staple",
            "display_name": "Имя человека",
            "timezone": "Asia/Krasnoyarsk",
            **invitation,
        },
    )
    assert response.status_code == 201, response.text
    assert response.headers["location"] == "/api/v1/me"
    client.headers["X-CSRF-Token"] = response.json()["csrf_token"]
    assert response.json()["account"]["login_contact"]["value"] == contact
    return login_contact


def issue(client: TestClient, purpose: str):
    response = client.post("/api/v1/teacher/invitations", json={"purpose": purpose})
    assert response.status_code == 201, response.text
    invitation_id = response.json()["invitation"]["invitation_id"]
    assert response.headers["location"] == f"/api/v1/teacher/invitations/{invitation_id}"
    return response.json()["invitation_token"], invitation_id


def test_parent_accepts_two_cards_and_loses_revoked_access(database):
    inbox = Inbox()
    with TestClient(
        create_app(Settings(database, "t" * 48), delivery=inbox), base_url="https://testserver"
    ) as teacher:
        parent = peer(teacher)
        register(teacher, inbox)
        enabled = teacher.put("/api/v1/me/teacher-cabinet")
        assert enabled.status_code == 201
        assert enabled.headers["location"] == "/api/v1/me/teacher-cabinet"
        assert teacher.put("/api/v1/me/teacher-cabinet").status_code == 200
        token, _ = issue(teacher, PARENT)
        start(parent)
        assert (
            parent.post("/api/v1/invitations/preview", json={"invitation_token": token}).json()[
                "purpose"
            ]
            == PARENT
        )
        assert (
            parent.post("/api/v1/invitations/accept", json={"invitation_token": token}).status_code
            == 403
        )
        register(parent, inbox, phone=True, token=token)
        assert parent.get("/api/v1/parent/student-cards").json()["items"] == []
        payload = {"invitation_token": token, "student_card_name": "Ребёнок"}
        response = parent.post("/api/v1/invitations/accept", json=payload)
        assert response.status_code == 201, response.text
        first = response.json()
        assert (
            response.headers["location"]
            == f"/api/v1/parent/student-cards/{first['student_card_id']}"
        )
        replay = parent.post("/api/v1/invitations/accept", json=payload)
        assert replay.status_code == 200
        assert "location" not in replay.headers
        assert replay.json() == first
        token2, _ = issue(teacher, PARENT)
        second = parent.post(
            "/api/v1/invitations/accept", json={**payload, "invitation_token": token2}
        ).json()
        assert second["student_card_id"] != first["student_card_id"]
        assert second["parent_access_id"] != first["parent_access_id"]
        card_path = f"/api/v1/teacher/student-cards/{first['student_card_id']}"
        card = teacher.get(card_path).json()
        assert card["student_account_id"] is None
        assert card["student_card_name"] == "Ребёнок"
        assert parent.get(card_path).status_code in {403, 404}
        assert (
            teacher.patch(
                card_path, json={"private_note": "Личная заметка", "expected_version": 1}
            ).status_code
            == 200
        )
        parent_card = f"/api/v1/parent/student-cards/{first['student_card_id']}"
        assert "private_note" not in parent.get(parent_card).json()
        assert "login_contact" not in parent.get(parent_card).json()
        assert (
            teacher.delete(f"/api/v1/parent-access/{first['parent_access_id']}").status_code == 204
        )
        assert parent.get(parent_card).status_code == 404
        assert parent.post("/api/v1/invitations/accept", json=payload).json()["code"] == (
            "invitation_unavailable"
        )
        assert len(parent.get("/api/v1/parent/student-cards").json()["items"]) == 1


def test_student_acceptance_races_and_isolation(database):
    inbox = Inbox()
    with TestClient(
        create_app(Settings(database, "t" * 48), delivery=inbox), base_url="https://testserver"
    ) as teacher:
        second_teacher, student, other = (peer(teacher) for _ in range(3))
        for client in (teacher, second_teacher):
            register(client, inbox)
            assert client.put("/api/v1/me/teacher-cabinet").status_code == 201
        token1, _ = issue(teacher, STUDENT)
        token2, _ = issue(teacher, STUDENT)
        register(student, inbox, token=token1)
        register(other, inbox)
        barrier = Barrier(2)

        def accept(token: str):
            barrier.wait(timeout=10)
            return student.post("/api/v1/invitations/accept", json={"invitation_token": token})

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(accept, [token1, token2]))
        assert sorted(response.status_code for response in results) == [201, 409]
        index = next(i for i, r in enumerate(results) if r.status_code == 201)
        winner_token = (token1, token2)[index]
        winning = results[index].json()
        assert (
            other.post(
                "/api/v1/invitations/accept", json={"invitation_token": winner_token}
            ).status_code
            == 400
        )
        path = f"/api/v1/student/student-cards/{winning['student_card_id']}"
        assert other.get(path).status_code == 404
        assert student.get(path).json()["student_card_name"] == "Имя человека"
        assert (
            second_teacher.get(
                f"/api/v1/teacher/student-cards/{winning['student_card_id']}"
            ).status_code
            == 404
        )
        third_token, _ = issue(second_teacher, STUDENT)
        assert (
            student.post(
                "/api/v1/invitations/accept", json={"invitation_token": third_token}
            ).status_code
            == 201
        )
        assert len(student.get("/api/v1/student/student-cards").json()["items"]) == 2


def test_same_link_concurrency_and_revoke_race(database):
    inbox = Inbox()
    with TestClient(
        create_app(Settings(database, "t" * 48), delivery=inbox),
        base_url="https://testserver",
        client=(str(uuid4()), 50000),
    ) as teacher:
        parent, outsider = peer(teacher), peer(teacher)
        register(teacher, inbox)
        assert teacher.put("/api/v1/me/teacher-cabinet").status_code == 201
        token, _ = issue(teacher, PARENT)
        register(parent, inbox, token=token)
        register(outsider, inbox)

        def race(first, second):
            barrier = Barrier(2)

            def at_barrier(action):
                barrier.wait(timeout=10)
                return action()

            with ThreadPoolExecutor(max_workers=2) as pool:
                a = pool.submit(at_barrier, first)
                b = pool.submit(at_barrier, second)
                return a.result(timeout=15), b.result(timeout=15)

        url = "/api/v1/invitations/accept"
        payload = {"invitation_token": token, "student_card_name": "Имя"}
        a, b = race(lambda: parent.post(url, json=payload), lambda: parent.post(url, json=payload))
        assert sorted([a.status_code, b.status_code]) == [200, 201]
        assert a.json() == b.json()
        assert parent.post(url, json={**payload, "student_card_name": "Другое"}).status_code == 409

        token, _ = issue(teacher, PARENT)
        payload["invitation_token"] = token
        a, b = race(
            lambda: parent.post(url, json=payload), lambda: outsider.post(url, json=payload)
        )
        assert sorted([a.status_code, b.status_code]) == [201, 400]
        loser = a if a.status_code == 400 else b
        assert "student_card_id" not in loser.json()

        token, invitation_id = issue(teacher, PARENT)
        payload["invitation_token"] = token
        a, b = race(
            lambda: parent.post(url, json=payload),
            lambda: teacher.delete(f"/api/v1/teacher/invitations/{invitation_id}"),
        )
        assert (a.status_code, b.status_code) in {(201, 409), (400, 204)}
        assert len(teacher.get("/api/v1/teacher/student-cards").json()["items"]) == (
            3 if a.status_code == 201 else 2
        )
        if b.status_code == 204:
            assert parent.post(url, json=payload).json()["code"] == "invitation_unavailable"


def test_login_reset_profile_and_csrf(database):
    inbox = Inbox()
    with TestClient(
        create_app(Settings(database, "t" * 48), delivery=inbox),
        base_url="https://testserver",
        client=(str(uuid4()), 50000),
    ) as user:
        contact = register(user, inbox, phone=True)
        account_id = user.get("/api/v1/me").json()["account_id"]
        assert (
            user.put("/api/v1/me/teacher-cabinet", headers={"X-CSRF-Token": ""}).status_code == 403
        )
        assert (
            user.put("/api/v1/me/teacher-cabinet", headers={"Origin": "https://other"}).status_code
            == 403
        )
        profile = user.patch(
            "/api/v1/me/profile",
            json={
                "display_name": "Новое имя",
                "expected_version": 1,
            },
        )
        assert profile.json()["version"] == 2
        assert user.get("/api/v1/me").json()["account_id"] == account_id
        assert (
            user.patch(
                "/api/v1/me/profile",
                json={
                    "display_name": "Старое имя",
                    "expected_version": 1,
                },
            ).status_code
            == 409
        )

        login = peer(user)
        start(login)
        old_password = "correct horse battery staple"
        assert (
            login.post(
                "/api/v1/auth/login",
                json={
                    "login_contact": contact,
                    "password": "bad",
                },
            ).json()["code"]
            == "invalid_credentials"
        )
        assert (
            login.post(
                "/api/v1/auth/login",
                json={
                    "login_contact": contact,
                    "password": old_password,
                },
            ).status_code
            == 200
        )
        assert login.put("/api/v1/me/teacher-cabinet").status_code == 403

        reset = peer(user)
        start(reset)
        challenge = reset.post("/api/v1/auth/password-resets", json={"login_contact": contact})
        assert challenge.status_code == 202
        code = inbox.codes[contact["value"]]
        payload = {
            "challenge_id": challenge.json()["challenge_id"],
            "code": "00000000" if code != "00000000" else "00000001",
            "password": "new correct horse battery staple",
        }
        path = "/api/v1/auth/password-resets/complete"
        assert reset.post(path, json=payload).json()["code"] == "challenge_invalid"
        payload["code"] = code
        reset_result = reset.post(path, json=payload)
        assert reset_result.status_code == 204
        assert reset_result.content == b""
        assert "content-length" not in reset_result.headers
        start(reset)
        assert reset.post(path, json=payload).status_code == 400
        assert user.get("/api/v1/me").status_code == 403
        assert login.get("/api/v1/me").status_code == 403
        assert (
            reset.post(
                "/api/v1/auth/login",
                json={
                    "login_contact": contact,
                    "password": old_password,
                },
            ).status_code
            == 403
        )
        assert (
            reset.post(
                "/api/v1/auth/login",
                json={
                    "login_contact": contact,
                    "password": payload["password"],
                },
            ).json()["account"]["account_id"]
            == account_id
        )
        assert reset.get("/api/v1/me/profile").json()["display_name"] == "Новое имя"


def test_invitation_preview_and_registration_expiry(database, monkeypatch):
    from datetime import UTC, datetime, timedelta

    from app.modules.students.application import students

    inbox = Inbox()
    with TestClient(
        create_app(Settings(database, "t" * 48), delivery=inbox),
        base_url="https://testserver",
        client=(str(uuid4()), 50000),
    ) as teacher:
        register(teacher, inbox)
        assert teacher.put("/api/v1/me/teacher-cabinet").status_code == 201
        token, invitation_id = issue(teacher, STUDENT)
        actor = peer(teacher)
        start(actor)
        preview = "/api/v1/invitations/preview"
        assert actor.post(preview, json={"invitation_token": "invalid"}).status_code == 400
        assert actor.post(preview, json={"invitation_token": token}).status_code == 200
        assert teacher.get("/api/v1/teacher/student-cards").json()["items"] == []
        future = datetime.now(UTC) + timedelta(hours=73)
        monkeypatch.setattr(students, "now_utc", lambda: future)
        assert actor.post(preview, json={"invitation_token": token}).status_code == 400
        assert (
            actor.post(
                "/api/v1/auth/registrations",
                json={
                    "login_contact": {"type": "email", "value": f"{uuid4().hex}@example.org"},
                    "entrypoint": "invitation",
                    "invitation_token": token,
                },
            ).status_code
            == 400
        )
        assert teacher.delete(f"/api/v1/teacher/invitations/{invitation_id}").status_code == 400


def test_acceptance_rolls_back_after_access_write(database, monkeypatch):
    from app.modules.students.infrastructure.persistence.repositories import PostgresStudents
    from app.shared.domain.errors import Problem, ProblemCode

    inbox = Inbox()
    with TestClient(
        create_app(Settings(database, "t" * 48), delivery=inbox),
        base_url="https://testserver",
        client=(str(uuid4()), 50000),
    ) as teacher:
        parent = peer(teacher)
        register(teacher, inbox)
        teacher.put("/api/v1/me/teacher-cabinet").raise_for_status()
        token, _ = issue(teacher, PARENT)
        register(parent, inbox, token=token)

        original = PostgresStudents.add_parent_access

        async def fail_after_write(self, access):
            await original(self, access)
            raise Problem(ProblemCode.DEPENDENCY_UNAVAILABLE)

        accept = "/api/v1/invitations/accept"
        payload = {"invitation_token": token, "student_card_name": "Ребёнок"}
        with monkeypatch.context() as patch:
            patch.setattr(PostgresStudents, "add_parent_access", fail_after_write)
            assert parent.post(accept, json=payload).status_code == 503
        assert teacher.get("/api/v1/teacher/student-cards").json()["items"] == []
        assert parent.get("/api/v1/parent/student-cards").json()["items"] == []
        assert parent.post(accept, json=payload).status_code == 201


def test_archive_does_not_restore_parent_access(database):
    inbox = Inbox()
    with TestClient(
        create_app(Settings(database, "t" * 48), delivery=inbox),
        base_url="https://testserver",
        client=(str(uuid4()), 50000),
    ) as teacher:
        parent = peer(teacher)
        register(teacher, inbox)
        teacher.put("/api/v1/me/teacher-cabinet").raise_for_status()
        token, _ = issue(teacher, PARENT)
        register(parent, inbox, token=token)
        payload = {"invitation_token": token, "student_card_name": "Ребёнок"}
        accept = "/api/v1/invitations/accept"
        card = parent.post(accept, json=payload).json()
        card_id = card["student_card_id"]
        path = f"/api/v1/teacher/student-cards/{card_id}"
        parent_path = f"/api/v1/parent/student-cards/{card_id}"
        assert (
            teacher.post(f"{path}/archive", json={"expected_version": 1}).json()["status"]
            == "archived"
        )
        assert parent.get(parent_path).status_code == 404
        assert (
            teacher.post(f"{path}/restore", json={"expected_version": 2}).json()["status"]
            == "active"
        )
        assert parent.get(parent_path).status_code == 404
        assert parent.post(accept, json=payload).status_code == 400


def test_delivery_failure_does_not_leak_recipient_or_response(database, caplog):
    with TestClient(
        create_app(Settings(database, "t" * 48)),
        base_url="https://testserver",
        client=(str(uuid4()), 50000),
    ) as client:
        start(client)
        response = client.post(
            "/api/v1/auth/registrations",
            json={
                "login_contact": {"type": "phone", "value": "+79991234567"},
                "entrypoint": "teacher",
            },
        )
        assert response.status_code == 202
        assert set(response.json()) == {"challenge_id"}
        assert "code_delivery_failed" in caplog.text
        assert "+79991234567" not in caplog.text
        assert "delivery_unavailable" not in response.text
        assert client.get("/api/v1/me").status_code == 403


def test_only_the_owner_can_revoke_a_session(database):
    inbox = Inbox()
    with TestClient(
        create_app(Settings(database, "t" * 48), delivery=inbox),
        base_url="https://testserver",
        client=(str(uuid4()), 50000),
    ) as owner:
        contact = register(owner, inbox)
        other = peer(owner)
        register(other, inbox)
        sessions = "/api/v1/auth/sessions"
        session_id = owner.get(sessions).json()["items"][0]["session_id"]
        assert other.delete(f"{sessions}/{session_id}").status_code == 404
        second = peer(owner)
        start(second)
        sign_in = second.post(
            "/api/v1/auth/login",
            json={"login_contact": contact, "password": "correct horse battery staple"},
        )
        second.headers["X-CSRF-Token"] = sign_in.json()["csrf_token"]
        first_page = owner.get(sessions, params={"limit": 1}).json()
        assert len(first_page["items"]) == 1
        assert first_page["next_cursor"]
        last_page = owner.get(sessions, params={"cursor": first_page["next_cursor"]}).json()
        assert last_page["items"][0]["session_id"] == session_id
        assert other.get(sessions, params={"cursor": first_page["next_cursor"]}).status_code == 422
        assert second.delete("/api/v1/auth/session").status_code == 204
        assert second.get("/api/v1/me").status_code == 403
        assert owner.get("/api/v1/me").status_code == 200
        assert owner.post(f"{sessions}/revoke-all").status_code == 204
        assert owner.get("/api/v1/me").status_code == 403


def test_recovery_equal_response_and_superseded_expired_codes(database, monkeypatch):
    from datetime import UTC, datetime, timedelta

    from app.modules.identity.application import identity

    inbox = Inbox()
    with TestClient(
        create_app(Settings(database, "t" * 48), delivery=inbox),
        base_url="https://testserver",
        client=(str(uuid4()), 50000),
    ) as user:
        login_contact = register(user, inbox)
        anonymous = peer(user)
        start(anonymous)
        start_path = "/api/v1/auth/password-resets"
        unknown = {"type": "email", "value": f"{uuid4().hex}@example.org"}
        missing = anonymous.post(start_path, json={"login_contact": unknown})
        first = anonymous.post(start_path, json={"login_contact": login_contact})
        old_code = inbox.codes[login_contact["value"]]
        assert missing.status_code == first.status_code == 202
        assert set(missing.json()) == set(first.json()) == {"challenge_id"}
        assert unknown["value"] not in inbox.codes
        new = anonymous.post(start_path, json={"login_contact": login_contact})
        code = inbox.codes[login_contact["value"]]
        finish = "/api/v1/auth/password-resets/complete"
        password = "new correct horse battery staple"
        assert (
            anonymous.post(
                finish,
                json={
                    "challenge_id": first.json()["challenge_id"],
                    "code": old_code,
                    "password": password,
                },
            ).json()["code"]
            == "challenge_invalid"
        )
        future = datetime.now(UTC) + timedelta(minutes=11)
        monkeypatch.setattr(identity, "now_utc", lambda: future)
        assert (
            anonymous.post(
                finish,
                json={
                    "challenge_id": new.json()["challenge_id"],
                    "code": code,
                    "password": password,
                },
            ).json()["code"]
            == "challenge_invalid"
        )


def test_maintenance_really_deletes_expired_database_rows(database):
    from datetime import UTC, datetime, timedelta

    from sqlalchemy import create_engine, insert, select

    from app.maintenance import prune
    from app.modules.identity.infrastructure.models import challenges, sessions
    from app.modules.students.infrastructure.persistence.models import invitations

    engine = create_engine(database, hide_parameters=True)
    now = datetime.now(UTC)
    past = now - timedelta(minutes=1)
    future = now + timedelta(minutes=5)
    old_id, valid_id, old_session, old_invite = (uuid4() for _ in range(4))
    try:
        with engine.begin() as db:
            for identifier, expiry in ((old_id, past), (valid_id, future)):
                db.execute(
                    insert(challenges).values(
                        challenge_id=identifier,
                        contact_type="email",
                        contact="test@example.org",
                        purpose="registration",
                        code_digest="test-hash",
                        expires_at=expiry,
                        failed_attempts=0,
                    )
                )
            db.execute(
                insert(sessions).values(
                    session_id=old_session,
                    token_digest=uuid4().hex,
                    csrf_token="test-csrf",
                    created_at=past,
                    last_seen_at=past,
                    expires_at=past,
                )
            )
            db.execute(
                insert(invitations).values(
                    invitation_id=old_invite,
                    teacher_account_id=uuid4(),
                    purpose=STUDENT,
                    token_digest=uuid4().hex,
                    created_at=past,
                    expires_at=past,
                )
            )
            prune(db, now, 24)
            assert (
                db.scalar(
                    select(challenges.c.challenge_id).where(challenges.c.challenge_id == old_id)
                )
                is None
            )
            assert (
                db.scalar(
                    select(challenges.c.challenge_id).where(challenges.c.challenge_id == valid_id)
                )
                == valid_id
            )
            assert (
                db.scalar(select(sessions.c.session_id).where(sessions.c.session_id == old_session))
                is None
            )
            invitation = (
                db.execute(select(invitations).where(invitations.c.invitation_id == old_invite))
                .mappings()
                .one()
            )
            assert invitation["token_digest"] is None
    finally:
        engine.dispose()


def test_student_card_port_checks_operation_activity_and_revocation(database):
    import asyncio

    from sqlalchemy import update
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.modules.identity.infrastructure.models import accounts
    from app.modules.identity.infrastructure.repository import PostgresIdentity
    from app.modules.students.application.students import Students
    from app.modules.students.infrastructure.persistence.repositories import PostgresStudents
    from app.shared.application.contracts.student_cards import (
        StudentCardAccess,
        StudentCardOperation,
    )

    inbox = Inbox()

    async def allowed(actor, card_id, operation):

        engine = create_async_engine(database)
        try:
            async with async_sessionmaker(engine).begin() as db:
                students: StudentCardAccess = Students(
                    PostgresStudents(db, uuid4()), PostgresIdentity(db), "t" * 48, 72
                )
                return await students.allows_active_card_operation(actor, card_id, operation)
        finally:
            await engine.dispose()

    with TestClient(
        create_app(Settings(database, "t" * 48), delivery=inbox),
        base_url="https://testserver",
        client=(str(uuid4()), 50000),
    ) as teacher:
        parent = peer(teacher)
        register(teacher, inbox)
        teacher.put("/api/v1/me/teacher-cabinet").raise_for_status()
        token, _ = issue(teacher, PARENT)
        register(parent, inbox, token=token)
        accepted = parent.post(
            "/api/v1/invitations/accept",
            json={
                "invitation_token": token,
                "student_card_name": "Ребёнок",
            },
        )
        accepted.raise_for_status()
        from uuid import UUID

        teacher_id = UUID(teacher.get("/api/v1/me").json()["account_id"])
        parent_id = UUID(parent.get("/api/v1/me").json()["account_id"])
        card_id = UUID(accepted.json()["student_card_id"])
        access_id = accepted.json()["parent_access_id"]
        read, edit = StudentCardOperation.READ, StudentCardOperation.EDIT
        assert asyncio.run(allowed(teacher_id, card_id, read))
        assert asyncio.run(allowed(teacher_id, card_id, edit))
        assert asyncio.run(allowed(parent_id, card_id, read))
        assert not asyncio.run(allowed(parent_id, card_id, edit))
        assert not asyncio.run(allowed(uuid4(), card_id, read))
        assert not asyncio.run(allowed(teacher_id, uuid4(), read))

        teacher.delete(f"/api/v1/parent-access/{access_id}").raise_for_status()
        assert not asyncio.run(allowed(parent_id, card_id, read))

        student_token, _ = issue(teacher, STUDENT)
        student_result = parent.post(
            "/api/v1/invitations/accept",
            json={
                "invitation_token": student_token,
            },
        )
        student_result.raise_for_status()
        study_card = UUID(student_result.json()["student_card_id"])
        assert asyncio.run(allowed(parent_id, study_card, read))
        assert not asyncio.run(allowed(parent_id, study_card, edit))

        teacher.post(
            f"/api/v1/teacher/student-cards/{card_id}/archive", json={"expected_version": 1}
        ).raise_for_status()
        assert not asyncio.run(allowed(teacher_id, card_id, read))
        assert not asyncio.run(allowed(teacher_id, card_id, edit))

        async def deactivate_teacher():
            engine = create_async_engine(database)
            try:
                async with engine.begin() as db:
                    await db.execute(
                        update(accounts)
                        .where(accounts.c.account_id == teacher_id)
                        .values(status="inactive")
                    )
            finally:
                await engine.dispose()

        asyncio.run(deactivate_teacher())
        assert not asyncio.run(allowed(teacher_id, study_card, read))
        assert not asyncio.run(allowed(parent_id, study_card, read))


def test_login_failure_identical_for_wrong_password_and_unknown_contact(database):
    inbox = Inbox()
    with TestClient(
        create_app(Settings(database, "t" * 48), delivery=inbox), base_url="https://testserver"
    ) as account:
        login_contact = register(account, inbox)
        guest = peer(account)
        start(guest)
        details = []
        for contact in (login_contact, {"type": "email", "value": f"{uuid4().hex}@example.org"}):
            response = guest.post(
                "/api/v1/auth/login",
                json={
                    "login_contact": contact,
                    "password": "wrong-test-password",
                },
            )
            assert response.status_code == 403
            assert "www-authenticate" not in response.headers
            assert "wrong-test-password" not in response.text
            assert contact["value"] not in response.text
            details.append(
                {
                    key: value
                    for key, value in response.json().items()
                    if key not in {"instance", "request_id"}
                }
            )
        assert details[0] == details[1]
        assert details[0]["code"] == "invalid_credentials"


def test_rate_limit_retry_after_rounds_up_to_the_window(database, monkeypatch):
    from datetime import UTC, datetime

    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.shared.infrastructure import rate_limit

    now = datetime(2026, 11, 18, 12, 0, 1, 200_000, tzinfo=UTC)
    monkeypatch.setattr(rate_limit, "now_utc", lambda: now)
    engine = create_async_engine(database, poolclass=NullPool)
    limiter = rate_limit.PostgresRateLimiter(async_sessionmaker(engine), "t" * 48)
    subject = str(uuid4())
    app = create_app(Settings(database, "t" * 48))

    @app.get("/rate-fixture")
    async def limited():
        await limiter("test", subject, 1, 10)
        return {"status": "ok"}

    with TestClient(app) as client:
        assert client.get("/rate-fixture").status_code == 200
        response = client.get("/rate-fixture")
        assert response.status_code == 429
        assert response.json()["code"] == "rate_limited"
        assert response.headers["retry-after"] == "9"
        assert response.headers["cache-control"] == "no-store"
