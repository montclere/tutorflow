"""Порты хранилища, Identity и ограничений запросов Students."""

from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from app.modules.identity.public import InvitedAccounts
from app.modules.students.application.contracts import CardDetails
from app.modules.students.domain.entities import (
    Connection,
    Invitation,
    LearningProfile,
    StudentCard,
)


class StudentsRepository(Protocol):
    async def add_card(self, card: StudentCard) -> None: ...

    async def find_card(
        self, card_id: UUID, teacher_id: UUID | None = None, *, lock: bool = False
    ) -> StudentCard | None: ...

    async def find_student_card(self, card_id: UUID, account_id: UUID) -> StudentCard | None: ...

    async def save_card(self, card: StudentCard) -> None: ...

    async def delete_card(self, card_id: UUID) -> None: ...

    async def list_cards(
        self, teacher_id: UUID, include_archived: bool, after_id: UUID | None, limit: int
    ) -> list[CardDetails]: ...

    async def save_profile(self, profile: LearningProfile) -> None: ...

    async def find_profile(self, card_id: UUID, profile_id: UUID) -> LearningProfile | None: ...

    async def list_profiles(
        self, card_id: UUID, after_id: UUID | None, limit: int
    ) -> list[LearningProfile]: ...

    async def delete_profile(self, card_id: UUID, profile_id: UUID) -> bool: ...

    async def save_invitation(self, invitation: Invitation) -> None: ...

    async def find_invitation(self, digest: str) -> Invitation | None: ...

    async def revoke_invitation(self, card_id: UUID) -> None: ...

    async def consume_invitation(self, invitation_id: UUID, now: datetime) -> bool: ...

    async def find_connection(self, card_id: UUID) -> Connection | None: ...

    async def find_teacher_connection(
        self, teacher_id: UUID, account_id: UUID
    ) -> Connection | None: ...

    async def add_connection(self, connection: Connection) -> None: ...

    async def delete_connection(self, card_id: UUID) -> None: ...

    async def list_connections(
        self, account_id: UUID, after_id: UUID | None, limit: int
    ) -> list[tuple[Connection, bool]]: ...


@dataclass(frozen=True)
class StudentsTransaction:
    students: StudentsRepository
    accounts: InvitedAccounts


class StudentsUnitOfWork(Protocol):
    def transaction(self) -> AbstractAsyncContextManager[StudentsTransaction]: ...


class InvitationTokens(Protocol):
    def new_token(self) -> str: ...

    def digest(self, token: str) -> str: ...


class StudentRequests(Protocol):
    async def access(self, ip: str) -> None: ...

    async def issue(self, teacher_id: UUID) -> None: ...
