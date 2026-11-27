"""PostgreSQL-публикации, резервы и занятость внутри общей транзакции календаря."""

from dataclasses import asdict
from datetime import datetime
from uuid import UUID

from sqlalchemy import literal, select, text, union_all, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.scheduling.application.availability_contracts import StudentHours
from app.modules.scheduling.domain.availability import AvailabilityPublication, BusyInterval
from app.modules.scheduling.domain.bookings import Booking, BookingState
from app.modules.scheduling.infrastructure.models import CalendarBlock
from app.modules.scheduling.infrastructure.persistence.availability_models import (
    AvailabilityRow,
    BookingRow,
    StudentHoursRow,
)
from app.modules.scheduling.infrastructure.persistence.availability_snapshots import (
    hours_snapshot,
    publication_snapshot,
    publication_value,
    window_value,
)
from app.modules.scheduling.infrastructure.persistence.lesson_models import LessonRow


def booking_value(row: BookingRow) -> Booking:
    return Booking(
        row.id,
        row.request_id,
        row.publication_id,
        row.publication_version,
        row.teacher_id,
        row.card_id,
        row.actor_id,
        row.starts_at,
        row.ends_at,
        row.break_minutes,
        row.created_at,
        row.expires_at,
        BookingState(row.state),
        row.lesson_id,
        row.decided_by,
        row.decided_at,
    )


class PostgresAvailabilityRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def find_publication(
        self, publication_id: UUID, teacher_id: UUID
    ) -> AvailabilityPublication | None:
        row = await self.db.scalar(
            select(AvailabilityRow)
            .where(AvailabilityRow.id == publication_id, AvailabilityRow.teacher_id == teacher_id)
            .execution_options(populate_existing=True)
        )

        return publication_value(row.snapshot) if row is not None else None

    async def publications(
        self, teacher_id: UUID, limit: int, after_id: UUID | None = None
    ) -> list[AvailabilityPublication]:
        query = select(AvailabilityRow).where(
            AvailabilityRow.teacher_id == teacher_id, AvailabilityRow.active.is_(True)
        )

        if after_id is not None:
            query = query.where(AvailabilityRow.id > after_id)

        rows = await self.db.scalars(query.order_by(AvailabilityRow.id).limit(limit))

        return [publication_value(row.snapshot) for row in rows]

    async def save_publication(self, publication: AvailabilityPublication) -> None:
        statement = insert(AvailabilityRow).values(
            id=publication.id,
            teacher_id=publication.teacher_id,
            version=publication.version,
            active=publication.active,
            snapshot=publication_snapshot(publication),
        )

        await self.db.execute(
            statement.on_conflict_do_update(
                index_elements=[AvailabilityRow.id],
                set_={
                    "version": statement.excluded.version,
                    "active": statement.excluded.active,
                    "snapshot": statement.excluded.snapshot,
                },
            )
        )

    async def invalidate(self, publication_id: UUID) -> None:
        await self.db.execute(
            update(BookingRow)
            .where(
                BookingRow.publication_id == publication_id,
                BookingRow.state == BookingState.PENDING,
            )
            .values(state=BookingState.INVALIDATED)
        )

    async def expire(self, teacher_id: UUID, now: datetime) -> None:
        await self.db.execute(
            update(BookingRow)
            .where(
                BookingRow.teacher_id == teacher_id,
                BookingRow.state == BookingState.PENDING,
                BookingRow.expires_at <= now,
            )
            .values(state=BookingState.EXPIRED)
        )

    async def find_booking(
        self, booking_id: UUID, teacher_id: UUID, card_id: UUID | None = None
    ) -> Booking | None:
        query = select(BookingRow).where(
            BookingRow.id == booking_id, BookingRow.teacher_id == teacher_id
        )

        if card_id is not None:
            query = query.where(BookingRow.card_id == card_id)

        row = await self.db.scalar(query.execution_options(populate_existing=True))

        return booking_value(row) if row is not None else None

    async def find_replay(
        self, teacher_id: UUID, card_id: UUID, request_id: UUID
    ) -> Booking | None:
        row = await self.db.scalar(
            select(BookingRow)
            .where(
                BookingRow.teacher_id == teacher_id,
                BookingRow.card_id == card_id,
                BookingRow.request_id == request_id,
            )
            .execution_options(populate_existing=True)
        )

        return booking_value(row) if row else None

    async def pending_for_card(self, teacher_id: UUID, card_id: UUID) -> bool:
        return (
            await self.db.scalar(
                select(BookingRow.id)
                .where(
                    BookingRow.teacher_id == teacher_id,
                    BookingRow.card_id == card_id,
                    BookingRow.state == BookingState.PENDING,
                )
                .limit(1)
            )
            is not None
        )

    async def bookings(
        self, teacher_id: UUID, card_id: UUID | None, after_id: UUID | None, limit: int
    ) -> list[Booking]:
        query = select(BookingRow).where(BookingRow.teacher_id == teacher_id)

        if card_id is not None:
            query = query.where(BookingRow.card_id == card_id)

        if after_id is not None:
            query = query.where(BookingRow.id > after_id)

        rows = await self.db.scalars(query.order_by(BookingRow.id).limit(limit))

        return [booking_value(row) for row in rows]

    async def save_booking(self, booking: Booking) -> None:
        statement = insert(BookingRow).values(**asdict(booking))

        await self.db.execute(
            statement.on_conflict_do_update(
                index_elements=[BookingRow.id],
                set_={
                    name: getattr(statement.excluded, name)
                    for name in ("state", "lesson_id", "decided_by", "decided_at")
                },
            )
        )

    async def busy(
        self,
        teacher_id: UUID,
        start: datetime,
        end: datetime,
        now: datetime,
        limit: int,
        exclude_booking: UUID | None = None,
        exclude_lesson: UUID | None = None,
    ) -> tuple[BusyInterval, ...]:
        lesson_end = LessonRow.starts_at + LessonRow.duration_minutes * text("interval '1 minute'")
        block_end = CalendarBlock.starts_at + CalendarBlock.duration_minutes * text(
            "interval '1 minute'"
        )
        lesson_conditions = [
            LessonRow.teacher_id == teacher_id,
            LessonRow.deleted.is_(False),
            LessonRow.cancelled.is_(False),
        ]

        if exclude_lesson is not None:
            lesson_conditions.append(LessonRow.id != exclude_lesson)

        lessons = select(
            LessonRow.starts_at.label("starts_at"),
            lesson_end.label("ends_at"),
            literal(0).label("gap"),
        ).where(*lesson_conditions, LessonRow.starts_at < end, lesson_end > start)
        blocks = select(
            CalendarBlock.starts_at.label("starts_at"),
            block_end.label("ends_at"),
            literal(0).label("gap"),
        ).where(
            CalendarBlock.owner_id == teacher_id, CalendarBlock.starts_at < end, block_end > start
        )
        pending = select(
            BookingRow.starts_at.label("starts_at"),
            BookingRow.ends_at.label("ends_at"),
            BookingRow.break_minutes.label("gap"),
        ).where(
            BookingRow.teacher_id == teacher_id,
            BookingRow.state == BookingState.PENDING,
            BookingRow.expires_at > now,
            BookingRow.starts_at - BookingRow.break_minutes * text("interval '1 minute'") < end,
            BookingRow.ends_at + BookingRow.break_minutes * text("interval '1 minute'") > start,
        )

        if exclude_booking is not None:
            pending = pending.where(BookingRow.id != exclude_booking)

        accepted = (
            select(
                LessonRow.starts_at.label("starts_at"),
                lesson_end.label("ends_at"),
                BookingRow.break_minutes.label("gap"),
            )
            .join(BookingRow, BookingRow.lesson_id == LessonRow.id)
            .where(
                *lesson_conditions,
                BookingRow.state == BookingState.ACCEPTED,
                LessonRow.starts_at - BookingRow.break_minutes * text("interval '1 minute'") < end,
                lesson_end + BookingRow.break_minutes * text("interval '1 minute'") > start,
            )
        )
        rows = await self.db.execute(
            union_all(lessons, blocks, pending, accepted).order_by("starts_at").limit(limit)
        )

        return tuple(BusyInterval(left, right, gap) for left, right, gap in rows)

    async def hours(self, card_id: UUID) -> StudentHours:
        row = await self.db.get(StudentHoursRow, card_id, populate_existing=True)

        return (
            StudentHours(
                card_id,
                row.version,
                tuple(window_value(window) for window in row.snapshot["free"]),
                tuple(window_value(window) for window in row.snapshot["busy"]),
            )
            if row
            else StudentHours(card_id)
        )

    async def save_hours(self, hours: StudentHours) -> None:
        statement = insert(StudentHoursRow).values(
            card_id=hours.card_id, version=hours.version, snapshot=hours_snapshot(hours)
        )

        await self.db.execute(
            statement.on_conflict_do_update(
                index_elements=[StudentHoursRow.card_id],
                set_={
                    "version": statement.excluded.version,
                    "snapshot": statement.excluded.snapshot,
                },
            )
        )
