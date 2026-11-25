"""Проверки назначения подтверждения контакта и атомарности Identity."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.identity_testkit import PASSWORD, finish, start

from app.modules.identity.domain.exceptions import IdentityError
from app.modules.identity.infrastructure.persistence.models import Account, LoginSession
from app.modules.identity.infrastructure.persistence.repository import PostgresIdentityRepository


pytestmark = pytest.mark.anyio


@pytest.mark.br_008
async def test_confirmation_is_bound_to_role_and_specific_invitation(client, inbox, services):
    registration = services.identity.registration
    invitation_id = uuid4()
    challenge = await registration.start_student(
        "email", "student@example.com", invitation_id, "test-client"
    )

    await registration.deliver_pending(challenge)

    code = inbox.messages[-1][2]

    assert (await finish(client, str(challenge), code)).status_code == 400

    with pytest.raises(IdentityError):
        await registration.prepare_student(challenge, code, PASSWORD, uuid4(), "test-client")

    proof = await registration.prepare_student(
        challenge, code, PASSWORD, invitation_id, "test-client"
    )

    assert proof.invitation_id == invitation_id
    assert proof.password_hash.startswith("$argon2id$")
    assert code not in repr(proof) and proof.password_hash not in repr(proof)


@pytest.mark.br_001
async def test_expiry_after_account_insert_rolls_back_teacher_and_session(
    client, inbox, services, database, monkeypatch
):
    challenge = await start(client, {"type": "email", "value": "new@example.com"})
    registration = services.identity.registration
    original = PostgresIdentityRepository.add_account
    expired = datetime.now(UTC) + registration.policy.code_lifetime + timedelta(seconds=1)


    async def delayed(repository, account):
        created = await original(repository, account)

        monkeypatch.setattr(registration, "clock", lambda: expired)

        return created


    monkeypatch.setattr(PostgresIdentityRepository, "add_account", delayed)

    response = await finish(client, challenge, inbox.messages[-1][2])

    assert response.status_code == 400 and not client.cookies

    async with AsyncSession(database) as db:
        assert await db.scalar(select(Account.id)) is None
        assert await db.scalar(select(LoginSession.token_digest)) is None


@pytest.mark.br_079
async def test_public_profile_queries_do_not_load_credentials(client, inbox, services, database):
    from sqlalchemy import event
    from tests.identity_testkit import register


    response = await register(client, {"type": "email", "value": "teacher@example.com"}, inbox)
    account_id = response.json()["account"]["id"]
    statements = []


    def capture(connection, cursor, statement, parameters, context, executemany):
        statements.append(statement)


    event.listen(database.sync_engine, "before_cursor_execute", capture)

    try:
        from uuid import UUID


        async with services.students.cards.persistence.transaction() as unit:
            profile = await unit.accounts.profile(UUID(account_id))
            profiles = await unit.accounts.profiles([UUID(account_id)])
            rejected = await unit.accounts.lock_student(UUID(account_id))

        assert profile is not None and profile.account_id == UUID(account_id)
        assert UUID(account_id) in profiles and rejected is None
        assert statements
        assert all("password_hash" not in sql and "contact" not in sql for sql in statements)
    finally:
        event.remove(database.sync_engine, "before_cursor_execute", capture)
