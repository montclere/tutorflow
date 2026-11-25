"""SQLAlchemy-модели таблиц, которыми владеет Identity."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.shared.infrastructure.database import metadata


class IdentityBase(DeclarativeBase):
    metadata = metadata


class Account(IdentityBase):
    __tablename__ = "identity_accounts"
    __table_args__ = (
        UniqueConstraint("contact_kind", "contact", name="uq_identity_account_contact"),
        CheckConstraint("role IN ('teacher', 'student', 'adult')", name="ck_identity_account_role"),
        CheckConstraint(
            "contact_kind IN ('email', 'phone')", name="ck_identity_account_contact_kind"
        ),
        CheckConstraint("length(trim(contact)) > 0", name="ck_identity_account_contact_present"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    contact_kind: Mapped[str] = mapped_column(String(5))
    contact: Mapped[str] = mapped_column(String(254))
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(10))
    display_name: Mapped[str | None] = mapped_column(String(120))
    timezone: Mapped[str | None] = mapped_column(String(80))


class Registration(IdentityBase):
    __tablename__ = "identity_registrations"
    __table_args__ = (
        CheckConstraint(
            "contact_kind IN ('email', 'phone')", name="ck_identity_registration_contact_kind"
        ),
        CheckConstraint(
            "length(trim(contact)) > 0", name="ck_identity_registration_contact_present"
        ),
        CheckConstraint(
            "remaining_attempts >= 0", name="ck_identity_registration_remaining_attempts"
        ),
        CheckConstraint(
            "delivery_attempts >= 0", name="ck_identity_registration_delivery_attempts"
        ),
        CheckConstraint("expires_at > sent_at", name="ck_identity_registration_expiry"),
    )
    contact_kind: Mapped[str] = mapped_column(String(5), primary_key=True)
    contact: Mapped[str] = mapped_column(String(254), primary_key=True)
    id: Mapped[UUID] = mapped_column(unique=True)
    code_digest: Mapped[str] = mapped_column(String(64))
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    remaining_attempts: Mapped[int] = mapped_column(Integer)
    delivery_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    delivery_attempts: Mapped[int] = mapped_column(Integer, server_default="0")


class LoginSession(IdentityBase):
    __tablename__ = "identity_sessions"
    token_digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    account_id: Mapped[UUID] = mapped_column(
        ForeignKey("identity_accounts.id", ondelete="CASCADE"), index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class RateWindow(IdentityBase):
    __tablename__ = "identity_rate_windows"
    __table_args__ = (CheckConstraint("attempts > 0", name="ck_identity_rate_window_attempts"),)
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    reset_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    attempts: Mapped[int] = mapped_column(Integer)
