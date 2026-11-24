"""Защищает владение блоками, повторы записи и доставку кодов."""

import sqlalchemy as sa
from alembic import op


revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "identity_registrations", sa.Column("delivery_due_at", sa.DateTime(timezone=True))
    )
    op.add_column(
        "identity_registrations",
        sa.Column("delivery_attempts", sa.Integer(), server_default="0", nullable=False),
    )
    op.create_index(
        "ix_identity_registrations_delivery_due_at", "identity_registrations", ["delivery_due_at"]
    )
    op.create_index("ix_identity_sessions_account_id", "identity_sessions", ["account_id"])
    op.create_table(
        "scheduling_block_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column(
            "expires_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now() + interval '7 days'"),
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["identity_accounts.id"],
            name="fk_scheduling_requests_owner",
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_scheduling_block_requests_owner_id", "scheduling_block_requests", ["owner_id"]
    )
    op.create_index(
        "ix_scheduling_block_requests_expires_at", "scheduling_block_requests", ["expires_at"]
    )
    op.create_foreign_key(
        "fk_scheduling_blocks_owner",
        "scheduling_calendar_blocks",
        "identity_accounts",
        ["owner_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_check_constraint(
        "ck_scheduling_blocks_duration",
        "scheduling_calendar_blocks",
        "duration_minutes BETWEEN 5 AND 480",
    )
    op.create_index(
        "ix_scheduling_blocks_owner_start_id",
        "scheduling_calendar_blocks",
        ["owner_id", "starts_at", "id"],
    )
    op.drop_index("ix_scheduling_blocks_owner_start", table_name="scheduling_calendar_blocks")
    op.create_index(
        "ix_identity_registrations_expires_at", "identity_registrations", ["expires_at"]
    )
    op.create_index("ix_identity_rate_windows_reset_at", "identity_rate_windows", ["reset_at"])


def downgrade() -> None:
    op.drop_index("ix_identity_sessions_account_id", table_name="identity_sessions")
    op.drop_index("ix_identity_registrations_delivery_due_at", table_name="identity_registrations")
    op.drop_column("identity_registrations", "delivery_attempts")
    op.drop_column("identity_registrations", "delivery_due_at")
    op.drop_table("scheduling_block_requests")
    op.drop_index("ix_identity_rate_windows_reset_at", table_name="identity_rate_windows")
    op.drop_index("ix_identity_registrations_expires_at", table_name="identity_registrations")
    op.create_index(
        "ix_scheduling_blocks_owner_start",
        "scheduling_calendar_blocks",
        ["owner_id", "starts_at"],
    )
    op.drop_index("ix_scheduling_blocks_owner_start_id", table_name="scheduling_calendar_blocks")
    op.drop_constraint("ck_scheduling_blocks_duration", "scheduling_calendar_blocks", type_="check")
    op.drop_constraint(
        "fk_scheduling_blocks_owner", "scheduling_calendar_blocks", type_="foreignkey"
    )
