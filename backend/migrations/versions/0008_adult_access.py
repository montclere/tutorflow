"""Ограниченные подключения и независимые приглашения взрослых."""

import sqlalchemy as sa
from alembic import op


revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "students_adult_connections",
        sa.Column("card_id", sa.Uuid(), primary_key=True),
        sa.Column(
            "account_id",
            sa.Uuid(),
            sa.ForeignKey("identity_accounts.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("teacher_id", sa.Uuid(), nullable=False),
        sa.Column("slot", sa.SmallInteger(), nullable=False),
        sa.ForeignKeyConstraint(
            ["card_id", "teacher_id"],
            ["students_cards.id", "students_cards.teacher_id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("card_id", "slot", name="uq_adult_connection_slot"),
        sa.CheckConstraint("slot BETWEEN 1 AND 2", name="ck_adult_connection_slot"),
    )
    op.create_index(
        "ix_adult_connection_listing", "students_adult_connections", ["account_id", "card_id"]
    )
    op.create_table(
        "students_adult_invitations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "card_id",
            sa.Uuid(),
            sa.ForeignKey("students_cards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("slot", sa.SmallInteger(), nullable=False),
        sa.Column("token_digest", sa.String(64), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("welcome", sa.String(2000)),
        sa.UniqueConstraint("card_id", "slot", name="uq_adult_invitation_slot"),
        sa.CheckConstraint("slot BETWEEN 1 AND 2", name="ck_adult_invitation_slot"),
        sa.CheckConstraint("expires_at > created_at", name="ck_adult_invitation_expiry"),
    )


def downgrade() -> None:
    op.drop_table("students_adult_invitations")
    op.drop_table("students_adult_connections")
