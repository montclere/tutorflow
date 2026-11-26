"""Миграция ответственных без угадывания и ограничения действующего подключения."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import delete, insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from tests.identity_testkit import seed_account
from tests.postgres_testkit import check_schema, migrate, migrated_schema

from app.modules.students.infrastructure.persistence.models import (
    CardResponsibility,
    Connection,
    StudentCard,
)


pytestmark = [pytest.mark.anyio, pytest.mark.br_033, pytest.mark.br_098]


async def test_migration_assigns_only_unambiguous_existing_connection_and_fk_revokes_it(cluster):
    owner, adult, child, observer, single, multiple = [uuid4() for _ in range(6)]
    now = datetime.now(UTC)

    async with migrated_schema(cluster, "0011") as engine:
        async with AsyncSession(engine) as db, db.begin():
            for account_id, role in [
                (owner, "teacher"),
                (adult, "adult"),
                (child, "student"),
                (observer, "adult"),
            ]:
                await seed_account(
                    db,
                    account_id=account_id,
                    contact_kind="email",
                    contact=f"{account_id}@example.com",
                    password_hash="hash",
                    verified_at=now,
                    role=role,
                )

            for card_id in (single, multiple):
                await db.execute(
                    insert(StudentCard).values(id=card_id, teacher_id=owner, name="Ученик")
                )

            for card_id, account_id, role, slot in [
                (single, adult, "adult", 1),
                (multiple, child, "student", 0),
                (multiple, observer, "adult", 1),
            ]:
                await db.execute(
                    insert(Connection).values(
                        card_id=card_id,
                        teacher_id=owner,
                        account_id=account_id,
                        role=role,
                        slot=slot,
                    )
                )

        await migrate(engine, "head")
        await check_schema(engine)

        async with AsyncSession(engine) as db:
            assignments = (await db.scalars(select(CardResponsibility))).all()

            assert len(assignments) == 1
            assert assignments[0].card_id == single and assignments[0].account_id == adult

        for card_id, account_id, category in [
            (single, observer, "scheduling"),
            (single, adult, "finance"),
            (multiple, adult, "scheduling"),
        ]:
            with pytest.raises(IntegrityError):
                async with AsyncSession(engine) as db, db.begin():
                    await db.execute(
                        insert(CardResponsibility).values(
                            card_id=card_id,
                            account_id=account_id,
                            category=category,
                            assigned_at=now,
                        )
                    )

        async with AsyncSession(engine) as db, db.begin():
            await db.execute(delete(Connection).where(Connection.card_id == single))

        async with AsyncSession(engine) as db:
            assert not (await db.scalars(select(CardResponsibility))).all()
