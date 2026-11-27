"""Хранение запросов изменения урока с единственным открытым запросом на участие."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKeyConstraint,
    Index,
    String,
    select,
    text,
    update,
)
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.modules.scheduling.domain.change_requests import (
    ChangeKind,
    ChangeState,
    LessonChangeRequest,
)
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.infrastructure.persistence.lesson_models import LessonsBase


class LessonChangeRequestRow(LessonsBase):
    __tablename__ = "scheduling_change_requests"
    __table_args__ = (
        ForeignKeyConstraint(
            ["lesson_id", "card_id"],
            ["scheduling_lesson_participants.lesson_id", "scheduling_lesson_participants.card_id"],
            ondelete="CASCADE",
        ),
        CheckConstraint("lesson_version > 0", name="ck_change_request_version"),
        CheckConstraint("kind IN ('cancel', 'reschedule')", name="ck_change_request_kind"),
        CheckConstraint(
            "kind = 'reschedule' OR proposed_start IS NULL", name="ck_change_request_time"
        ),
        CheckConstraint(
            "state IN ('pending', 'accepted', 'rejected', 'withdrawn', 'superseded')",
            name="ck_change_request_state",
        ),
        Index(
            "uq_change_request_pending",
            "lesson_id",
            "card_id",
            unique=True,
            postgresql_where=text("state = 'pending'"),
        ),
        Index("ix_change_request_listing", "lesson_id", "created_at", "id"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    lesson_id: Mapped[UUID] = mapped_column()
    card_id: Mapped[UUID] = mapped_column()
    author_id: Mapped[UUID] = mapped_column()
    lesson_version: Mapped[int] = mapped_column()
    kind: Mapped[str] = mapped_column(String(16))
    reason: Mapped[str | None] = mapped_column(String(4000))
    proposed_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    state: Mapped[str] = mapped_column(String(16))
    decided_by: Mapped[UUID | None] = mapped_column()
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


def request_value(row: LessonChangeRequestRow) -> LessonChangeRequest:
    return LessonChangeRequest(
        row.id,
        row.lesson_id,
        row.card_id,
        row.author_id,
        row.lesson_version,
        ChangeKind(row.kind),
        row.reason,
        row.proposed_start,
        row.created_at,
        ChangeState(row.state),
        row.decided_by,
        row.decided_at,
    )


class PostgresChangeRequests:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def add(self, request: LessonChangeRequest) -> None:
        values = {name: getattr(request, name) for name in LessonChangeRequest.__dataclass_fields__}
        result = await self.db.scalar(
            insert(LessonChangeRequestRow)
            .values(**values)
            .on_conflict_do_nothing()
            .returning(LessonChangeRequestRow.id)
        )

        if result is None:
            raise LessonError("lesson_change_request_conflict")

    async def find(self, lesson_id: UUID, request_id: UUID) -> LessonChangeRequest | None:
        row = await self.db.scalar(
            select(LessonChangeRequestRow)
            .where(
                LessonChangeRequestRow.id == request_id,
                LessonChangeRequestRow.lesson_id == lesson_id,
            )
            .execution_options(populate_existing=True)
        )

        return request_value(row) if row is not None else None

    async def list_for_lesson(
        self, lesson_id: UUID, card_id: UUID | None, after_id: UUID | None, limit: int
    ) -> list[LessonChangeRequest]:
        query = select(LessonChangeRequestRow).where(LessonChangeRequestRow.lesson_id == lesson_id)

        if card_id is not None:
            query = query.where(LessonChangeRequestRow.card_id == card_id)

        if after_id is not None:
            query = query.where(LessonChangeRequestRow.id > after_id)

        rows = await self.db.scalars(query.order_by(LessonChangeRequestRow.id).limit(limit))

        return [request_value(row) for row in rows]

    async def save(self, request: LessonChangeRequest) -> None:
        await self.db.execute(
            update(LessonChangeRequestRow)
            .where(
                LessonChangeRequestRow.id == request.id,
            )
            .values(
                state=request.state, decided_by=request.decided_by, decided_at=request.decided_at
            )
        )

    async def supersede(self, lesson_id: UUID, version: int) -> None:
        await self.db.execute(
            update(LessonChangeRequestRow)
            .where(
                LessonChangeRequestRow.lesson_id == lesson_id,
                LessonChangeRequestRow.lesson_version != version,
                LessonChangeRequestRow.state == ChangeState.PENDING,
            )
            .values(state=ChangeState.SUPERSEDED)
        )
