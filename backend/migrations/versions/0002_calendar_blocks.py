"""Хранение личных календарных блоков."""

import sqlalchemy as sa
from alembic import op


revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scheduling_calendar_blocks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("timezone", sa.String(length=80), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_scheduling_blocks_owner_start", "scheduling_calendar_blocks", ["owner_id", "starts_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_scheduling_blocks_owner_start", table_name="scheduling_calendar_blocks")
    op.drop_table("scheduling_calendar_blocks")
