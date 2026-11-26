"""Расширение назначения подтверждения контакта приглашённым взрослым."""

from alembic import op


revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_identity_registration_purpose", "identity_registrations", type_="check")
    op.create_check_constraint(
        "ck_identity_registration_purpose",
        "identity_registrations",
        "(role = 'teacher' AND invitation_id IS NULL) "
        "OR (role IN ('student', 'adult') AND invitation_id IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_identity_registration_purpose", "identity_registrations", type_="check")
    op.create_check_constraint(
        "ck_identity_registration_purpose",
        "identity_registrations",
        "(role = 'teacher' AND invitation_id IS NULL) "
        "OR (role = 'student' AND invitation_id IS NOT NULL)",
    )
