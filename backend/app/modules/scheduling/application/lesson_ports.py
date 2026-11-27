"""Порты транзакционного хранения уроков и публичных участников модулей."""

from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from app.modules.groups.public import LessonGroups
from app.modules.identity.public import Actor
from app.modules.scheduling.application.lesson_contracts import (
    CalendarWarning,
    LessonCursor,
    LessonRevision,
    SavedLessonRequest,
    TeachingPreferences,
)
from app.modules.scheduling.domain.change_requests import LessonChangeRequest
from app.modules.scheduling.domain.lessons import Lesson
from app.modules.students.public import LessonCards


class LessonsRepository(Protocol):
    async def lock_calendar(self, teacher_id: UUID) -> None: ...

    async def find(
        self,
        lesson_id: UUID,
        teacher_id: UUID | None = None,
        *,
        lock: bool = False,
        include_deleted: bool = False,
    ) -> Lesson | None: ...

    async def find_request(
        self, teacher_id: UUID, request_id: UUID
    ) -> SavedLessonRequest | None: ...

    async def add(self, lesson: Lesson, request_id: UUID | None, fingerprint: str) -> bool: ...

    async def save(self, lesson: Lesson) -> None: ...

    async def mark_exception(self, lesson_id: UUID) -> None: ...

    async def mark_response_exception(self, lesson_id: UUID, card_id: UUID) -> None: ...

    async def append_revision(self, revision: LessonRevision) -> None: ...

    async def history(
        self, lesson_id: UUID, after_id: UUID | None, limit: int
    ) -> list[LessonRevision]: ...

    async def for_teacher(
        self,
        teacher_id: UUID,
        start: datetime,
        end: datetime,
        cursor: LessonCursor | None,
        limit: int,
        group_id: UUID | None = None,
    ) -> list[Lesson]: ...

    async def for_card(
        self,
        card_id: UUID,
        teacher_id: UUID,
        start: datetime,
        end: datetime,
        cursor: LessonCursor | None,
        limit: int,
        group_id: UUID | None = None,
    ) -> list[Lesson]: ...

    async def unfinished(
        self,
        teacher_id: UUID,
        start: datetime,
        end: datetime,
        now: datetime,
        after_id: UUID | None,
        limit: int,
    ) -> list[Lesson]: ...

    async def warnings(self, lesson: Lesson, limit: int) -> list[CalendarWarning]: ...

    async def preferences(self, teacher_id: UUID) -> TeachingPreferences: ...

    async def save_preferences(
        self, teacher_id: UUID, preferences: TeachingPreferences
    ) -> None: ...


class ChangeRequestsRepository(Protocol):
    async def add(self, request: LessonChangeRequest) -> None: ...

    async def find(self, lesson_id: UUID, request_id: UUID) -> LessonChangeRequest | None: ...

    async def list_for_lesson(
        self, lesson_id: UUID, card_id: UUID | None, after_id: UUID | None, limit: int
    ) -> list[LessonChangeRequest]: ...

    async def save(self, request: LessonChangeRequest) -> None: ...

    async def supersede(self, lesson_id: UUID, version: int) -> None: ...


@dataclass(frozen=True)
class LessonTransaction:
    lessons: LessonsRepository
    cards: LessonCards
    groups: LessonGroups
    requests: ChangeRequestsRepository


class LessonsUnitOfWork(Protocol):
    def transaction(self) -> AbstractAsyncContextManager[LessonTransaction]: ...


class LessonCalendarPreparation(Protocol):
    async def prepare(
        self, actor: Actor, start: datetime, end: datetime, card_id: UUID | None = None
    ) -> None: ...
