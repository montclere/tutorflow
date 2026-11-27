"""Таблицы версий серий, календарных экземпляров и индивидуальных исключений."""

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Identity,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.shared.infrastructure.database import metadata


class SeriesBase(DeclarativeBase):
    metadata = metadata


class SeriesRow(SeriesBase):
    __tablename__ = "scheduling_series"
    __table_args__ = (
        UniqueConstraint("teacher_id", "request_id", name="uq_series_request"),
        CheckConstraint("version > 0", name="ck_series_version"),
        Index("ix_series_owner_listing", "teacher_id", "id"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    teacher_id: Mapped[UUID] = mapped_column(ForeignKey("identity_accounts.id", ondelete="CASCADE"))
    version: Mapped[int] = mapped_column(Integer)
    request_id: Mapped[UUID | None] = mapped_column()
    fingerprint: Mapped[str] = mapped_column(String(64))
    snapshot: Mapped[dict] = mapped_column(JSONB)


class SeriesMemberRow(SeriesBase):
    __tablename__ = "scheduling_series_members"
    __table_args__ = (Index("ix_series_member_card", "card_id", "series_id"),)
    series_id: Mapped[UUID] = mapped_column(
        ForeignKey("scheduling_series.id", ondelete="CASCADE"), primary_key=True
    )
    card_id: Mapped[UUID] = mapped_column(primary_key=True)


class SeriesOccurrenceRow(SeriesBase):
    __tablename__ = "scheduling_series_occurrences"
    __table_args__ = (
        UniqueConstraint("series_id", "segment_id", "local_date", name="uq_series_occurrence_date"),
        Index(
            "ix_series_occurrence_date",
            "series_id",
            "local_date",
            postgresql_where=text("NOT retired"),
        ),
        CheckConstraint("NOT (retired AND suppressed)", name="ck_series_occurrence_retirement"),
    )
    lesson_id: Mapped[UUID] = mapped_column(
        ForeignKey("scheduling_lessons.id", ondelete="CASCADE"), primary_key=True
    )
    series_id: Mapped[UUID] = mapped_column(ForeignKey("scheduling_series.id", ondelete="CASCADE"))
    segment_id: Mapped[UUID] = mapped_column()
    local_date: Mapped[date] = mapped_column(Date)
    customized: Mapped[bool] = mapped_column(server_default="false")
    suppressed: Mapped[bool] = mapped_column(server_default="false")
    retired: Mapped[bool] = mapped_column(server_default="false")


class SeriesResponseOverrideRow(SeriesBase):
    __tablename__ = "scheduling_series_response_overrides"
    __table_args__ = (
        ForeignKeyConstraint(
            ["lesson_id", "card_id"],
            ["scheduling_lesson_participants.lesson_id", "scheduling_lesson_participants.card_id"],
            ondelete="CASCADE",
        ),
    )
    lesson_id: Mapped[UUID] = mapped_column(primary_key=True)
    card_id: Mapped[UUID] = mapped_column(primary_key=True)


class SeriesRevisionRow(SeriesBase):
    __tablename__ = "scheduling_series_revisions"
    __table_args__ = (
        UniqueConstraint("sequence", name="uq_series_revision_sequence"),
        CheckConstraint(
            "kind IN ('created', 'updated', 'paused', 'resumed', 'deleted', 'reply')",
            name="ck_series_revision_kind",
        ),
        Index("ix_series_history", "series_id", "sequence"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    sequence: Mapped[int] = mapped_column(BigInteger, Identity())
    series_id: Mapped[UUID] = mapped_column(ForeignKey("scheduling_series.id", ondelete="CASCADE"))
    actor_id: Mapped[UUID] = mapped_column()
    happened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    kind: Mapped[str] = mapped_column(String(20))
    snapshot: Mapped[dict] = mapped_column(JSONB)
