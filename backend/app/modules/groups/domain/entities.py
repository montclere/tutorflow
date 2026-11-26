"""Самостоятельная группа преподавателя и текущее участие карточки ученика."""

from dataclasses import dataclass, replace
from uuid import UUID, uuid4

from app.modules.groups.domain.exceptions import GroupError
from app.modules.groups.domain.values import NOTES_MAX_LENGTH, Price, group_name, normalized_text


@dataclass(frozen=True)
class Group:
    id: UUID
    teacher_id: UUID
    name: str
    notes: str | None
    archived: bool = False

    def __post_init__(self) -> None:
        object.__setattr__(self, "name", group_name(self.name))
        object.__setattr__(self, "notes", normalized_text(self.notes, NOTES_MAX_LENGTH))

    @classmethod
    def create(cls, teacher_id: UUID, name: str, notes: str | None) -> "Group":
        return cls(uuid4(), teacher_id, name, notes)

    def require_active(self) -> None:
        if self.archived:
            raise GroupError("group_archived")

    def change(self, fields: dict[str, str | None]) -> "Group":
        self.require_active()

        if not fields or fields.keys() - {"name", "notes"}:
            raise GroupError("invalid_group_data")

        return replace(self, **fields)

    def set_archived(self, archived: bool) -> "Group":
        return replace(self, archived=archived)


@dataclass(frozen=True)
class Member:
    group_id: UUID
    teacher_id: UUID
    card_id: UUID
    price: Price
