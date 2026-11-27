"""Публикации свободного времени, резервы записи и собственные часы ученика."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.modules.scheduling.infrastructure.persistence.lesson_models import LessonsBase


class AvailabilityRow(LessonsBase):
    __tablename__ = "scheduling_availability"
    __table_args__ = (
        CheckConstraint("version > 0", name="ck_availability_version"),
        UniqueConstraint("id", "teacher_id", name="uq_availability_owner"),
        Index("ix_availability_owner", "teacher_id", "id"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    teacher_id: Mapped[UUID] = mapped_column(ForeignKey("identity_accounts.id", ondelete="CASCADE"))
    version: Mapped[int] = mapped_column()
    active: Mapped[bool] = mapped_column()
    snapshot: Mapped[dict] = mapped_column(JSONB)


class BookingRow(LessonsBase):
    __tablename__ = "scheduling_bookings"
    __table_args__ = (
        UniqueConstraint("teacher_id", "card_id", "request_id", name="uq_booking_request"),
        ForeignKeyConstraint(
            ["publication_id", "teacher_id"],
            ["scheduling_availability.id", "scheduling_availability.teacher_id"],
            name="fk_booking_publication_owner",
        ),
        ForeignKeyConstraint(
            ["lesson_id", "teacher_id"],
            ["scheduling_lessons.id", "scheduling_lessons.teacher_id"],
            name="fk_booking_lesson_owner",
        ),
        CheckConstraint(
            "ends_at > starts_at AND expires_at <= starts_at AND expires_at > created_at",
            name="ck_booking_time",
        ),
        CheckConstraint(
            "break_minutes >= 0 AND publication_version > 0", name="ck_booking_conditions"
        ),
        CheckConstraint(
            "state IN ('pending', 'accepted', 'rejected', 'withdrawn', 'expired', 'invalidated')",
            name="ck_booking_state",
        ),
        CheckConstraint("(state = 'accepted') = (lesson_id IS NOT NULL)", name="ck_booking_lesson"),
        Index(
            "uq_booking_pending_card",
            "teacher_id",
            "card_id",
            unique=True,
            postgresql_where=text("state = 'pending'"),
        ),
        Index("ix_booking_owner_time", "teacher_id", "starts_at", "ends_at"),
        Index("ix_booking_card_list", "teacher_id", "card_id", "id"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    request_id: Mapped[UUID] = mapped_column()
    publication_id: Mapped[UUID] = mapped_column()
    publication_version: Mapped[int] = mapped_column()
    teacher_id: Mapped[UUID] = mapped_column(ForeignKey("identity_accounts.id", ondelete="CASCADE"))
    card_id: Mapped[UUID] = mapped_column()
    actor_id: Mapped[UUID] = mapped_column()
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    break_minutes: Mapped[int] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    state: Mapped[str] = mapped_column(String(16))
    lesson_id: Mapped[UUID | None] = mapped_column()
    decided_by: Mapped[UUID | None] = mapped_column()
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class StudentHoursRow(LessonsBase):
    __tablename__ = "scheduling_student_hours"
    __table_args__ = (CheckConstraint("version > 0", name="ck_student_hours_version"),)
    card_id: Mapped[UUID] = mapped_column(
        ForeignKey("students_cards.id", ondelete="CASCADE"), primary_key=True
    )
    version: Mapped[int] = mapped_column()
    snapshot: Mapped[dict] = mapped_column(JSONB)
