"""Назначение подтверждения контакта преподавателя или приглашённого ученика."""

import sqlalchemy as sa
from alembic import op


revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "identity_registrations",
        sa.Column("role", sa.String(10), nullable=False, server_default="teacher"),
    )
    op.add_column("identity_registrations", sa.Column("invitation_id", sa.Uuid(), nullable=True))
    op.create_check_constraint(
        "ck_identity_registration_purpose",
        "identity_registrations",
        "(role = 'teacher' AND invitation_id IS NULL) "
        "OR (role = 'student' AND invitation_id IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_identity_registration_purpose", "identity_registrations", type_="check")
    op.drop_column("identity_registrations", "invitation_id")
    op.drop_column("identity_registrations", "role")
