"""Транзакционные PostgreSQL-операции занятий, снимков, ответов и истории."""

from dataclasses import asdict
from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, literal, select, text, tuple_, union_all, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.scheduling.application.lesson_contracts import (
    CalendarWarning,
    LessonCursor,
    LessonRevision,
    SavedLessonRequest,
    TeachingPreferences,
)
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import (
    Lesson,
    LessonConditions,
    LessonParticipant,
    ReplyState,
)
from app.modules.scheduling.domain.values import LessonPrice, RevisionKind
from app.modules.scheduling.infrastructure.calendar_lock import lock_calendar
from app.modules.scheduling.infrastructure.models import CalendarBlock
from app.modules.scheduling.infrastructure.persistence.change_requests import PostgresChangeRequests
from app.modules.scheduling.infrastructure.persistence.lesson_models import (
    LessonParticipantRow,
    LessonRevisionRow,
    LessonRow,
    TeachingPreferencesRow,
)
from app.modules.scheduling.infrastructure.persistence.lesson_snapshots import (
    lesson_from_snapshot,
    lesson_snapshot,
)
from app.modules.scheduling.infrastructure.persistence.series_models import (
    SeriesOccurrenceRow,
    SeriesResponseOverrideRow,
)


def lesson_values(lesson: Lesson) -> dict:
    return asdict(lesson.conditions) | dict(
        id=lesson.id,
        teacher_id=lesson.teacher_id,
        group_id=lesson.group_id,
        group_name=lesson.group_name,
        confirmation=lesson.confirmation,
        version=lesson.version,
        deleted=lesson.deleted,
        cancelled=lesson.cancelled,
        cancellation_reason=lesson.cancellation_reason,
    )


def participant_value(row: LessonParticipantRow) -> LessonParticipant:
    return LessonParticipant(
        row.card_id,
        row.name,
        LessonPrice(row.amount),
        row.profile_id,
        row.profile_subject,
        ReplyState(row.state),
        row.deadline,
        row.response_by,
        row.replied_at,
        row.cancelled,
        row.cancellation_reason,
    )


class PostgresLessonsRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def lock_calendar(self, teacher_id: UUID) -> None:
        await lock_calendar(self.db, teacher_id)

    async def hydrate(self, rows: list[LessonRow]) -> list[Lesson]:
        if not rows:
            return []

        links = (
            await self.db.scalars(
                select(SeriesOccurrenceRow).where(
                    SeriesOccurrenceRow.lesson_id.in_([row.id for row in rows])
                )
            )
        ).all()
        series_by_lesson = {link.lesson_id: link for link in links}

        participants = await self.db.scalars(
            select(LessonParticipantRow)
            .where(LessonParticipantRow.lesson_id.in_([row.id for row in rows]))
            .order_by(LessonParticipantRow.card_id)
            .execution_options(populate_existing=True)
        )
        by_lesson: dict[UUID, list[LessonParticipant]] = {}

        for row in participants:
            by_lesson.setdefault(row.lesson_id, []).append(participant_value(row))

        return [
            Lesson(
                row.id,
                row.teacher_id,
                LessonConditions(
                    row.starts_at,
                    row.timezone,
                    row.duration_minutes,
                    row.title,
                    row.subject,
                    row.delivery_format,
                    row.private_notes,
                ),
                tuple(by_lesson.get(row.id, [])),
                row.group_id,
                row.group_name,
                row.confirmation,
                row.version,
                row.deleted,
                series_by_lesson[row.id].series_id if row.id in series_by_lesson else None,
                series_by_lesson[row.id].local_date if row.id in series_by_lesson else None,
                row.cancelled,
                row.cancellation_reason,
            )
            for row in rows
        ]

    async def find(
        self,
        lesson_id: UUID,
        teacher_id: UUID | None = None,
        *,
        lock: bool = False,
        include_deleted: bool = False,
    ) -> Lesson | None:
        query = (
            select(LessonRow)
            .where(LessonRow.id == lesson_id)
            .execution_options(populate_existing=True)
        )

        if teacher_id is not None:
            query = query.where(LessonRow.teacher_id == teacher_id)

        if not include_deleted:
            query = query.where(LessonRow.deleted.is_(False))

        if lock:
            query = query.with_for_update()

        row = await self.db.scalar(query)

        return (await self.hydrate([row]))[0] if row is not None else None

    async def find_request(self, teacher_id: UUID, request_id: UUID) -> SavedLessonRequest | None:
        row = await self.db.scalar(
            select(LessonRow).where(
                LessonRow.teacher_id == teacher_id, LessonRow.request_id == request_id
            )
        )

        return (
            SavedLessonRequest(row.fingerprint, (await self.hydrate([row]))[0])
            if row is not None
            else None
        )

    async def add(self, lesson: Lesson, request_id: UUID | None, fingerprint: str) -> bool:
        statement = (
            insert(LessonRow)
            .values(**lesson_values(lesson), request_id=request_id, fingerprint=fingerprint)
            .on_conflict_do_nothing()
            .returning(LessonRow.id)
        )

        if await self.db.scalar(statement) is None:
            return False

        await self.save_participants(lesson)

        return True

    async def save(self, lesson: Lesson) -> None:
        await self.db.execute(
            update(LessonRow)
            .where(LessonRow.id == lesson.id, LessonRow.teacher_id == lesson.teacher_id)
            .values(**lesson_values(lesson))
        )
        await self.save_participants(lesson)
        await PostgresChangeRequests(self.db).supersede(lesson.id, lesson.version)

    async def save_participants(self, lesson: Lesson) -> None:
        condition = LessonParticipantRow.lesson_id == lesson.id
        card_ids = [participant.card_id for participant in lesson.participants]

        if card_ids:
            condition = condition & LessonParticipantRow.card_id.not_in(card_ids)

        await self.db.execute(delete(LessonParticipantRow).where(condition))

        if not lesson.participants:
            return

        values = [
            dict(
                lesson_id=lesson.id,
                card_id=item.card_id,
                name=item.name,
                amount=item.price.amount,
                profile_id=item.profile_id,
                profile_subject=item.profile_subject,
                state=item.state,
                deadline=item.deadline,
                response_by=item.response_by,
                replied_at=item.replied_at,
                cancelled=item.cancelled,
                cancellation_reason=item.cancellation_reason,
            )
            for item in lesson.participants
        ]
        statement = insert(LessonParticipantRow).values(values)
        fields = (
            "name",
            "amount",
            "profile_id",
            "profile_subject",
            "state",
            "deadline",
            "response_by",
            "replied_at",
            "cancelled",
            "cancellation_reason",
        )

        await self.db.execute(
            statement.on_conflict_do_update(
                index_elements=[LessonParticipantRow.lesson_id, LessonParticipantRow.card_id],
                set_={name: getattr(statement.excluded, name) for name in fields},
            )
        )

    async def append_revision(self, revision: LessonRevision) -> None:
        self.db.add(
            LessonRevisionRow(
                id=revision.id,
                lesson_id=revision.lesson.id,
                actor_id=revision.actor_id,
                happened_at=revision.happened_at,
                kind=revision.kind,
                snapshot=lesson_snapshot(revision.lesson),
            )
        )
        await self.db.flush()

    async def history(
        self, lesson_id: UUID, after_id: UUID | None, limit: int
    ) -> list[LessonRevision]:
        query = select(LessonRevisionRow).where(LessonRevisionRow.lesson_id == lesson_id)

        if after_id is not None:
            sequence = await self.db.scalar(
                select(LessonRevisionRow.sequence).where(
                    LessonRevisionRow.id == after_id, LessonRevisionRow.lesson_id == lesson_id
                )
            )

            if sequence is None:
                raise LessonError("invalid_lesson_cursor")

            query = query.where(LessonRevisionRow.sequence > sequence)

        rows = await self.db.scalars(query.order_by(LessonRevisionRow.sequence).limit(limit))

        return [
            LessonRevision(
                row.id,
                row.actor_id,
                row.happened_at,
                RevisionKind(row.kind),
                lesson_from_snapshot(row.snapshot),
            )
            for row in rows
        ]

    async def for_teacher(
        self,
        teacher_id: UUID,
        start: datetime,
        end: datetime,
        cursor: LessonCursor | None,
        limit: int,
        group_id: UUID | None = None,
    ) -> list[Lesson]:
        query = select(LessonRow).where(
            LessonRow.teacher_id == teacher_id,
            LessonRow.deleted.is_(False),
            LessonRow.starts_at < end,
            LessonRow.starts_at + LessonRow.duration_minutes * text("interval '1 minute'") > start,
        )

        if group_id is not None:
            query = query.where(LessonRow.group_id == group_id)

        if cursor is not None:
            query = query.where(
                tuple_(LessonRow.starts_at, LessonRow.id) > (cursor.starts_at, cursor.id)
            )

        rows = (
            await self.db.scalars(query.order_by(LessonRow.starts_at, LessonRow.id).limit(limit))
        ).all()

        return await self.hydrate(list(rows))

    async def for_card(
        self,
        card_id: UUID,
        teacher_id: UUID,
        start: datetime,
        end: datetime,
        cursor: LessonCursor | None,
        limit: int,
        group_id: UUID | None = None,
    ) -> list[Lesson]:
        query = (
            select(LessonRow)
            .join(LessonParticipantRow, LessonParticipantRow.lesson_id == LessonRow.id)
            .where(
                LessonParticipantRow.card_id == card_id,
                LessonRow.teacher_id == teacher_id,
                LessonRow.deleted.is_(False),
                LessonRow.starts_at < end,
                LessonRow.starts_at + LessonRow.duration_minutes * text("interval '1 minute'")
                > start,
            )
        )

        if group_id is not None:
            query = query.where(LessonRow.group_id == group_id)

        if cursor is not None:
            query = query.where(
                tuple_(LessonRow.starts_at, LessonRow.id) > (cursor.starts_at, cursor.id)
            )

        rows = (
            await self.db.scalars(query.order_by(LessonRow.starts_at, LessonRow.id).limit(limit))
        ).all()

        return await self.hydrate(list(rows))

    async def warnings(self, lesson: Lesson, limit: int) -> list[CalendarWarning]:
        other_lessons = select(
            LessonRow.id.label("event_id"),
            literal("lesson_overlap").label("code"),
            LessonRow.starts_at.label("starts_at"),
        ).where(
            LessonRow.teacher_id == lesson.teacher_id,
            LessonRow.id != lesson.id,
            LessonRow.cancelled.is_(False),
            LessonRow.deleted.is_(False),
            LessonRow.starts_at < lesson.conditions.ends_at,
            LessonRow.starts_at + LessonRow.duration_minutes * text("interval '1 minute'")
            > lesson.conditions.starts_at,
        )
        blocks = select(
            CalendarBlock.id.label("event_id"),
            literal("calendar_block_overlap").label("code"),
            CalendarBlock.starts_at.label("starts_at"),
        ).where(
            CalendarBlock.owner_id == lesson.teacher_id,
            CalendarBlock.starts_at < lesson.conditions.ends_at,
            CalendarBlock.starts_at + CalendarBlock.duration_minutes * text("interval '1 minute'")
            > lesson.conditions.starts_at,
        )
        rows = await self.db.execute(
            union_all(other_lessons, blocks).order_by("starts_at", "event_id").limit(limit)
        )

        return [CalendarWarning(code, event_id) for event_id, code, starts_at in rows]

    async def preferences(self, teacher_id: UUID) -> TeachingPreferences:
        row = await self.db.get(TeachingPreferencesRow, teacher_id)

        return (
            TeachingPreferences(
                LessonPrice(row.amount) if row.amount is not None else None, row.duration_minutes
            )
            if row
            else TeachingPreferences()
        )

    async def save_preferences(self, teacher_id: UUID, preferences: TeachingPreferences) -> None:
        statement = insert(TeachingPreferencesRow).values(
            teacher_id=teacher_id,
            amount=preferences.price.amount if preferences.price else None,
            duration_minutes=preferences.duration_minutes,
        )

        await self.db.execute(
            statement.on_conflict_do_update(
                index_elements=[TeachingPreferencesRow.teacher_id],
                set_={
                    "amount": statement.excluded.amount,
                    "duration_minutes": statement.excluded.duration_minutes,
                },
            )
        )

    async def mark_exception(self, lesson_id: UUID) -> None:
        await self.db.execute(
            update(SeriesOccurrenceRow)
            .where(SeriesOccurrenceRow.lesson_id == lesson_id)
            .values(customized=True)
        )

    async def mark_response_exception(self, lesson_id: UUID, card_id: UUID) -> None:
        if (
            await self.db.scalar(
                select(SeriesOccurrenceRow.lesson_id).where(
                    SeriesOccurrenceRow.lesson_id == lesson_id
                )
            )
            is not None
        ):
            await self.db.execute(
                insert(SeriesResponseOverrideRow)
                .values(lesson_id=lesson_id, card_id=card_id)
                .on_conflict_do_nothing()
            )
