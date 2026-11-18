from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class InvitationPurpose(StrEnum):
    STUDENT = "new_student_card_for_student"
    PARENT = "new_student_card_for_parent"


@dataclass(frozen=True)
class Invitation:
    invitation_id: UUID
    teacher_account_id: UUID
    purpose: str
    created_at: datetime
    expires_at: datetime
    revoked_at: datetime | None
    accepted_at: datetime | None
    accepted_by_account_id: UUID | None
    created_student_card_id: UUID | None
    acceptance_payload_digest: str | None

    def status(self, now: datetime) -> str:
        if self.accepted_at is not None:
            return "accepted"
        if self.revoked_at is not None:
            return "revoked"
        return "expired" if now >= self.expires_at else "pending"

    def summary(self, now: datetime) -> dict:
        return {
            "invitation_id": self.invitation_id,
            "purpose": self.purpose,
            "status": self.status(now),
            "created_at": self.created_at,
            "expires_at": self.expires_at,
        }


@dataclass(frozen=True)
class StudentCard:
    student_card_id: UUID
    teacher_account_id: UUID
    student_account_id: UUID | None
    student_card_name: str
    subject: str | None
    learning_goal: str | None
    private_note: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    version: int

    def shared_view(self) -> dict:
        return {
            "student_card_id": self.student_card_id,
            "student_card_name": self.student_card_name,
            "subject": self.subject,
            "learning_goal": self.learning_goal,
        }

    def teacher_view(self) -> dict:
        return {
            **self.shared_view(),
            "student_account_id": self.student_account_id,
            "private_note": self.private_note,
            "status": self.status,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "version": self.version,
        }


@dataclass(frozen=True)
class ParentAccess:
    parent_access_id: UUID
    student_card_id: UUID
    parent_account_id: UUID
    created_at: datetime
    revoked_at: datetime | None


@dataclass(frozen=True)
class ParentApplication:
    application_id: UUID
    student_card_id: UUID
    created_at: datetime
    expires_at: datetime
    requester_account_id: UUID | None = None
    decision: str | None = None
    decided_at: datetime | None = None

    def status(self, now: datetime) -> str:
        if self.decision:
            return self.decision
        if self.expires_at <= now:
            return "expired"
        return "awaiting_review" if self.requester_account_id else "pending"
