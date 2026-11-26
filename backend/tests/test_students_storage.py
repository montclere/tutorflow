"""Проверки ограничений и обновления схемы Students на PostgreSQL."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy import insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from tests.identity_testkit import seed_account
from tests.postgres_testkit import check_schema, migrate, migrated_schema

from app.modules.identity.infrastructure.persistence.models import Registration
from app.modules.students.infrastructure.persistence.models import (
    Connection,
    LearningProfile,
    StudentCard,
)


pytestmark = pytest.mark.anyio


@pytest.mark.br_008
async def test_upgrade_keeps_existing_teacher_confirmation_scope(cluster):
    now = datetime.now(UTC)
    identifier = uuid4()

    async with migrated_schema(cluster, "0004") as engine:
        async with AsyncSession(engine) as db, db.begin():
            await db.execute(
                insert(Registration).values(
                    id=identifier,
                    contact_kind="email",
                    contact="pending@example.com",
                    code_digest="stored",
                    sent_at=now,
                    expires_at=now + timedelta(minutes=10),
                    remaining_attempts=5,
                )
            )

        await migrate(engine, "head")
        await check_schema(engine)

        async with AsyncSession(engine) as db:
            row = await db.scalar(select(Registration).where(Registration.id == identifier))

            assert row is not None and row.role == "teacher" and row.invitation_id is None
            assert row.code_digest == "stored" and row.remaining_attempts == 5


@pytest.mark.br_010
@pytest.mark.br_076
async def test_database_protects_price_card_owner_and_connection_uniqueness(database):
    teacher_a, teacher_b, student = uuid4(), uuid4(), uuid4()
    first, second = uuid4(), uuid4()
    now = datetime.now(UTC)

    async with AsyncSession(database) as db, db.begin():
        for identifier, role in [
            (teacher_a, "teacher"),
            (teacher_b, "teacher"),
            (student, "student"),
        ]:
            await seed_account(
                db,
                account_id=identifier,
                contact_kind="email",
                contact=f"{identifier}@example.com",
                verified_at=now,
                password_hash="hash",
                role=role,
            )

        for identifier in (first, second):
            await db.execute(
                insert(StudentCard).values(id=identifier, teacher_id=teacher_a, name="Имя")
            )

        await db.execute(
            insert(Connection).values(card_id=first, teacher_id=teacher_a, account_id=student)
        )

    for values in [
        {"amount": Decimal("-0.01"), "currency": "RUB"},
        {"amount": Decimal("NaN"), "currency": "RUB"},
        {"amount": Decimal("1"), "currency": "USD"},
    ]:
        with pytest.raises(IntegrityError):
            async with AsyncSession(database) as db, db.begin():
                await db.execute(
                    insert(LearningProfile).values(id=uuid4(), card_id=first, **values)
                )

    for owner in (teacher_a, teacher_b):
        with pytest.raises(IntegrityError):
            async with AsyncSession(database) as db, db.begin():
                await db.execute(
                    insert(Connection).values(card_id=second, teacher_id=owner, account_id=student)
                )

    with pytest.raises(IntegrityError):
        async with AsyncSession(database) as db, db.begin():
            await db.execute(
                insert(Registration).values(
                    id=uuid4(),
                    contact_kind="email",
                    contact="invalid@example.com",
                    code_digest="hash",
                    sent_at=now,
                    expires_at=now + timedelta(minutes=10),
                    remaining_attempts=5,
                    role="teacher",
                    invitation_id=UUID(int=1),
                )
            )
