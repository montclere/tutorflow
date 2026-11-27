"""Совместимость миграции серий с историей уроков и физическая уникальность экземпляров."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from tests.identity_testkit import seed_account
from tests.postgres_testkit import check_schema, migrate, migrated_schema

from app.modules.scheduling.application.series_contracts import SeriesOccurrence
from app.modules.scheduling.domain.lessons import Lesson, LessonConditions, LessonParticipant
from app.modules.scheduling.domain.recurrence import Frequency, RecurrenceRule
from app.modules.scheduling.domain.series import LessonSeries, SeriesSegment
from app.modules.scheduling.domain.values import LessonPrice
from app.modules.scheduling.infrastructure.persistence.lesson_models import (
    LessonParticipantRow,
    LessonRevisionRow,
    LessonRow,
)
from app.modules.scheduling.infrastructure.persistence.lesson_repository import (
    PostgresLessonsRepository,
)
from app.modules.scheduling.infrastructure.persistence.lesson_snapshots import lesson_snapshot
from app.modules.scheduling.infrastructure.persistence.series_models import (
    SeriesOccurrenceRow,
    SeriesResponseOverrideRow,
)
from app.modules.scheduling.infrastructure.persistence.series_repository import (
    PostgresSeriesRepository,
)


pytestmark = [pytest.mark.anyio, pytest.mark.br_038, pytest.mark.br_043]


async def test_upgrade_preserves_old_lesson_history_and_rejects_duplicate_occurrence(cluster):
    now = datetime.now(UTC)
    owner, lesson_id, card_id = uuid4(), uuid4(), uuid4()
    lesson = Lesson(
        lesson_id,
        owner,
        LessonConditions(now + timedelta(days=1), "UTC", 60),
        (LessonParticipant(card_id, "Ученик", LessonPrice(Decimal("100"))),),
    )
    snapshot = lesson_snapshot(lesson)

    snapshot.pop("series_id")
    snapshot.pop("original_date")

    async with migrated_schema(cluster, "0013") as engine:
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
                insert(LessonRow).values(
                    id=lesson_id,
                    teacher_id=owner,
                    starts_at=lesson.conditions.starts_at,
                    timezone="UTC",
                    duration_minutes=60,
                    fingerprint="legacy",
                )
            )
            await db.execute(
                insert(LessonParticipantRow).values(
                    lesson_id=lesson_id,
                    card_id=card_id,
                    name="Ученик",
                    amount=100,
                    state="not_required",
                )
            )
            await db.execute(
                insert(LessonRevisionRow).values(
                    id=uuid4(),
                    lesson_id=lesson_id,
                    actor_id=owner,
                    happened_at=now,
                    kind="created",
                    snapshot=snapshot,
                )
            )

        await migrate(engine, "head")
        await check_schema(engine)

        rule = RecurrenceRule(
            lesson.conditions.starts_at.date(),
            lesson.conditions.starts_at.time().replace(tzinfo=None),
            "UTC",
            Frequency.DAILY,
            count=2,
        )
        segment = SeriesSegment(uuid4(), rule, lesson, now)
        series = LessonSeries(uuid4(), owner, now, (segment,))

        async with AsyncSession(engine) as db, db.begin():
            repository = PostgresLessonsRepository(db)
            restored = await repository.find(lesson_id, owner)
            history = await repository.history(lesson_id, None, 10)

            assert restored is not None and restored.series_id is None
            assert history[0].lesson == lesson

            series_repository = PostgresSeriesRepository(db)

            assert await series_repository.add(series, uuid4(), "fingerprint")

            await series_repository.link(
                SeriesOccurrence(series.id, segment.id, rule.first_date, lesson)
            )

        with pytest.raises(IntegrityError):
            async with AsyncSession(engine) as db, db.begin():
                duplicate_id = uuid4()

                await db.execute(
                    insert(LessonRow).values(
                        id=duplicate_id,
                        teacher_id=owner,
                        starts_at=lesson.conditions.starts_at,
                        timezone="UTC",
                        duration_minutes=60,
                        fingerprint="duplicate",
                    )
                )
                await db.execute(
                    insert(SeriesOccurrenceRow).values(
                        lesson_id=duplicate_id,
                        series_id=series.id,
                        segment_id=segment.id,
                        local_date=rule.first_date,
                    )
                )

        with pytest.raises(IntegrityError):
            async with AsyncSession(engine) as db, db.begin():
                await db.execute(
                    insert(SeriesResponseOverrideRow).values(lesson_id=lesson_id, card_id=uuid4())
                )

        await migrate(engine, "0013", downgrade=True)

        async with AsyncSession(engine) as db:
            assert await db.get(LessonRow, lesson_id) is not None
            assert (
                len(
                    (
                        await db.scalars(
                            select(LessonRevisionRow).where(
                                LessonRevisionRow.lesson_id == lesson_id
                            )
                        )
                    ).all()
                )
                == 1
            )

        await migrate(engine, "head")
        await check_schema(engine)
