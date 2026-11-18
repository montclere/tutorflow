from uuid import UUID

from sqlalchemy import Column, ForeignKey, String, Table, Uuid, delete, func, select
from sqlalchemy.dialects.postgresql import JSONB, insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.application.contracts.student_cards import LessonCard
from app.shared.infrastructure.db.base import metadata

from ..domain.calendar import Calendar

lesson_calendars = Table(
    "lesson_calendars",
    metadata,
    Column("card_id", Uuid, ForeignKey("student_cards.student_card_id"), primary_key=True),
    Column("teacher_id", Uuid, ForeignKey("accounts.account_id"), nullable=False, index=True),
    Column("payload", JSONB, nullable=False),
)

lesson_calendar_refs = Table(
    "lesson_calendar_refs",
    metadata,
    Column("record_id", Uuid, primary_key=True),
    Column("kind", String(16), nullable=False),
    Column(
        "card_id",
        Uuid,
        ForeignKey("lesson_calendars.card_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
)


class PostgresCalendars:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def lock_teacher(self, teacher_id: UUID) -> None:
        key = int.from_bytes(teacher_id.bytes[:8], signed=True)
        await self.db.execute(select(func.pg_advisory_xact_lock(key)))

    async def load(self, card_id: UUID) -> Calendar:
        payload = await self.db.scalar(
            select(lesson_calendars.c.payload).where(lesson_calendars.c.card_id == card_id)
        )
        return Calendar(str(card_id), **(payload or {}))

    async def for_teacher(self, teacher_id: UUID) -> list[Calendar]:
        rows = await self.db.execute(
            select(lesson_calendars.c.card_id, lesson_calendars.c.payload).where(
                lesson_calendars.c.teacher_id == teacher_id
            )
        )
        return [Calendar(str(row.card_id), **row.payload) for row in rows]

    async def locate(self, record_id: str, kind: str) -> UUID | None:
        return await self.db.scalar(
            select(lesson_calendar_refs.c.card_id).where(
                lesson_calendar_refs.c.record_id == UUID(record_id),
                lesson_calendar_refs.c.kind == kind,
            )
        )

    async def save(self, card: LessonCard, calendar: Calendar) -> None:
        payload = calendar.data()
        await self.db.execute(
            insert(lesson_calendars)
            .values(card_id=card.card_id, teacher_id=card.teacher_id, payload=payload)
            .on_conflict_do_update(
                index_elements=[lesson_calendars.c.card_id], set_={"payload": payload}
            )
        )
        refs = (
            {lesson["lesson_id"]: "lesson" for lesson in calendar.all_lessons()}
            | dict.fromkeys(calendar.series, "series")
            | dict.fromkeys(calendar.requests, "request")
            | dict.fromkeys(calendar.notices, "notice")
        )
        ids = [UUID(record_id) for record_id in refs]
        await self.db.execute(
            delete(lesson_calendar_refs).where(
                lesson_calendar_refs.c.card_id == card.card_id,
                lesson_calendar_refs.c.record_id.not_in(ids),
            )
        )
        if refs:
            await self.db.execute(
                insert(lesson_calendar_refs)
                .values(
                    [
                        {"record_id": UUID(record_id), "card_id": card.card_id, "kind": kind}
                        for record_id, kind in refs.items()
                    ]
                )
                .on_conflict_do_nothing()
            )

    async def has_open_lessons(self, card_id: UUID) -> bool:
        calendar = await self.load(card_id)
        return any(lesson["status"] == "scheduled" for lesson in calendar.all_lessons())
