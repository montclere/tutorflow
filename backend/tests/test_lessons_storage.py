"""Миграция уроков на существующих данных и физические ограничения состояния ответов."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import func, insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from tests.identity_testkit import seed_account
from tests.postgres_testkit import check_schema, migrate, migrated_schema

from app.modules.scheduling.infrastructure.models import CalendarBlock
from app.modules.scheduling.infrastructure.persistence.lesson_models import (
    LessonParticipantRow,
    LessonRow,
)
from app.modules.students.infrastructure.persistence.models import StudentCard


pytestmark = [pytest.mark.anyio, pytest.mark.br_095, pytest.mark.br_097]


async def test_lesson_migration_preserves_cards_blocks_and_existing_connection_schema(cluster):
    now = datetime.now(UTC)
    owner, card_id, block_id, lesson_id = [uuid4() for _ in range(4)]

    async with migrated_schema(cluster, "0012") as engine:
        async with AsyncSession(engine) as db, db.begin():
            await seed_account(
                db,
                account_id=owner,
                contact_kind="email",
                contact="teacher@example.com",
                password_hash="hash",
                verified_at=now,
                role="teacher",
            )
            await db.execute(
                insert(StudentCard).values(id=card_id, teacher_id=owner, name="Ученик")
            )
            await db.execute(
                insert(CalendarBlock).values(
                    id=block_id, owner_id=owner, starts_at=now, timezone="UTC", duration_minutes=60
                )
            )

        await migrate(engine, "head")
        await check_schema(engine)

        async with AsyncSession(engine) as db, db.begin():
            assert await db.get(StudentCard, card_id) is not None
            assert await db.get(CalendarBlock, block_id) is not None

            await db.execute(
                insert(LessonRow).values(
                    id=lesson_id,
                    teacher_id=owner,
                    starts_at=now + timedelta(days=1),
                    timezone="UTC",
                    duration_minutes=60,
                    fingerprint="test",
                    confirmation=True,
                )
            )

        for values in [
            dict(state="pending", amount=100),
            dict(state="accepted", amount=100, deadline=now + timedelta(hours=1)),
            dict(state="not_required", amount=-1),
            dict(state="not_required", amount="NaN"),
        ]:
            with pytest.raises(IntegrityError):
                async with AsyncSession(engine) as db, db.begin():
                    await db.execute(
                        insert(LessonParticipantRow).values(
                            lesson_id=lesson_id, card_id=card_id, name="Ученик", **values
                        )
                    )

        async with AsyncSession(engine) as db:
            assert await db.scalar(select(func.count()).select_from(LessonParticipantRow)) == 0

        await migrate(engine, "0012", downgrade=True)
        await migrate(engine, "head")
        await check_schema(engine)
