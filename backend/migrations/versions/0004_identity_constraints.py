"""Ограничения типов контактов, сроков и счётчиков Identity."""

from alembic import op


revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


CONSTRAINTS = (
    ("identity_accounts", "ck_identity_account_contact_kind", "contact_kind IN ('email', 'phone')"),
    ("identity_accounts", "ck_identity_account_contact_present", "length(trim(contact)) > 0"),
    (
        "identity_registrations",
        "ck_identity_registration_contact_kind",
        "contact_kind IN ('email', 'phone')",
    ),
    (
        "identity_registrations",
        "ck_identity_registration_contact_present",
        "length(trim(contact)) > 0",
    ),
    (
        "identity_registrations",
        "ck_identity_registration_remaining_attempts",
        "remaining_attempts >= 0",
    ),
    (
        "identity_registrations",
        "ck_identity_registration_delivery_attempts",
        "delivery_attempts >= 0",
    ),
    ("identity_registrations", "ck_identity_registration_expiry", "expires_at > sent_at"),
    ("identity_rate_windows", "ck_identity_rate_window_attempts", "attempts > 0"),
)


def upgrade() -> None:
    for table, name, condition in CONSTRAINTS:
        op.create_check_constraint(name, table, condition)


def downgrade() -> None:
    for table, name, _ in reversed(CONSTRAINTS):
        op.drop_constraint(name, table, type_="check")
