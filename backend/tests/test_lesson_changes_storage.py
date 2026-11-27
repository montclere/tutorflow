"""Обновление старых занятий и ограничения хранения запросов изменения."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from tests.identity_testkit import seed_account
from tests.postgres_testkit import check_schema, migrate, migrated_schema

from app.modules.scheduling.domain.change_requests import ChangeKind, LessonChangeRequest
from app.modules.scheduling.domain.lessons import Lesson, LessonConditions, LessonParticipant
from app.modules.scheduling.domain.values import LessonPrice
from app.modules.scheduling.infrastructure.persistence.change_requests import PostgresChangeRequests
from app.modules.scheduling.infrastructure.persistence.lesson_models import (
    LessonParticipantRow,
    LessonRevisionRow,
    LessonRow,
)
from app.modules.scheduling.infrastructure.persistence.lesson_repository import (
    PostgresLessonsRepository,
)
from app.modules.scheduling.infrastructure.persistence.lesson_snapshots import lesson_snapshot


pytestmark = [pytest.mark.anyio, pytest.mark.br_044, pytest.mark.br_045, pytest.mark.br_048]


async def test_upgrade_keeps_old_snapshots_and_database_rejects_duplicate_open_request(cluster):
    now = datetime.now(UTC)
    owner, card_id = uuid4(), uuid4()
    lesson = Lesson(
        uuid4(),
        owner,
        LessonConditions(now + timedelta(days=2), "UTC", 60),
        (LessonParticipant(card_id, "Ученик", LessonPrice(Decimal(100))),),
    )
    snapshot = lesson_snapshot(lesson)

    snapshot.pop("cancelled")
    snapshot.pop("cancellation_reason")
    snapshot["participants"][0].pop("cancelled")
    snapshot["participants"][0].pop("cancellation_reason")

    async with migrated_schema(cluster, "0014") as engine:
        async with AsyncSession(engine) as db, db.begin():
            await seed_account(
                db,
                account_id=owner,
                contact_kind="email",
                contact="owner@example.com",
                password_hash="hash",
                verified_at=now,
                role="teacher",
            )
            await db.execute(
                insert(LessonRow).values(
                    id=lesson.id,
                    teacher_id=owner,
                    starts_at=lesson.conditions.starts_at,
                    timezone="UTC",
                    duration_minutes=60,
                    fingerprint="old",
                )
            )
            await db.execute(
                insert(LessonParticipantRow).values(
                    lesson_id=lesson.id,
                    card_id=card_id,
                    name="Ученик",
                    amount=100,
                    state="not_required",
                )
            )
            await db.execute(
                insert(LessonRevisionRow).values(
                    id=uuid4(),
                    lesson_id=lesson.id,
                    actor_id=owner,
                    happened_at=now,
                    kind="created",
                    snapshot=snapshot,
                )
            )

        await migrate(engine, "head")
        await check_schema(engine)

        async with AsyncSession(engine) as db, db.begin():
            repository = PostgresLessonsRepository(db)
            loaded = await repository.find(lesson.id)
            history = await repository.history(lesson.id, None, 10)

            assert loaded is not None and not loaded.cancelled
            assert not history[0].lesson.participants[0].cancelled

            request = LessonChangeRequest.create(
                loaded, card_id, uuid4(), ChangeKind.CANCEL, None, None, now, 1
            )
            requests = PostgresChangeRequests(db)

            await requests.add(request)

            with pytest.raises(IntegrityError):
                async with db.begin_nested():
                    from app.modules.scheduling.infrastructure.persistence.change_requests import (
                        LessonChangeRequestRow,
                    )


                    duplicate = replace(request, id=uuid4())

                    await db.execute(
                        insert(LessonChangeRequestRow).values(
                            **{
                                name: getattr(duplicate, name)
                                for name in duplicate.__dataclass_fields__
                            }
                        )
                    )

        await migrate(engine, "0014", downgrade=True)
        await migrate(engine, "head")
        await check_schema(engine)
