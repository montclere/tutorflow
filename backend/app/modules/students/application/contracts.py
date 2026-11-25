"""Контракты списков, приглашений и результатов карточки."""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

from app.modules.students.domain.entities import StudentCard


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
