"""Таблицы карточек, профилей, приглашений и связей Students."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.shared.infrastructure.database import metadata


class StudentsBase(DeclarativeBase):
    metadata = metadata


class StudentCard(StudentsBase):
    __tablename__ = "students_cards"
    __table_args__ = (
        UniqueConstraint("id", "teacher_id", name="uq_students_card_owner"),
        CheckConstraint("length(trim(name)) > 0", name="ck_students_card_name"),
        Index("ix_students_card_listing", "teacher_id", "archived", "id"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    teacher_id: Mapped[UUID] = mapped_column(ForeignKey("identity_accounts.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(120))
    notes: Mapped[str | None] = mapped_column(String(4000))
    archived: Mapped[bool] = mapped_column(Boolean, server_default="false")


class LearningProfile(StudentsBase):
    __tablename__ = "students_learning_profiles"
    __table_args__ = (
        CheckConstraint(
            "amount >= 0 AND amount <> 'NaN'::numeric", name="ck_students_profile_price"
        ),
        CheckConstraint("currency = 'RUB'", name="ck_students_profile_currency"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    card_id: Mapped[UUID] = mapped_column(
        ForeignKey("students_cards.id", ondelete="CASCADE"), index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), server_default="RUB")
    subject: Mapped[str | None] = mapped_column(String(4000))
    level: Mapped[str | None] = mapped_column(String(4000))
    goal: Mapped[str | None] = mapped_column(String(4000))
    duration: Mapped[str | None] = mapped_column(String(4000))
    description: Mapped[str | None] = mapped_column(String(4000))


class Invitation(StudentsBase):
    __tablename__ = "students_invitations"
    __table_args__ = (
        CheckConstraint("expires_at > created_at", name="ck_students_invitation_expiry"),
    )
    card_id: Mapped[UUID] = mapped_column(
        ForeignKey("students_cards.id", ondelete="CASCADE"), primary_key=True
    )
    id: Mapped[UUID] = mapped_column(unique=True)
    token_digest: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    welcome: Mapped[str | None] = mapped_column(String(2000))
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Connection(StudentsBase):
    __tablename__ = "students_connections"
    __table_args__ = (
        ForeignKeyConstraint(
            ["card_id", "teacher_id"],
            ["students_cards.id", "students_cards.teacher_id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["account_id", "role"],
            ["identity_account_roles.account_id", "identity_account_roles.role"],
            ondelete="CASCADE",
            name="fk_card_connection_role",
        ),
        UniqueConstraint("card_id", "slot", name="uq_card_connection_slot"),
        CheckConstraint(
            "(role = 'student' AND slot = 0 AND account_id <> teacher_id) OR (role = 'adult' "
            "AND slot BETWEEN 1 AND 2)",
            name="ck_card_connection_role_slot",
        ),
        Index(
            "uq_students_teacher_account",
            "teacher_id",
            "account_id",
            unique=True,
            postgresql_where=text("role = 'student'"),
        ),
        Index("ix_students_connection_listing", "account_id", "card_id"),
    )
    card_id: Mapped[UUID] = mapped_column(primary_key=True)
    teacher_id: Mapped[UUID] = mapped_column()
    account_id: Mapped[UUID] = mapped_column(
        ForeignKey("identity_accounts.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String(10), server_default="student")
    slot: Mapped[int] = mapped_column(SmallInteger, server_default="0")
