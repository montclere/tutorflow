"""PostgreSQL-хранение серий, экземпляров и ограниченной истории изменений."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, or_, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.scheduling.application.series_contracts import (
    SavedSeriesRequest,
    SeriesRevision,
)
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.series import LessonSeries, SeriesOccurrence
from app.modules.scheduling.infrastructure.persistence.lesson_models import LessonRow
from app.modules.scheduling.infrastructure.persistence.lesson_repository import (
    PostgresLessonsRepository,
)
from app.modules.scheduling.infrastructure.persistence.series_models import (
    SeriesMemberRow,
    SeriesOccurrenceRow,
    SeriesResponseOverrideRow,
    SeriesRevisionRow,
    SeriesRow,
)
from app.modules.scheduling.infrastructure.persistence.series_snapshots import (
    series_from_snapshot,
    series_snapshot,
)


class PostgresSeriesRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.lessons = PostgresLessonsRepository(db)

    async def find(
        self, series_id: UUID, teacher_id: UUID, *, lock: bool = False
    ) -> LessonSeries | None:
        query = (
            select(SeriesRow)
            .where(SeriesRow.id == series_id, SeriesRow.teacher_id == teacher_id)
            .execution_options(populate_existing=True)
        )

        if lock:
            query = query.with_for_update()

        row = await self.db.scalar(query)

        return series_from_snapshot(row.snapshot) if row else None

    async def find_request(self, teacher_id: UUID, request_id: UUID) -> SavedSeriesRequest | None:
        row = await self.db.scalar(
            select(SeriesRow).where(
                SeriesRow.teacher_id == teacher_id, SeriesRow.request_id == request_id
            )
        )

        return (
            SavedSeriesRequest(row.fingerprint, series_from_snapshot(row.snapshot)) if row else None
        )

    async def add(self, series: LessonSeries, request_id: UUID | None, fingerprint: str) -> bool:
        inserted = await self.db.scalar(
            insert(SeriesRow)
            .values(
                id=series.id,
                teacher_id=series.teacher_id,
                version=series.version,
                request_id=request_id,
                fingerprint=fingerprint,
                snapshot=series_snapshot(series),
            )
            .on_conflict_do_nothing()
            .returning(SeriesRow.id)
        )

        if inserted is None:
            return False

        await self.save_members(series)

        return True

    async def save(self, series: LessonSeries) -> None:
        await self.db.execute(
            update(SeriesRow)
            .where(SeriesRow.id == series.id, SeriesRow.teacher_id == series.teacher_id)
            .values(version=series.version, snapshot=series_snapshot(series))
        )
        await self.save_members(series)

    async def save_members(self, series: LessonSeries) -> None:
        cards = {
            part.card_id for segment in series.segments for part in segment.template.participants
        }

        await self.db.execute(delete(SeriesMemberRow).where(SeriesMemberRow.series_id == series.id))

        if cards:
            await self.db.execute(
                insert(SeriesMemberRow).values(
                    [dict(series_id=series.id, card_id=card_id) for card_id in sorted(cards)]
                )
            )

    async def list_series(
        self,
        teacher_id: UUID,
        limit: int,
        after_id: UUID | None = None,
        card_id: UUID | None = None,
    ) -> list[LessonSeries]:
        query = select(SeriesRow).where(SeriesRow.teacher_id == teacher_id)

        if card_id is not None:
            query = query.join(SeriesMemberRow, SeriesMemberRow.series_id == SeriesRow.id).where(
                SeriesMemberRow.card_id == card_id
            )

        if after_id is not None:
            query = query.where(SeriesRow.id > after_id)

        rows = await self.db.scalars(query.order_by(SeriesRow.id).limit(limit))

        return [series_from_snapshot(row.snapshot) for row in rows]

    async def occurrences(
        self,
        series_id: UUID,
        *,
        start: datetime | None = None,
        end: datetime | None = None,
        limit: int = 1001,
    ) -> list[SeriesOccurrence]:
        query = (
            select(SeriesOccurrenceRow, LessonRow)
            .join(LessonRow, LessonRow.id == SeriesOccurrenceRow.lesson_id)
            .where(
                SeriesOccurrenceRow.series_id == series_id, SeriesOccurrenceRow.retired.is_(False)
            )
        )

        if start is not None:
            query = query.where(
                or_(
                    LessonRow.starts_at + LessonRow.duration_minutes * text("interval '1 minute'")
                    > start,
                    SeriesOccurrenceRow.local_date >= start.date(),
                )
            )

        if end is not None:
            query = query.where(
                or_(LessonRow.starts_at < end, SeriesOccurrenceRow.local_date <= end.date())
            )

        rows = (
            await self.db.execute(
                query.order_by(SeriesOccurrenceRow.local_date, SeriesOccurrenceRow.lesson_id)
                .limit(limit)
                .execution_options(populate_existing=True)
            )
        ).all()
        lessons = await self.lessons.hydrate([row[1] for row in rows])

        return [
            SeriesOccurrence(
                series_id,
                row[0].segment_id,
                row[0].local_date,
                lesson,
                row[0].customized,
                row[0].suppressed,
            )
            for row, lesson in zip(rows, lessons, strict=True)
        ]

    async def link(self, occurrence: SeriesOccurrence) -> None:
        await self.db.execute(
            insert(SeriesOccurrenceRow).values(
                lesson_id=occurrence.lesson.id,
                series_id=occurrence.series_id,
                segment_id=occurrence.segment_id,
                local_date=occurrence.local_date,
                customized=occurrence.customized,
                suppressed=occurrence.suppressed,
            )
        )

    async def set_suppressed(self, lesson_id: UUID, suppressed: bool) -> None:
        await self.db.execute(
            update(SeriesOccurrenceRow)
            .where(SeriesOccurrenceRow.lesson_id == lesson_id)
            .values(suppressed=suppressed)
        )

    async def response_overrides(self, series_id: UUID, card_id: UUID) -> set[UUID]:
        rows = await self.db.scalars(
            select(SeriesResponseOverrideRow.lesson_id)
            .join(
                SeriesOccurrenceRow,
                SeriesOccurrenceRow.lesson_id == SeriesResponseOverrideRow.lesson_id,
            )
            .where(
                SeriesOccurrenceRow.series_id == series_id,
                SeriesResponseOverrideRow.card_id == card_id,
            )
        )

        return set(rows)

    async def append_revision(self, revision: SeriesRevision) -> None:
        self.db.add(
            SeriesRevisionRow(
                id=revision.id,
                series_id=revision.series.id,
                actor_id=revision.actor_id,
                happened_at=revision.happened_at,
                kind=revision.kind,
                snapshot=series_snapshot(revision.series),
            )
        )

        await self.db.flush()

    async def history(
        self, series_id: UUID, after_id: UUID | None, limit: int
    ) -> list[SeriesRevision]:
        query = select(SeriesRevisionRow).where(SeriesRevisionRow.series_id == series_id)

        if after_id is not None:
            sequence = await self.db.scalar(
                select(SeriesRevisionRow.sequence).where(
                    SeriesRevisionRow.id == after_id, SeriesRevisionRow.series_id == series_id
                )
            )

            if sequence is None:
                raise LessonError("invalid_lesson_cursor")

            query = query.where(SeriesRevisionRow.sequence > sequence)

        rows = await self.db.scalars(query.order_by(SeriesRevisionRow.sequence).limit(limit))

        return [
            SeriesRevision(
                row.id, row.actor_id, row.happened_at, row.kind, series_from_snapshot(row.snapshot)
            )
            for row in rows
        ]

    async def set_customized(self, lesson_id: UUID, customized: bool) -> None:
        await self.db.execute(
            update(SeriesOccurrenceRow)
            .where(SeriesOccurrenceRow.lesson_id == lesson_id)
            .values(customized=customized)
        )

    async def retire(self, lesson_id: UUID) -> None:
        await self.db.execute(
            update(SeriesOccurrenceRow)
            .where(SeriesOccurrenceRow.lesson_id == lesson_id)
            .values(retired=True, suppressed=False)
        )
