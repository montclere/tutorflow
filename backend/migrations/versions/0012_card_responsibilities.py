"""Ответственный за расписание без угадывания порядка старых подключений."""

import sqlalchemy as sa
from alembic import op


revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "students_responsibilities",
        sa.Column("card_id", sa.Uuid(), primary_key=True),
        sa.Column("category", sa.String(30), primary_key=True),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["card_id", "account_id"],
            ["students_connections.card_id", "students_connections.account_id"],
            ondelete="CASCADE",
        ),
        sa.CheckConstraint("category = 'scheduling'", name="ck_student_responsibility_category"),
    )
    op.execute(
        "INSERT INTO students_responsibilities (card_id, category, account_id, assigned_at) "
        "SELECT c.card_id, 'scheduling', c.account_id, now() FROM students_connections c "
        "WHERE NOT EXISTS (SELECT 1 FROM students_connections other "
        "WHERE other.card_id = c.card_id AND other.account_id <> c.account_id)"
    )


def downgrade() -> None:
    op.drop_table("students_responsibilities")
