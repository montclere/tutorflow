"""Единое участие аккаунта в карточке с защитой от самосвязей."""

import sqlalchemy as sa
from alembic import op


revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("uq_students_teacher_account", "students_connections", type_="unique")
    op.drop_constraint("students_connections_pkey", "students_connections", type_="primary")
    op.add_column(
        "students_connections",
        sa.Column("role", sa.String(10), nullable=False, server_default="student"),
    )
    op.add_column(
        "students_connections",
        sa.Column("slot", sa.SmallInteger(), nullable=False, server_default="0"),
    )
    op.create_primary_key(
        "students_connections_pkey", "students_connections", ["card_id", "account_id"]
    )
    op.execute(
        "INSERT INTO students_connections (card_id, teacher_id, account_id, role, slot) "
        "SELECT card_id, teacher_id, account_id, 'adult', slot FROM "
        "students_adult_connections"
    )
    op.create_unique_constraint(
        "uq_card_connection_slot", "students_connections", ["card_id", "slot"]
    )
    op.create_check_constraint(
        "ck_card_connection_role_slot",
        "students_connections",
        "(role = 'student' AND slot = 0 AND account_id <> teacher_id) "
        "OR (role = 'adult' AND slot BETWEEN 1 AND 2)",
    )
    op.create_index(
        "uq_students_teacher_account",
        "students_connections",
        ["teacher_id", "account_id"],
        unique=True,
        postgresql_where=sa.text("role = 'student'"),
    )
    op.create_foreign_key(
        "fk_card_connection_role",
        "students_connections",
        "identity_account_roles",
        ["account_id", "role"],
        ["account_id", "role"],
        ondelete="CASCADE",
    )
    op.drop_table("students_adult_connections")


def downgrade() -> None:
    op.create_table(
        "students_adult_connections",
        sa.Column("card_id", sa.Uuid(), primary_key=True),
        sa.Column(
            "account_id",
            sa.Uuid(),
            sa.ForeignKey("identity_accounts.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("teacher_id", sa.Uuid(), nullable=False),
        sa.Column("slot", sa.SmallInteger(), nullable=False),
        sa.ForeignKeyConstraint(
            ["card_id", "teacher_id"],
            ["students_cards.id", "students_cards.teacher_id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("card_id", "slot", name="uq_adult_connection_slot"),
        sa.CheckConstraint("slot BETWEEN 1 AND 2", name="ck_adult_connection_slot"),
    )
    op.create_index(
        "ix_adult_connection_listing", "students_adult_connections", ["account_id", "card_id"]
    )
    op.execute(
        "INSERT INTO students_adult_connections (card_id, teacher_id, account_id, slot) "
        "SELECT card_id, teacher_id, account_id, slot FROM students_connections WHERE role = "
        "'adult'"
    )
    op.execute("DELETE FROM students_connections WHERE role = 'adult'")
    op.drop_constraint("fk_card_connection_role", "students_connections", type_="foreignkey")
    op.drop_index("uq_students_teacher_account", table_name="students_connections")
    op.drop_constraint("ck_card_connection_role_slot", "students_connections", type_="check")
    op.drop_constraint("uq_card_connection_slot", "students_connections", type_="unique")
    op.drop_constraint("students_connections_pkey", "students_connections", type_="primary")
    op.create_primary_key("students_connections_pkey", "students_connections", ["card_id"])
    op.create_unique_constraint(
        "uq_students_teacher_account", "students_connections", ["teacher_id", "account_id"]
    )
    op.drop_column("students_connections", "slot")
    op.drop_column("students_connections", "role")
