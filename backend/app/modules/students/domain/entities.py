"""Карточки учеников, учебные профили, приглашения и подключения."""

from dataclasses import dataclass, replace
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.students.domain.exceptions import StudentError
from app.modules.students.domain.values import Money, card_name, optional_text


@dataclass(frozen=True)
class StudentCard:
    id: UUID
    teacher_id: UUID
    name: str
    notes: str | None
    archived: bool = False

    @classmethod
    def create(cls, teacher_id: UUID, name: str, notes: str | None) -> "StudentCard":
        return cls(uuid4(), teacher_id, card_name(name), optional_text(notes))

    def change(self, fields: dict[str, str | None]) -> "StudentCard":
        if not fields or fields.keys() - {"name", "notes"}:
            raise StudentError("invalid_student_data")

        values = dict(fields)

        if "name" in values:
            if values["name"] is None:
                raise StudentError("invalid_student_data")

            values["name"] = card_name(values["name"])

        if "notes" in values:
            values["notes"] = optional_text(values["notes"])

        return replace(self, **values)

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
