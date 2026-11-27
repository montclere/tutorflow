"""Регулярные серии, календарные экземпляры и история версий."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scheduling_series",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("teacher_id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=True),
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.Column("snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.CheckConstraint("version > 0", name="ck_series_version"),
        sa.ForeignKeyConstraint(["teacher_id"], ["identity_accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("teacher_id", "request_id", name="uq_series_request"),
    )
    op.create_index(
        "ix_series_owner_listing", "scheduling_series", ["teacher_id", "id"], unique=False
    )
    op.create_table(
        "scheduling_series_members",
        sa.Column("series_id", sa.Uuid(), nullable=False),
        sa.Column("card_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["series_id"], ["scheduling_series.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("series_id", "card_id"),
    )
    op.create_index(
        "ix_series_member_card", "scheduling_series_members", ["card_id", "series_id"], unique=False
    )
    op.create_table(
        "scheduling_series_occurrences",
        sa.Column("lesson_id", sa.Uuid(), nullable=False),
        sa.Column("series_id", sa.Uuid(), nullable=False),
        sa.Column("segment_id", sa.Uuid(), nullable=False),
        sa.Column("local_date", sa.Date(), nullable=False),
        sa.Column("customized", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("suppressed", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("retired", sa.Boolean(), server_default="false", nullable=False),
        sa.CheckConstraint("NOT (retired AND suppressed)", name="ck_series_occurrence_retirement"),
        sa.ForeignKeyConstraint(["lesson_id"], ["scheduling_lessons.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["series_id"], ["scheduling_series.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("lesson_id"),
        sa.UniqueConstraint(
            "series_id", "segment_id", "local_date", name="uq_series_occurrence_date"
        ),
    )
    op.create_index(
        "ix_series_occurrence_date",
        "scheduling_series_occurrences",
        ["series_id", "local_date"],
        unique=False,
        postgresql_where=sa.text("NOT retired"),
    )
    op.create_table(
        "scheduling_series_revisions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("sequence", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("series_id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("happened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.CheckConstraint(
            "kind IN ('created', 'updated', 'paused', 'resumed', 'deleted', 'reply')",
            name="ck_series_revision_kind",
        ),
        sa.ForeignKeyConstraint(["series_id"], ["scheduling_series.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sequence", name="uq_series_revision_sequence"),
    )
    op.create_index(
        "ix_series_history", "scheduling_series_revisions", ["series_id", "sequence"], unique=False
    )
    op.create_table(
        "scheduling_series_response_overrides",
        sa.Column("lesson_id", sa.Uuid(), nullable=False),
        sa.Column("card_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["lesson_id", "card_id"],
            ["scheduling_lesson_participants.lesson_id", "scheduling_lesson_participants.card_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("lesson_id", "card_id"),
    )


def downgrade() -> None:
    op.drop_table("scheduling_series_response_overrides")
    op.drop_index("ix_series_history", table_name="scheduling_series_revisions")
    op.drop_table("scheduling_series_revisions")
    op.drop_index(
        "ix_series_occurrence_date",
        table_name="scheduling_series_occurrences",
        postgresql_where=sa.text("NOT retired"),
    )
    op.drop_table("scheduling_series_occurrences")
    op.drop_index("ix_series_member_card", table_name="scheduling_series_members")
    op.drop_table("scheduling_series_members")
    op.drop_index("ix_series_owner_listing", table_name="scheduling_series")
    op.drop_table("scheduling_series")
