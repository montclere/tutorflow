"""Таблицы самостоятельных занятий, ответов, настроек и неизменяемой истории."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.shared.infrastructure.database import metadata


class LessonsBase(DeclarativeBase):
    metadata = metadata


class LessonRow(LessonsBase):
    __tablename__ = "scheduling_lessons"
    __table_args__ = (
        UniqueConstraint("teacher_id", "request_id", name="uq_lesson_creation_request"),
        CheckConstraint("duration_minutes > 0", name="ck_lesson_duration"),
        CheckConstraint("version > 0", name="ck_lesson_version"),
        CheckConstraint("outcome IN ('unrecorded', 'held', 'not_held')", name="ck_lesson_outcome"),
        Index(
            "ix_lesson_group_time",
            "teacher_id",
            "group_id",
            "starts_at",
            "id",
            postgresql_where=text("NOT deleted"),
        ),
        CheckConstraint(
            "(group_id IS NULL) = (group_name IS NULL)", name="ck_lesson_group_snapshot"
        ),
        Index(
            "ix_lesson_owner_time",
            "teacher_id",
            "starts_at",
            "id",
            postgresql_where=text("NOT deleted"),
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    teacher_id: Mapped[UUID] = mapped_column(ForeignKey("identity_accounts.id", ondelete="CASCADE"))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    timezone: Mapped[str] = mapped_column(String(80))
    duration_minutes: Mapped[int] = mapped_column()
    title: Mapped[str | None] = mapped_column(String(200))
    subject: Mapped[str | None] = mapped_column(String(4000))
    delivery_format: Mapped[str | None] = mapped_column(String(4000))
    private_notes: Mapped[str | None] = mapped_column(String(4000))
    group_id: Mapped[UUID | None] = mapped_column()
    group_name: Mapped[str | None] = mapped_column(String(120))
    confirmation: Mapped[bool] = mapped_column(Boolean, server_default="false")
    version: Mapped[int] = mapped_column(Integer, server_default="1")
    deleted: Mapped[bool] = mapped_column(Boolean, server_default="false")
    cancelled: Mapped[bool] = mapped_column(Boolean, server_default="false")
    cancellation_reason: Mapped[str | None] = mapped_column(String(4000))
    outcome: Mapped[str] = mapped_column(String(16), server_default="unrecorded")
    completion_notes: Mapped[str | None] = mapped_column(String(4000))
    request_id: Mapped[UUID | None] = mapped_column()
    fingerprint: Mapped[str] = mapped_column(String(64))


class LessonParticipantRow(LessonsBase):
    __tablename__ = "scheduling_lesson_participants"
    __table_args__ = (
        CheckConstraint(
            "amount >= 0 AND amount <> 'NaN'::numeric", name="ck_lesson_participant_price"
        ),
        CheckConstraint(
            "(state = 'not_required' AND deadline IS NULL AND response_by IS NULL "
            "AND replied_at IS NULL) OR "
            "(state = 'pending' AND deadline IS NOT NULL AND response_by IS NULL AND "
            "replied_at IS NULL) OR "
            "(state IN ('accepted', 'declined') AND deadline IS NOT NULL AND "
            "response_by IS NOT NULL AND replied_at IS NOT NULL)",
            name="ck_lesson_participant_response",
        ),
        Index("ix_lesson_card_listing", "card_id", "lesson_id"),
        CheckConstraint(
            "attendance IN ('unmarked', 'present', 'absent')", name="ck_lesson_attendance"
        ),
    )
    lesson_id: Mapped[UUID] = mapped_column(
        ForeignKey("scheduling_lessons.id", ondelete="CASCADE"), primary_key=True
    )
    card_id: Mapped[UUID] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    profile_id: Mapped[UUID | None] = mapped_column()
    profile_subject: Mapped[str | None] = mapped_column(String(4000))
    state: Mapped[str] = mapped_column(String(16))
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    response_by: Mapped[UUID | None] = mapped_column()
    replied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled: Mapped[bool] = mapped_column(Boolean, server_default="false")
    cancellation_reason: Mapped[str | None] = mapped_column(String(4000))
    attendance: Mapped[str] = mapped_column(String(16), server_default="unmarked")


class LessonRevisionRow(LessonsBase):
    __tablename__ = "scheduling_lesson_revisions"
    __table_args__ = (
        UniqueConstraint("sequence", name="uq_lesson_revision_sequence"),
        CheckConstraint("schema_version = 1", name="ck_lesson_revision_schema"),
        CheckConstraint(
            "kind IN ('created', 'updated', 'deleted', 'reply', "
            "'cancelled', 'restored', 'completed')",
            name="ck_lesson_revision_kind",
        ),
        Index("ix_lesson_revision_history", "lesson_id", "sequence"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    sequence: Mapped[int] = mapped_column(BigInteger, Identity())
    lesson_id: Mapped[UUID] = mapped_column(ForeignKey("scheduling_lessons.id", ondelete="CASCADE"))
    actor_id: Mapped[UUID] = mapped_column()
    happened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    kind: Mapped[str] = mapped_column(String(20))
    schema_version: Mapped[int] = mapped_column(Integer, server_default="1")
    snapshot: Mapped[dict] = mapped_column(JSONB)


class TeachingPreferencesRow(LessonsBase):
    __tablename__ = "scheduling_teaching_preferences"
    __table_args__ = (
        CheckConstraint(
            "amount >= 0 AND amount <> 'NaN'::numeric", name="ck_teaching_default_price"
        ),
        CheckConstraint("duration_minutes > 0", name="ck_teaching_default_duration"),
    )
    teacher_id: Mapped[UUID] = mapped_column(
        ForeignKey("identity_accounts.id", ondelete="CASCADE"), primary_key=True
    )
    amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    duration_minutes: Mapped[int | None] = mapped_column()
