"""Проверки физического лимита взрослых и обновления схемы с данными."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from tests.postgres_testkit import check_schema, migrate, migrated_schema

from app.modules.identity.infrastructure.persistence.models import Account, Registration
from app.modules.students.infrastructure.persistence.adult_models import (
    AdultConnection,
    AdultInvitation,
)
from app.modules.students.infrastructure.persistence.models import StudentCard


pytestmark = pytest.mark.anyio


@pytest.mark.br_082
@pytest.mark.br_083
async def test_database_rejects_third_slot_duplicate_account_and_wrong_card_owner(database):
    owner, other_owner, card, second_card = uuid4(), uuid4(), uuid4(), uuid4()
    adults = [uuid4() for _ in range(3)]
    now = datetime.now(UTC)

    async with AsyncSession(database) as db, db.begin():
        for account_id in [owner, other_owner, *adults]:
            await db.execute(
                insert(Account).values(
                    id=account_id,
                    role="teacher" if account_id in [owner, other_owner] else "adult",
                    contact_kind="email",
                    contact=f"{account_id}@example.com",
                    password_hash="hash",
                    verified_at=now,
                )
            )

        for card_id in (card, second_card):
            await db.execute(insert(StudentCard).values(id=card_id, teacher_id=owner, name="Имя"))

        await db.execute(
            insert(AdultConnection).values(
                card_id=second_card, teacher_id=owner, account_id=adults[0], slot=1
            )
        )

        for slot, account_id in enumerate(adults[:2], 1):
            await db.execute(
                insert(AdultConnection).values(
                    card_id=card, teacher_id=owner, account_id=account_id, slot=slot
                )
            )

    for target_card, account_id, slot, teacher_id in [
        (card, adults[2], 3, owner),
        (card, adults[2], 1, owner),
        (second_card, adults[0], 2, owner),
        (second_card, adults[2], 2, other_owner),
    ]:
        with pytest.raises(IntegrityError):
            async with AsyncSession(database) as db, db.begin():
                await db.execute(
                    insert(AdultConnection).values(
                        card_id=target_card, teacher_id=teacher_id, account_id=account_id, slot=slot
                    )
                )

    async with AsyncSession(database) as db, db.begin():
        for slot in [1, 2]:
            await db.execute(
                insert(AdultInvitation).values(
                    id=uuid4(),
                    card_id=card,
                    slot=slot,
                    token_digest=str(slot),
                    created_at=now,
                    expires_at=now + timedelta(days=7),
                )
            )

    for slot in [1, 3]:
        with pytest.raises(IntegrityError):
            async with AsyncSession(database) as db, db.begin():
                await db.execute(
                    insert(AdultInvitation).values(
                        id=uuid4(),
                        card_id=card,
                        slot=slot,
                        token_digest=str(uuid4()),
                        created_at=now,
                        expires_at=now + timedelta(days=7),
                    )
                )


@pytest.mark.br_084
async def test_upgrade_preserves_teacher_and_student_confirmations(cluster):
    now = datetime.now(UTC)
    student_invitation = uuid4()

    async with migrated_schema(cluster, "0006") as engine:
        async with AsyncSession(engine) as db, db.begin():
            for role, invitation in [("teacher", None), ("student", student_invitation)]:
                await db.execute(
                    insert(Registration).values(
                        id=uuid4(),
                        role=role,
                        invitation_id=invitation,
                        contact_kind="email",
                        contact=f"{role}@example.com",
                        code_digest="existing",
                        sent_at=now,
                        expires_at=now + timedelta(minutes=10),
                        remaining_attempts=3,
                    )
                )

        await migrate(engine, "head")
        await check_schema(engine)

        async with AsyncSession(engine) as db:
            rows = (await db.scalars(select(Registration).order_by(Registration.role))).all()

            assert [(row.role, row.invitation_id, row.remaining_attempts) for row in rows] == [
                ("student", student_invitation, 3),
                ("teacher", None, 3),
            ]

        async with AsyncSession(engine) as db, db.begin():
            await db.execute(
                insert(Registration).values(
                    id=uuid4(),
                    role="adult",
                    invitation_id=uuid4(),
                    contact_kind="email",
                    contact="adult@example.com",
                    code_digest="new",
                    sent_at=now,
                    expires_at=now + timedelta(minutes=10),
                    remaining_attempts=3,
                )
            )

        with pytest.raises(IntegrityError):
            await migrate(engine, "0006", downgrade=True)

        await check_schema(engine)

        async with AsyncSession(engine) as db:
            assert (
                await db.scalar(select(Registration.id).where(Registration.role == "adult"))
                is not None
            )
