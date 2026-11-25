"""Таблицы аккаунтов, регистрации и сессий Identity."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "identity_accounts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("contact_kind", sa.String(length=5), nullable=False),
        sa.Column("contact", sa.String(length=254), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=10), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=True),
        sa.Column("timezone", sa.String(length=80), nullable=True),
        sa.CheckConstraint(
            "role IN ('teacher', 'student', 'adult')", name="ck_identity_account_role"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("contact_kind", "contact", name="uq_identity_account_contact"),
    )
    op.create_table(
        "identity_rate_windows",
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("reset_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )
    op.create_table(
        "identity_registrations",
        sa.Column("contact_kind", sa.String(length=5), nullable=False),
        sa.Column("contact", sa.String(length=254), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code_digest", sa.String(length=64), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("remaining_attempts", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("contact_kind", "contact"),
        sa.UniqueConstraint("id"),
    )
    op.create_table(
        "identity_sessions",
        sa.Column("token_digest", sa.String(length=64), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["identity_accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("token_digest"),
    )
    op.create_index(
        op.f("ix_identity_sessions_expires_at"), "identity_sessions", ["expires_at"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_identity_sessions_expires_at"), table_name="identity_sessions")
    op.drop_table("identity_sessions")
    op.drop_table("identity_registrations")
    op.drop_table("identity_rate_windows")
    op.drop_table("identity_accounts")
