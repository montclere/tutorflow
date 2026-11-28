"""Отдельные детские входы и полномочия управляющих взрослых."""

import sqlalchemy as sa
from alembic import op


revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


TABLE = "identity_accounts"


def upgrade() -> None:
    op.drop_constraint("ck_identity_account_contact_kind", TABLE, type_="check")
    op.create_check_constraint(
        "ck_identity_account_contact_kind", TABLE, "contact_kind IN ('email', 'phone', 'child')"
    )

    for column in ("manager_id", "pending_manager_id"):
        op.add_column(TABLE, sa.Column(column, sa.Uuid(), nullable=True))
        op.create_foreign_key(
            f"fk_{TABLE}_{column}", TABLE, TABLE, [column], ["id"], ondelete="SET NULL"
        )
        op.create_index(f"ix_{TABLE}_{column}", TABLE, [column])

    op.create_check_constraint(
        "ck_identity_child_management_kind",
        TABLE,
        "contact_kind = 'child' OR (manager_id IS NULL AND pending_manager_id IS NULL)",
    )
    op.create_check_constraint(
        "ck_identity_child_management_distinct",
        TABLE,
        "manager_id IS DISTINCT FROM id AND pending_manager_id IS DISTINCT FROM id "
        "AND (pending_manager_id IS NULL OR pending_manager_id IS DISTINCT FROM manager_id)",
    )


def downgrade() -> None:
    has_children = op.get_bind().scalar(
        sa.text("SELECT EXISTS (SELECT 1 FROM identity_accounts WHERE contact_kind = 'child')")
    )

    if has_children:
        raise RuntimeError("Откат удалил бы данные детских входов")

    op.drop_constraint("ck_identity_child_management_distinct", TABLE, type_="check")
    op.drop_constraint("ck_identity_child_management_kind", TABLE, type_="check")

    for column in ("pending_manager_id", "manager_id"):
        op.drop_index(f"ix_{TABLE}_{column}", table_name=TABLE)
        op.drop_constraint(f"fk_{TABLE}_{column}", TABLE, type_="foreignkey")
        op.drop_column(TABLE, column)

    op.drop_constraint("ck_identity_account_contact_kind", TABLE, type_="check")
    op.create_check_constraint(
        "ck_identity_account_contact_kind", TABLE, "contact_kind IN ('email', 'phone')"
    )
