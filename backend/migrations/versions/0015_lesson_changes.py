"""Отмена участия и версионированные запросы изменения занятия."""

import sqlalchemy as sa
from alembic import op


revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("scheduling_lessons", "scheduling_lesson_participants"):
        op.add_column(
            table, sa.Column("cancelled", sa.Boolean(), server_default="false", nullable=False)
        )
        op.add_column(table, sa.Column("cancellation_reason", sa.String(4000), nullable=True))

    op.drop_constraint("ck_lesson_revision_kind", "scheduling_lesson_revisions")
    op.create_check_constraint(
        "ck_lesson_revision_kind",
        "scheduling_lesson_revisions",
        "kind IN ('created', 'updated', 'deleted', 'reply', 'cancelled', 'restored')",
    )
    op.create_table(
        "scheduling_change_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("lesson_id", sa.Uuid(), nullable=False),
        sa.Column("card_id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("lesson_version", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("reason", sa.String(4000), nullable=True),
        sa.Column("proposed_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("decided_by", sa.Uuid(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["lesson_id", "card_id"],
            ["scheduling_lesson_participants.lesson_id", "scheduling_lesson_participants.card_id"],
            ondelete="CASCADE",
        ),
        sa.CheckConstraint("lesson_version > 0", name="ck_change_request_version"),
        sa.CheckConstraint("kind IN ('cancel', 'reschedule')", name="ck_change_request_kind"),
        sa.CheckConstraint(
            "kind = 'reschedule' OR proposed_start IS NULL", name="ck_change_request_time"
        ),
        sa.CheckConstraint(
            "state IN ('pending', 'accepted', 'rejected', 'withdrawn', 'superseded')",
            name="ck_change_request_state",
        ),
    )
    op.create_index(
        "uq_change_request_pending",
        "scheduling_change_requests",
        ["lesson_id", "card_id"],
        unique=True,
        postgresql_where=sa.text("state = 'pending'"),
    )
    op.create_index(
        "ix_change_request_listing", "scheduling_change_requests", ["lesson_id", "created_at", "id"]
    )


def downgrade() -> None:
    op.drop_table("scheduling_change_requests")
    op.execute("DELETE FROM scheduling_lesson_revisions WHERE kind IN ('cancelled', 'restored')")
    op.drop_constraint("ck_lesson_revision_kind", "scheduling_lesson_revisions")
    op.create_check_constraint(
        "ck_lesson_revision_kind",
        "scheduling_lesson_revisions",
        "kind IN ('created', 'updated', 'deleted', 'reply')",
    )

    for table in ("scheduling_lesson_participants", "scheduling_lessons"):
        op.drop_column(table, "cancellation_reason")
        op.drop_column(table, "cancelled")
