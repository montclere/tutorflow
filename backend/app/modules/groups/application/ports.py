"""Порты агрегата группы и общей транзакции доступа к карточкам."""

from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from app.modules.groups.application.contracts import GroupOverview, Participation
from app.modules.groups.domain.entities import Group, Member
from app.modules.students.public import GroupCards


class GroupsRepository(Protocol):
    async def add(self, group: Group) -> None: ...

    async def find(self, group_id: UUID, teacher_id: UUID, *, lock: bool) -> Group | None: ...

    async def save(self, group: Group) -> None: ...

    async def delete(self, group_id: UUID) -> None: ...

    async def overview(self, group: Group) -> GroupOverview: ...

    async def list_groups(
        self, teacher_id: UUID, archived: bool, after_id: UUID | None, limit: int
    ) -> list[GroupOverview]: ...

    async def find_member(self, group_id: UUID, card_id: UUID) -> Member | None: ...

    async def add_member(self, member: Member) -> None: ...

    async def save_member(self, member: Member) -> None: ...

    async def delete_member(self, group_id: UUID, card_id: UUID) -> None: ...

    async def list_members(
        self, group_id: UUID, after_id: UUID | None, limit: int
    ) -> list[Member]: ...

    async def participations(
        self, card_id: UUID, after_id: UUID | None, limit: int
    ) -> list[Participation]: ...

    async def find_participation(self, card_id: UUID, group_id: UUID) -> Participation | None: ...


@dataclass(frozen=True)
class GroupTransaction:
    groups: GroupsRepository
    cards: GroupCards


class GroupsUnitOfWork(Protocol):
    def transaction(self) -> AbstractAsyncContextManager[GroupTransaction]: ...
