"""Порты общей транзакции регулярного расписания и подготовленных занятий."""

from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from app.modules.scheduling.application.lesson_ports import LessonTransaction
from app.modules.scheduling.application.series_contracts import (
    SavedSeriesRequest,
    SeriesOccurrence,
    SeriesRevision,
)
from app.modules.scheduling.domain.series import LessonSeries


class SeriesRepository(Protocol):
    async def find(
        self, series_id: UUID, teacher_id: UUID, *, lock: bool = False
    ) -> LessonSeries | None: ...

    async def find_request(
        self, teacher_id: UUID, request_id: UUID
    ) -> SavedSeriesRequest | None: ...

    async def add(
        self, series: LessonSeries, request_id: UUID | None, fingerprint: str
    ) -> bool: ...

    async def save(self, series: LessonSeries) -> None: ...

    async def list_series(
        self,
        teacher_id: UUID,
        limit: int,
        after_id: UUID | None = None,
        card_id: UUID | None = None,
    ) -> list[LessonSeries]: ...

    async def occurrences(
        self,
        series_id: UUID,
        *,
        start: datetime | None = None,
        end: datetime | None = None,
        limit: int = 1001,
    ) -> list[SeriesOccurrence]: ...

    async def link(self, occurrence: SeriesOccurrence) -> None: ...

    async def retire(self, lesson_id: UUID) -> None: ...

    async def set_customized(self, lesson_id: UUID, customized: bool) -> None: ...

    async def set_suppressed(self, lesson_id: UUID, suppressed: bool) -> None: ...

    async def response_overrides(self, series_id: UUID, card_id: UUID) -> set[UUID]: ...

    async def append_revision(self, revision: SeriesRevision) -> None: ...

    async def history(
        self, series_id: UUID, after_id: UUID | None, limit: int
    ) -> list[SeriesRevision]: ...


@dataclass(frozen=True)
class SeriesTransaction(LessonTransaction):
    series: SeriesRepository


class SeriesUnitOfWork(Protocol):
    def transaction(self) -> AbstractAsyncContextManager[SeriesTransaction]: ...
