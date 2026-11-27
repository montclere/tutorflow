"""Публикации свободного времени, атомарные резервы и собственные часы ученика."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint("uq_lesson_owner", "scheduling_lessons", ["id", "teacher_id"])
    op.create_table(
        "scheduling_availability",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("teacher_id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("snapshot", postgresql.JSONB(), nullable=False),
        sa.ForeignKeyConstraint(["teacher_id"], ["identity_accounts.id"], ondelete="CASCADE"),
        sa.CheckConstraint("version > 0", name="ck_availability_version"),
        sa.UniqueConstraint("id", "teacher_id", name="uq_availability_owner"),
    )
    op.create_index("ix_availability_owner", "scheduling_availability", ["teacher_id", "id"])
    op.create_table(
        "scheduling_bookings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("publication_id", sa.Uuid(), nullable=False),
        sa.Column("publication_version", sa.Integer(), nullable=False),
        sa.Column("teacher_id", sa.Uuid(), nullable=False),
        sa.Column("card_id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("break_minutes", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("lesson_id", sa.Uuid(), nullable=True),
        sa.Column("decided_by", sa.Uuid(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["publication_id", "teacher_id"],
            ["scheduling_availability.id", "scheduling_availability.teacher_id"],
            name="fk_booking_publication_owner",
        ),
        sa.ForeignKeyConstraint(["teacher_id"], ["identity_accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["lesson_id", "teacher_id"],
            ["scheduling_lessons.id", "scheduling_lessons.teacher_id"],
            name="fk_booking_lesson_owner",
        ),
        sa.UniqueConstraint("teacher_id", "card_id", "request_id", name="uq_booking_request"),
        sa.CheckConstraint(
            "ends_at > starts_at AND expires_at <= starts_at AND expires_at > created_at",
            name="ck_booking_time",
        ),
        sa.CheckConstraint(
            "break_minutes >= 0 AND publication_version > 0", name="ck_booking_conditions"
        ),
        sa.CheckConstraint(
            "state IN ('pending', 'accepted', 'rejected', 'withdrawn', 'expired', 'invalidated')",
            name="ck_booking_state",
        ),
        sa.CheckConstraint(
            "(state = 'accepted') = (lesson_id IS NOT NULL)", name="ck_booking_lesson"
        ),
    )
    op.create_index(
        "uq_booking_pending_card",
        "scheduling_bookings",
        ["teacher_id", "card_id"],
        unique=True,
        postgresql_where=sa.text("state = 'pending'"),
    )
    op.create_index(
        "ix_booking_owner_time", "scheduling_bookings", ["teacher_id", "starts_at", "ends_at"]
    )
    op.create_index("ix_booking_card_list", "scheduling_bookings", ["teacher_id", "card_id", "id"])
    op.create_table(
        "scheduling_student_hours",
        sa.Column("card_id", sa.Uuid(), primary_key=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("snapshot", postgresql.JSONB(), nullable=False),
        sa.ForeignKeyConstraint(["card_id"], ["students_cards.id"], ondelete="CASCADE"),
        sa.CheckConstraint("version > 0", name="ck_student_hours_version"),
    )


def downgrade() -> None:
    op.drop_table("scheduling_student_hours")
    op.drop_table("scheduling_bookings")
    op.drop_table("scheduling_availability")
    op.drop_constraint("uq_lesson_owner", "scheduling_lessons")
