"""Раздельные результаты проведения и персональная посещаемость занятий."""

import sqlalchemy as sa
from alembic import op


revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "scheduling_lessons",
        sa.Column("outcome", sa.String(16), server_default="unrecorded", nullable=False),
    )
    op.add_column(
        "scheduling_lessons", sa.Column("completion_notes", sa.String(4000), nullable=True)
    )
    op.add_column(
        "scheduling_lesson_participants",
        sa.Column("attendance", sa.String(16), server_default="unmarked", nullable=False),
    )
    op.create_check_constraint(
        "ck_lesson_outcome", "scheduling_lessons", "outcome IN ('unrecorded', 'held', 'not_held')"
    )
    op.create_check_constraint(
        "ck_lesson_attendance",
        "scheduling_lesson_participants",
        "attendance IN ('unmarked', 'present', 'absent')",
    )
    op.drop_constraint("ck_lesson_revision_kind", "scheduling_lesson_revisions")
    op.create_check_constraint(
        "ck_lesson_revision_kind",
        "scheduling_lesson_revisions",
        "kind IN ('created', 'updated', 'deleted', 'reply', 'cancelled', 'restored', 'completed')",
    )


def downgrade() -> None:
    op.execute("DELETE FROM scheduling_lesson_revisions WHERE kind = 'completed'")
    op.drop_constraint("ck_lesson_revision_kind", "scheduling_lesson_revisions")
    op.create_check_constraint(
        "ck_lesson_revision_kind",
        "scheduling_lesson_revisions",
        "kind IN ('created', 'updated', 'deleted', 'reply', 'cancelled', 'restored')",
    )
    op.drop_constraint("ck_lesson_attendance", "scheduling_lesson_participants")
    op.drop_constraint("ck_lesson_outcome", "scheduling_lessons")
    op.drop_column("scheduling_lesson_participants", "attendance")
    op.drop_column("scheduling_lessons", "completion_notes")
    op.drop_column("scheduling_lessons", "outcome")
