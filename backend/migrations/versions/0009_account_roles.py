"""Перенос единственной роли в явные назначения одного аккаунта."""

import sqlalchemy as sa
from alembic import op


revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "identity_account_roles",
        sa.Column(
            "account_id",
            sa.Uuid(),
            sa.ForeignKey("identity_accounts.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("role", sa.String(10), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "role IN ('teacher', 'student', 'adult')", name="ck_identity_account_role_value"
        ),
    )
    op.execute(
        "INSERT INTO identity_account_roles (account_id, role, created_at) SELECT id, role, "
        "verified_at FROM identity_accounts"
    )
    op.drop_constraint("ck_identity_account_role", "identity_accounts", type_="check")
    op.drop_column("identity_accounts", "role")


def downgrade() -> None:
    connection = op.get_bind()
    ambiguous = connection.scalar(
        sa.text(
            "SELECT EXISTS (SELECT a.id FROM identity_accounts a LEFT JOIN "
            "identity_account_roles r ON r.account_id = a.id GROUP BY a.id HAVING "
            "count(r.role) <> 1)"
        )
    )

    if ambiguous:
        raise ValueError("Откат потеряет назначения ролей аккаунта")

    op.add_column("identity_accounts", sa.Column("role", sa.String(10), nullable=True))
    op.execute(
        "UPDATE identity_accounts a SET role = r.role FROM identity_account_roles r WHERE "
        "r.account_id = a.id"
    )
    op.alter_column("identity_accounts", "role", nullable=False)
    op.create_check_constraint(
        "ck_identity_account_role", "identity_accounts", "role IN ('teacher', 'student', 'adult')"
    )
    op.drop_table("identity_account_roles")
