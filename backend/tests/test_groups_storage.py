"""Ограничения владения и миграция групп на заполненной схеме PostgreSQL."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import delete, func, insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from tests.identity_testkit import seed_account
from tests.postgres_testkit import check_schema, migrate, migrated_schema

from app.modules.groups.infrastructure.persistence.models import Group, Membership
from app.modules.identity.infrastructure.persistence.models import Account
from app.modules.students.infrastructure.persistence.models import StudentCard


pytestmark = pytest.mark.anyio


@pytest.mark.br_022
@pytest.mark.br_091
async def test_database_rejects_cross_owner_duplicate_and_invalid_memberships(database):
    owner, other, group_id, card_id, foreign_card = [uuid4() for _ in range(5)]
    now = datetime.now(UTC)

    async with AsyncSession(database) as db, db.begin():
        for account_id in (owner, other):
            await seed_account(
                db,
                account_id=account_id,
                contact_kind="email",
                contact=f"{account_id}@example.com",
                password_hash="hash",
                verified_at=now,
                role="teacher",
            )

        await db.execute(insert(Group).values(id=group_id, teacher_id=owner, name="Группа"))
        await db.execute(insert(StudentCard).values(id=card_id, teacher_id=owner, name="Свой"))
        await db.execute(
            insert(StudentCard).values(id=foreign_card, teacher_id=other, name="Чужой")
        )
        await db.execute(
            insert(Membership).values(
                group_id=group_id, card_id=card_id, teacher_id=owner, amount=0
            )
        )

    for target, teacher_id, amount in [
        (card_id, owner, 1),
        (foreign_card, owner, 1),
        (foreign_card, other, 1),
    ]:
        with pytest.raises(IntegrityError):
            async with AsyncSession(database) as db, db.begin():
                await db.execute(
                    insert(Membership).values(
                        group_id=group_id, card_id=target, teacher_id=teacher_id, amount=amount
                    )
                )

    async with AsyncSession(database) as db, db.begin():
        await db.execute(delete(Membership))

    for amount in ("-1", "NaN"):
        with pytest.raises(IntegrityError):
            async with AsyncSession(database) as db, db.begin():
                await db.execute(
                    insert(Membership).values(
                        group_id=group_id, card_id=card_id, teacher_id=owner, amount=amount
                    )
                )


@pytest.mark.br_021
@pytest.mark.br_093
async def test_upgrade_preserves_existing_cards_and_orm_matches_schema(cluster):
    owner, card_id = uuid4(), uuid4()

    async with migrated_schema(cluster, "0010") as engine:
        async with AsyncSession(engine) as db, db.begin():
            await seed_account(
                db,
                account_id=owner,
                contact_kind="email",
                contact="teacher@example.com",
                password_hash="hash",
                verified_at=datetime.now(UTC),
                role="teacher",
            )
            await db.execute(
                insert(StudentCard).values(id=card_id, teacher_id=owner, name="Ученик")
            )

        await migrate(engine, "head")
        await check_schema(engine)

        async with AsyncSession(engine) as db:
            student = await db.get(StudentCard, card_id)
            account = await db.get(Account, owner)

            assert student is not None and student.name == "Ученик"
            assert account is not None and account.password_hash == "hash"
            assert await db.scalar(select(func.count()).select_from(Group)) == 0

        await migrate(engine, "0010", downgrade=True)
        await migrate(engine, "head")
        await check_schema(engine)
