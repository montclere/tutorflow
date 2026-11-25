"""SQLAlchemy-модель личного календарного блока."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.shared.infrastructure.database import metadata


class SchedulingBase(DeclarativeBase):
    metadata = metadata


class CalendarBlock(SchedulingBase):
    __tablename__ = "scheduling_calendar_blocks"
    __table_args__ = (
        CheckConstraint("duration_minutes BETWEEN 5 AND 480", name="ck_scheduling_blocks_duration"),
        Index("ix_scheduling_blocks_owner_start_id", "owner_id", "starts_at", "id"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    owner_id: Mapped[UUID] = mapped_column(
        ForeignKey("identity_accounts.id", ondelete="CASCADE", name="fk_scheduling_blocks_owner")
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    timezone: Mapped[str] = mapped_column(String(80))
    duration_minutes: Mapped[int]


class BlockRequest(SchedulingBase):
    __tablename__ = "scheduling_block_requests"
    id: Mapped[UUID] = mapped_column(primary_key=True)
    owner_id: Mapped[UUID] = mapped_column(
        ForeignKey("identity_accounts.id", ondelete="CASCADE", name="fk_scheduling_requests_owner"),
        index=True,
    )
    fingerprint: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), index=True, server_default=text("now() + interval '7 days'")
    )
