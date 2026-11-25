"""Ограниченные слоты подключений и приглашений взрослых к карточкам."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    SmallInteger,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.shared.infrastructure.database import metadata


class AdultAccessBase(DeclarativeBase):
    metadata = metadata


class AdultConnection(AdultAccessBase):
    __tablename__ = "students_adult_connections"
    __table_args__ = (
        ForeignKeyConstraint(
            ["card_id", "teacher_id"],
            ["students_cards.id", "students_cards.teacher_id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("card_id", "slot", name="uq_adult_connection_slot"),
        CheckConstraint("slot BETWEEN 1 AND 2", name="ck_adult_connection_slot"),
        Index("ix_adult_connection_listing", "account_id", "card_id"),
    )
    card_id: Mapped[UUID] = mapped_column(primary_key=True)
    account_id: Mapped[UUID] = mapped_column(
        ForeignKey("identity_accounts.id", ondelete="CASCADE"), primary_key=True
    )
    teacher_id: Mapped[UUID] = mapped_column()
    slot: Mapped[int] = mapped_column(SmallInteger)


class AdultInvitation(AdultAccessBase):
    __tablename__ = "students_adult_invitations"
    __table_args__ = (
        UniqueConstraint("card_id", "slot", name="uq_adult_invitation_slot"),
        CheckConstraint("slot BETWEEN 1 AND 2", name="ck_adult_invitation_slot"),
        CheckConstraint("expires_at > created_at", name="ck_adult_invitation_expiry"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    card_id: Mapped[UUID] = mapped_column(ForeignKey("students_cards.id", ondelete="CASCADE"))
    slot: Mapped[int] = mapped_column(SmallInteger)
    token_digest: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    welcome: Mapped[str | None] = mapped_column(String(2000))
