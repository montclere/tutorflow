"""Самостоятельные группы и стоимость участия собственных карточек учеников."""

import sqlalchemy as sa
from alembic import op


revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "groups_groups",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "teacher_id",
            sa.Uuid(),
            sa.ForeignKey("identity_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("notes", sa.String(4000)),
        sa.Column("archived", sa.Boolean(), server_default="false", nullable=False),
        sa.UniqueConstraint("id", "teacher_id", name="uq_group_owner"),
        sa.CheckConstraint("length(trim(name)) > 0", name="ck_group_name"),
    )
    op.create_index("ix_group_listing", "groups_groups", ["teacher_id", "archived", "id"])
    op.create_table(
        "groups_memberships",
        sa.Column("group_id", sa.Uuid(), primary_key=True),
        sa.Column("card_id", sa.Uuid(), primary_key=True),
        sa.Column("teacher_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.ForeignKeyConstraint(
            ["group_id", "teacher_id"],
            ["groups_groups.id", "groups_groups.teacher_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["card_id", "teacher_id"],
            ["students_cards.id", "students_cards.teacher_id"],
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "amount >= 0 AND amount <> 'NaN'::numeric", name="ck_group_member_price"
        ),
    )
    op.create_index("ix_group_card_listing", "groups_memberships", ["card_id", "group_id"])


def downgrade() -> None:
    op.drop_table("groups_memberships")
    op.drop_table("groups_groups")
