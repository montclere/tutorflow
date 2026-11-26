"""Контракты списков, приглашений и результатов карточки."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.modules.identity.public import Role, field
from app.modules.students.domain.entities import StudentCard
from app.modules.students.domain.values import Money


INVITATION_TOKEN_LENGTH = 43
PAGE_MAX_SIZE = 100
DEFAULT_PAGE_SIZE = 50


@dataclass(frozen=True)
class CardDetails:
    card: StudentCard
    account_id: UUID | None


@dataclass(frozen=True)
class IssuedInvitation:
    id: UUID
    token: str = field(repr=False)
    expires_at: datetime


@dataclass(frozen=True)
class InvitationPreview:
    teacher_id: UUID
    teacher_name: str | None
    welcome: str | None
    expires_at: datetime


@dataclass(frozen=True)
class AdultInvitationPreview:
    teacher_id: UUID
    teacher_name: str | None
    student_name: str
    welcome: str | None
    expires_at: datetime


@dataclass(frozen=True)
class AdultStudent:
    card_id: UUID
    student_name: str
    teacher_id: UUID
    teacher_name: str | None
    archived: bool


@dataclass(frozen=True)
class AdultLearningProfile:
    id: UUID
    subject: str | None
    price: Money


@dataclass(frozen=True)
class StudentCardSummary:
    id: UUID
    teacher_id: UUID
    name: str
    archived: bool


@dataclass(frozen=True)
class ResponsibilityAssignment:
    card_id: UUID
    account_id: UUID | None
    role: Role | None
