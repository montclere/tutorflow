"""Карточки учеников, учебные профили, приглашения и подключения."""

from dataclasses import dataclass, replace
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.students.domain.exceptions import StudentError
from app.modules.students.domain.values import WELCOME_MAX_LENGTH, Money, card_name, optional_text


@dataclass(frozen=True)
class StudentCard:
    id: UUID
    teacher_id: UUID
    name: str
    notes: str | None
    archived: bool = False

    def __post_init__(self) -> None:
        object.__setattr__(self, "name", card_name(self.name))
        object.__setattr__(self, "notes", optional_text(self.notes))

    @classmethod
    def create(cls, teacher_id: UUID, name: str, notes: str | None) -> "StudentCard":
        return cls(uuid4(), teacher_id, name, notes)

    def change(self, fields: dict[str, str | None]) -> "StudentCard":
        if not fields or fields.keys() - {"name", "notes"}:
            raise StudentError("invalid_student_data")

        return replace(self, **fields)

    def require_active(self) -> None:
        if self.archived:
            raise StudentError("student_card_archived")


@dataclass(frozen=True)
class LearningProfile:
    id: UUID
    card_id: UUID
    price: Money
    subject: str | None = None
    level: str | None = None
    goal: str | None = None
    duration: str | None = None
    description: str | None = None

    def __post_init__(self) -> None:
        for name in ("subject", "level", "goal", "duration", "description"):
            object.__setattr__(self, name, optional_text(getattr(self, name)))


@dataclass(frozen=True)
class Invitation:
    id: UUID
    card_id: UUID
    token_digest: str
    created_at: datetime
    expires_at: datetime
    welcome: str | None
    consumed_at: datetime | None

    def __post_init__(self) -> None:
        if self.expires_at <= self.created_at:
            raise StudentError("invitation_invalid")

        object.__setattr__(self, "welcome", optional_text(self.welcome, WELCOME_MAX_LENGTH))

    def require_for(self, card: StudentCard, now: datetime) -> None:
        if self.card_id != card.id or card.archived:
            raise StudentError("invitation_invalid")

        self.require_active(now)

    def require_active(self, now: datetime) -> None:
        if self.consumed_at is not None or self.expires_at <= now:
            raise StudentError("invitation_invalid")


@dataclass(frozen=True)
class Connection:
    card_id: UUID
    teacher_id: UUID
    account_id: UUID


@dataclass(frozen=True)
class TeacherConnection:
    card_id: UUID
    teacher_id: UUID
    teacher_name: str | None
    archived: bool
