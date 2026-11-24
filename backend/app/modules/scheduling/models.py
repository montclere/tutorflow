from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Index, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class SchedulingBase(DeclarativeBase):
    """Метаданные таблиц расписания."""


class CalendarBlock(SchedulingBase):
    __tablename__ = "scheduling_calendar_blocks"
    __table_args__ = (
        Index("ix_scheduling_blocks_owner_start", "owner_id", "starts_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True)
    owner_id: Mapped[UUID]
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    timezone: Mapped[str] = mapped_column(String(80))
    duration_minutes: Mapped[int]
