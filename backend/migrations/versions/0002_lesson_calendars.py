"""lesson calendars and parent applications"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lesson_calendars",
        sa.Column(
            "card_id", sa.Uuid(), sa.ForeignKey("student_cards.student_card_id"), primary_key=True
        ),
        sa.Column("teacher_id", sa.Uuid(), sa.ForeignKey("accounts.account_id"), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
    )
    op.create_index("ix_lesson_calendars_teacher_id", "lesson_calendars", ["teacher_id"])
    op.create_table(
        "lesson_calendar_refs",
        sa.Column("record_id", sa.Uuid(), primary_key=True),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column(
            "card_id",
            sa.Uuid(),
            sa.ForeignKey("lesson_calendars.card_id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    op.create_index("ix_lesson_calendar_refs_card_id", "lesson_calendar_refs", ["card_id"])

    op.create_table(
        "parent_applications",
        sa.Column("application_id", sa.Uuid(), primary_key=True),
        sa.Column(
            "student_card_id",
            sa.Uuid(),
            sa.ForeignKey("student_cards.student_card_id"),
            nullable=False,
        ),
        sa.Column("token_digest", sa.String(64), unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("requester_account_id", sa.Uuid()),
        sa.Column("decision", sa.String(16)),
        sa.Column("decided_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "decision IN ('approved', 'rejected', 'revoked')",
            name=op.f("ck_parent_applications_decision"),
        ),
    )
    op.create_index("ix_parent_applications_expires_at", "parent_applications", ["expires_at"])
    op.create_index(
        "ix_parent_applications_card_sort",
        "parent_applications",
        ["student_card_id", "created_at", "application_id"],
    )


def downgrade() -> None:
    op.drop_table("parent_applications")
    op.drop_table("lesson_calendar_refs")
    op.drop_table("lesson_calendars")
