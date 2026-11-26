"""Самостоятельные занятия, персональные ответы и история снимков."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scheduling_lessons",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("teacher_id", sa.Uuid(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("timezone", sa.String(length=80), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("subject", sa.String(length=4000), nullable=True),
        sa.Column("delivery_format", sa.String(length=4000), nullable=True),
        sa.Column("private_notes", sa.String(length=4000), nullable=True),
        sa.Column("group_id", sa.Uuid(), nullable=True),
        sa.Column("group_name", sa.String(length=120), nullable=True),
        sa.Column("confirmation", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("deleted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=True),
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.CheckConstraint(
            "(group_id IS NULL) = (group_name IS NULL)", name="ck_lesson_group_snapshot"
        ),
        sa.CheckConstraint("duration_minutes > 0", name="ck_lesson_duration"),
        sa.CheckConstraint("version > 0", name="ck_lesson_version"),
        sa.ForeignKeyConstraint(["teacher_id"], ["identity_accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("teacher_id", "request_id", name="uq_lesson_creation_request"),
    )
    op.create_index(
        "ix_lesson_owner_time",
        "scheduling_lessons",
        ["teacher_id", "starts_at", "id"],
        unique=False,
        postgresql_where=sa.text("NOT deleted"),
    )
    op.create_table(
        "scheduling_teaching_preferences",
        sa.Column("teacher_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "amount >= 0 AND amount <> 'NaN'::numeric", name="ck_teaching_default_price"
        ),
        sa.CheckConstraint("duration_minutes > 0", name="ck_teaching_default_duration"),
        sa.ForeignKeyConstraint(["teacher_id"], ["identity_accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("teacher_id"),
    )
    op.create_table(
        "scheduling_lesson_participants",
        sa.Column("lesson_id", sa.Uuid(), nullable=False),
        sa.Column("card_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("profile_id", sa.Uuid(), nullable=True),
        sa.Column("profile_subject", sa.String(length=4000), nullable=True),
        sa.Column("state", sa.String(length=16), nullable=False),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("response_by", sa.Uuid(), nullable=True),
        sa.Column("replied_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "(state = 'not_required' AND deadline IS NULL AND response_by IS NULL "
            "AND replied_at IS NULL) OR (state = 'pending' AND deadline IS NOT NULL "
            "AND response_by IS NULL AND replied_at IS NULL) OR (state IN "
            "('accepted', 'declined') AND deadline IS NOT NULL AND response_by IS "
            "NOT NULL AND replied_at IS NOT NULL)",
            name="ck_lesson_participant_response",
        ),
        sa.CheckConstraint(
            "amount >= 0 AND amount <> 'NaN'::numeric", name="ck_lesson_participant_price"
        ),
        sa.ForeignKeyConstraint(["lesson_id"], ["scheduling_lessons.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("lesson_id", "card_id"),
    )
    op.create_index(
        "ix_lesson_card_listing",
        "scheduling_lesson_participants",
        ["card_id", "lesson_id"],
        unique=False,
    )
    op.create_table(
        "scheduling_lesson_revisions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("sequence", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("lesson_id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("happened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("schema_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.CheckConstraint("schema_version = 1", name="ck_lesson_revision_schema"),
        sa.ForeignKeyConstraint(["lesson_id"], ["scheduling_lessons.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sequence", name="uq_lesson_revision_sequence"),
    )
    op.create_index(
        "ix_lesson_revision_history",
        "scheduling_lesson_revisions",
        ["lesson_id", "sequence"],
        unique=False,
    )

    op.create_index(
        "ix_lesson_group_time",
        "scheduling_lessons",
        ["teacher_id", "group_id", "starts_at", "id"],
        postgresql_where=sa.text("NOT deleted"),
    )

    op.create_check_constraint(
        "ck_lesson_revision_kind",
        "scheduling_lesson_revisions",
        "kind IN ('created', 'updated', 'deleted', 'reply')",
    )


def downgrade() -> None:
    op.drop_index("ix_lesson_revision_history", table_name="scheduling_lesson_revisions")
    op.drop_table("scheduling_lesson_revisions")
    op.drop_index("ix_lesson_card_listing", table_name="scheduling_lesson_participants")
    op.drop_table("scheduling_lesson_participants")
    op.drop_table("scheduling_teaching_preferences")
    op.drop_index(
        "ix_lesson_owner_time",
        table_name="scheduling_lessons",
        postgresql_where=sa.text("NOT deleted"),
    )
    op.drop_table("scheduling_lessons")
