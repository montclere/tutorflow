"""Карточки учеников, учебные профили, приглашения и подключения."""

import sqlalchemy as sa
from alembic import op


revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "students_cards",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "teacher_id",
            sa.Uuid(),
            sa.ForeignKey("identity_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("notes", sa.String(4000)),
        sa.Column("archived", sa.Boolean(), nullable=False, server_default="false"),
        sa.UniqueConstraint("id", "teacher_id", name="uq_students_card_owner"),
        sa.CheckConstraint("length(trim(name)) > 0", name="ck_students_card_name"),
    )
    op.create_index("ix_students_card_listing", "students_cards", ["teacher_id", "archived", "id"])
    op.create_table(
        "students_learning_profiles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "card_id",
            sa.Uuid(),
            sa.ForeignKey("students_cards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="RUB"),
        *(
            sa.Column(name, sa.String(4000))
            for name in ("subject", "level", "goal", "duration", "description")
        ),
        sa.CheckConstraint(
            "amount >= 0 AND amount <> 'NaN'::numeric", name="ck_students_profile_price"
        ),
        sa.CheckConstraint("currency = 'RUB'", name="ck_students_profile_currency"),
    )
    op.create_index(
        "ix_students_learning_profiles_card_id", "students_learning_profiles", ["card_id"]
    )
    op.create_table(
        "students_invitations",
        sa.Column(
            "card_id",
            sa.Uuid(),
            sa.ForeignKey("students_cards.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("id", sa.Uuid(), nullable=False, unique=True),
        sa.Column("token_digest", sa.String(64), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("welcome", sa.String(2000)),
        sa.Column("consumed_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("expires_at > created_at", name="ck_students_invitation_expiry"),
    )
    op.create_table(
        "students_connections",
        sa.Column("card_id", sa.Uuid(), primary_key=True),
        sa.Column("teacher_id", sa.Uuid(), nullable=False),
        sa.Column(
            "account_id",
            sa.Uuid(),
            sa.ForeignKey("identity_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["card_id", "teacher_id"],
            ["students_cards.id", "students_cards.teacher_id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("teacher_id", "account_id", name="uq_students_teacher_account"),
    )
    op.create_index(
        "ix_students_connection_listing", "students_connections", ["account_id", "card_id"]
    )


def downgrade() -> None:
    for table in (
        "students_connections",
        "students_invitations",
        "students_learning_profiles",
        "students_cards",
    ):
        op.drop_table(table)
