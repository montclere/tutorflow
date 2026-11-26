"""Миграция существующих аккаунтов и ограничения участия на уровне PostgreSQL."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import insert, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from tests.identity_testkit import seed_account
from tests.postgres_testkit import check_schema, migrate, migrated_schema

from app.modules.identity.infrastructure.persistence.models import (
    Account,
    AccountRole,
    LoginSession,
)
from app.modules.students.infrastructure.persistence.models import Connection, StudentCard


pytestmark = [pytest.mark.anyio, pytest.mark.br_090]


async def test_upgrade_preserves_accounts_profiles_sessions_and_both_connection_types(cluster):
    now = datetime.now(UTC)
    owner, child, adult, card_id = [uuid4() for _ in range(4)]

    async with migrated_schema(cluster, "0008") as engine:
        async with AsyncSession(engine) as db, db.begin():
            for account_id, role in [(owner, "teacher"), (child, "student"), (adult, "adult")]:
                await seed_account(
                    db,
                    account_id=account_id,
                    contact_kind="email",
                    contact=f"{role}@example.com",
                    password_hash="preserved-hash",
                    verified_at=now,
                    role=role,
                    legacy=True,
                )

            await db.execute(
                text("UPDATE identity_accounts SET display_name = 'Имя', timezone = 'UTC'")
            )
            await db.execute(
                insert(StudentCard).values(id=card_id, teacher_id=owner, name="Ребёнок")
            )
            await db.execute(
                text(
                    "INSERT INTO students_connections (card_id, teacher_id, account_id) "
                    "VALUES (:card, :owner, :account)"
                ),
                dict(card=card_id, owner=owner, account=child),
            )
            await db.execute(
                text(
                    "INSERT INTO students_adult_connections "
                    "(card_id, teacher_id, account_id, slot) VALUES (:card, :owner, :account, 1)"
                ),
                dict(card=card_id, owner=owner, account=adult),
            )
            await db.execute(
                insert(LoginSession).values(
                    token_digest="preserved-session",
                    account_id=adult,
                    expires_at=now + timedelta(days=1),
                )
            )

        await migrate(engine, "head")
        await check_schema(engine)

        async with AsyncSession(engine) as db:
            accounts = (await db.scalars(select(Account))).all()
            connections = (await db.scalars(select(Connection).order_by(Connection.slot))).all()

            assert {account.id for account in accounts} == {owner, child, adult}
            assert all(account.password_hash == "preserved-hash" for account in accounts)
            assert all(
                account.display_name == "Имя" and account.timezone == "UTC" for account in accounts
            )
            assert {
                (account.id, frozenset(item.role for item in account.role_assignments))
                for account in accounts
            } == {
                (owner, frozenset({"teacher"})),
                (child, frozenset({"student"})),
                (adult, frozenset({"adult"})),
            }
            assert [(item.account_id, item.role, item.slot) for item in connections] == [
                (child, "student", 0),
                (adult, "adult", 1),
            ]

            session = await db.get(LoginSession, "preserved-session")

            assert session is not None
            assert session.account_id == adult

        await migrate(engine, "0008", downgrade=True)
        await migrate(engine, "head")
        await check_schema(engine)

        async with AsyncSession(engine) as db, db.begin():
            await db.execute(
                insert(AccountRole).values(account_id=adult, role="teacher", created_at=now)
            )

        with pytest.raises(ValueError, match="потеряет"):
            await migrate(engine, "0008", downgrade=True)

        await check_schema(engine)

        async with AsyncSession(engine) as db:
            assert set(
                await db.scalars(select(AccountRole.role).where(AccountRole.account_id == adult))
            ) == {"adult", "teacher"}
            assert len((await db.scalars(select(Connection))).all()) == 2


@pytest.mark.br_088
async def test_database_rejects_self_student_and_two_participation_types(database):
    owner, person, card_id = uuid4(), uuid4(), uuid4()
    now = datetime.now(UTC)

    async with AsyncSession(database) as db, db.begin():
        for account_id in (owner, person):
            await seed_account(
                db,
                account_id=account_id,
                role="teacher",
                contact_kind="email",
                contact=f"{account_id}@example.com",
                password_hash="hash",
                verified_at=now,
            )

            for role in ("student", "adult"):
                await db.execute(
                    insert(AccountRole).values(account_id=account_id, role=role, created_at=now)
                )

        await db.execute(insert(StudentCard).values(id=card_id, teacher_id=owner, name="Ребёнок"))
        await db.execute(
            insert(Connection).values(
                card_id=card_id, teacher_id=owner, account_id=person, role="student", slot=0
            )
        )

    for account_id, role, slot in [(person, "adult", 1), (owner, "student", 0)]:
        with pytest.raises(IntegrityError):
            async with AsyncSession(database) as db, db.begin():
                await db.execute(
                    insert(Connection).values(
                        card_id=card_id,
                        teacher_id=owner,
                        account_id=account_id,
                        role=role,
                        slot=slot,
                    )
                )

    async with AsyncSession(database) as db, db.begin():
        await db.execute(
            insert(Connection).values(
                card_id=card_id, teacher_id=owner, account_id=owner, role="adult", slot=1
            )
        )
