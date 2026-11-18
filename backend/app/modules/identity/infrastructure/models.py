from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    UniqueConstraint,
    Uuid,
)

from app.shared.infrastructure.db.base import metadata

accounts = Table(
    "accounts",
    metadata,
    Column("account_id", Uuid, primary_key=True),
    Column("status", String(16), nullable=False),
    Column("login_contact_type", String(8), nullable=False),
    Column("normalized_login_contact", String(320), nullable=False),
    Column("login_contact_verified_at", DateTime(timezone=True), nullable=False),
    Column("password_hash", String(255), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
    UniqueConstraint("login_contact_type", "normalized_login_contact"),
    CheckConstraint("login_contact_type IN ('email', 'phone')", name="contact_type"),
    CheckConstraint("status IN ('active', 'inactive')", name="status"),
)
profiles = Table(
    "account_profiles",
    metadata,
    Column("account_id", Uuid, ForeignKey("accounts.account_id"), primary_key=True),
    Column("display_name", String(80), nullable=False),
    Column("timezone", String(64), nullable=False),
    Column("version", Integer, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)
teacher_cabinets = Table(
    "teacher_cabinets",
    metadata,
    Column("account_id", Uuid, ForeignKey("accounts.account_id"), primary_key=True),
    Column("enabled_at", DateTime(timezone=True), nullable=False),
)
sessions = Table(
    "sessions",
    metadata,
    Column("session_id", Uuid, primary_key=True),
    Column("account_id", Uuid, ForeignKey("accounts.account_id"), index=True),
    Column("token_digest", String(64), unique=True, nullable=False),
    Column("csrf_token", String(64), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("last_seen_at", DateTime(timezone=True), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False, index=True),
    Column("revoked_at", DateTime(timezone=True)),
)
challenges = Table(
    "contact_challenges",
    metadata,
    Column("challenge_id", Uuid, primary_key=True),
    Column("contact_type", String(8), nullable=False),
    Column("contact", String(320), nullable=False),
    Column("purpose", String(16), nullable=False),
    Column("code_digest", String(64), nullable=False),
    Column("invitation_digest", String(64)),
    Column("expires_at", DateTime(timezone=True), nullable=False, index=True),
    Column("consumed_at", DateTime(timezone=True)),
    Column("account_id", Uuid, ForeignKey("accounts.account_id")),
    Column("failed_attempts", Integer, nullable=False),
    CheckConstraint("purpose IN ('registration', 'password_reset')", name="purpose"),
)
