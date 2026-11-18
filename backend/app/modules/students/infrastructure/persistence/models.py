from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    Uuid,
)

from app.shared.infrastructure.db.base import metadata

student_cards = Table(
    "student_cards",
    metadata,
    Column("student_card_id", Uuid, primary_key=True),
    Column("teacher_account_id", Uuid, nullable=False),
    Column("student_account_id", Uuid),
    Column("student_card_name", String(80), nullable=False),
    Column("subject", String(80)),
    Column("learning_goal", String(500)),
    Column("private_note", Text),
    Column("status", String(16), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
    Column("version", Integer, nullable=False),
    UniqueConstraint("teacher_account_id", "student_account_id", name="uq_student_teacher_account"),
    CheckConstraint("student_account_id <> teacher_account_id", name="distinct_accounts"),
    CheckConstraint("status IN ('active', 'archived')", name="status"),
    Index(
        "ix_student_cards_teacher_sort",
        "teacher_account_id",
        "status",
        "updated_at",
        "student_card_id",
    ),
    Index(
        "ix_student_cards_student_sort",
        "student_account_id",
        "status",
        "updated_at",
        "student_card_id",
    ),
)
invitations = Table(
    "invitations",
    metadata,
    Column("invitation_id", Uuid, primary_key=True),
    Column("teacher_account_id", Uuid, nullable=False),
    Column("purpose", String(40), nullable=False),
    Column("token_digest", String(64), unique=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False, index=True),
    Column("revoked_at", DateTime(timezone=True)),
    Column("accepted_at", DateTime(timezone=True)),
    Column("accepted_by_account_id", Uuid),
    Column(
        "created_student_card_id", Uuid, ForeignKey("student_cards.student_card_id"), unique=True
    ),
    Column("acceptance_payload_digest", String(64)),
    CheckConstraint(
        "purpose IN ('new_student_card_for_student', 'new_student_card_for_parent')", name="purpose"
    ),
    CheckConstraint(
        "(accepted_at IS NULL AND accepted_by_account_id IS NULL AND "
        "created_student_card_id IS NULL) "
        "OR (accepted_at IS NOT NULL AND accepted_by_account_id IS NOT NULL "
        "AND created_student_card_id IS NOT NULL AND revoked_at IS NULL)",
        name="acceptance",
    ),
    Index("ix_invitations_teacher_sort", "teacher_account_id", "created_at", "invitation_id"),
)
parent_access = Table(
    "parent_access",
    metadata,
    Column("parent_access_id", Uuid, primary_key=True),
    Column("student_card_id", Uuid, ForeignKey("student_cards.student_card_id"), nullable=False),
    Column("parent_account_id", Uuid, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("revoked_at", DateTime(timezone=True)),
    UniqueConstraint("student_card_id", "parent_account_id"),
    Index("ix_parent_access_card_sort", "student_card_id", "created_at", "parent_access_id"),
    Index("ix_parent_access_parent", "parent_account_id", "revoked_at"),
)
audit_events = Table(
    "audit_events",
    metadata,
    Column("event_id", Uuid, primary_key=True),
    Column("actor_account_id", Uuid, nullable=False),
    Column("action", String(64), nullable=False),
    Column("object_kind", String(32), nullable=False),
    Column("object_id", Uuid, nullable=False),
    Column("outcome", String(16), nullable=False),
    Column("request_id", Uuid, nullable=False),
    Column("occurred_at", DateTime(timezone=True), nullable=False, index=True),
)

parent_applications = Table(
    "parent_applications",
    metadata,
    Column("application_id", Uuid, primary_key=True),
    Column("student_card_id", Uuid, ForeignKey("student_cards.student_card_id"), nullable=False),
    Column("token_digest", String(64), unique=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False, index=True),
    Column("requester_account_id", Uuid),
    Column("decision", String(16)),
    Column("decided_at", DateTime(timezone=True)),
    CheckConstraint("decision IN ('approved', 'rejected', 'revoked')", name="decision"),
    Index("ix_parent_applications_card_sort", "student_card_id", "created_at", "application_id"),
)
