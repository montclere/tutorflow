from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, StringConstraints, model_validator

from app.shared.presentation.api.auth import Input
from app.shared.presentation.api.schemas import Version

from ...domain.student import InvitationPurpose

CardStatus = Literal["active", "archived"]


class InvitationIssue(Input):
    purpose: InvitationPurpose


class InvitationToken(Input):
    invitation_token: Annotated[str, StringConstraints(max_length=1024)]


class AcceptInvitation(InvitationToken):
    student_card_name: Any = None


class InvitationPreview(BaseModel):
    purpose: InvitationPurpose
    expires_at: datetime


class InvitationSummary(InvitationPreview):
    invitation_id: UUID
    status: Literal["pending", "accepted", "revoked", "expired"]
    created_at: datetime


class InvitationCreated(BaseModel):
    invitation: InvitationSummary
    invitation_token: str


class InvitationAcceptance(BaseModel):
    purpose: InvitationPurpose
    student_card_id: UUID
    parent_access_id: UUID | None = None


class CardVersion(Input):
    expected_version: Version


class CardEdit(CardVersion):
    student_card_name: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)] | None
    ) = None
    subject: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)] | None
    ) = None
    learning_goal: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
        | None
    ) = None
    private_note: Annotated[str, StringConstraints(max_length=4000)] | None = None

    @model_validator(mode="after")
    def validate_changes(self):
        fields = self.model_fields_set - {"expected_version"}
        if not fields or ("student_card_name" in fields and self.student_card_name is None):
            raise ValueError("empty_card_edit")
        for name in fields:
            value = getattr(self, name)
            if value and any(ord(char) < 32 and char not in "\n\r\t" for char in value):
                raise ValueError("invalid_text")
        if self.student_card_name and any(
            not char.isprintable() for char in self.student_card_name
        ):
            raise ValueError("invalid_name")
        return self


class CardView(BaseModel):
    student_card_id: UUID
    student_card_name: str
    subject: str | None
    learning_goal: str | None


class TeacherCardView(CardView):
    student_account_id: UUID | None
    private_note: str | None
    status: CardStatus
    created_at: datetime
    updated_at: datetime
    version: int


class StudentCardView(CardView):
    teacher_display_name: str


class ParentCardView(StudentCardView):
    parent_access_id: UUID


class ParentAccessView(BaseModel):
    parent_access_id: UUID
    student_card_id: UUID
    parent_display_name: str | None
    status: Literal["active", "revoked"]


class CabinetsView(BaseModel):
    teacher_enabled: bool
    student_available: bool
    parent_available: bool
