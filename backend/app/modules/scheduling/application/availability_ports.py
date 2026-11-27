"""Порты общей транзакции доступности, резервов и конкретных экземпляров серий."""

from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from app.modules.scheduling.application.availability_contracts import StudentHours
from app.modules.scheduling.application.series_ports import SeriesTransaction
from app.modules.scheduling.domain.availability import AvailabilityPublication, BusyInterval
from app.modules.scheduling.domain.bookings import Booking


class AvailabilityRepository(Protocol):
    async def find_publication(
        self, publication_id: UUID, teacher_id: UUID
    ) -> AvailabilityPublication | None: ...

    async def publications(
        self, teacher_id: UUID, limit: int, after_id: UUID | None = None
    ) -> list[AvailabilityPublication]: ...

    async def save_publication(self, publication: AvailabilityPublication) -> None: ...

    async def invalidate(self, publication_id: UUID) -> None: ...

    async def expire(self, teacher_id: UUID, now: datetime) -> None: ...

    async def find_booking(
        self, booking_id: UUID, teacher_id: UUID, card_id: UUID | None = None
    ) -> Booking | None: ...

    async def find_replay(
        self, teacher_id: UUID, card_id: UUID, request_id: UUID
    ) -> Booking | None: ...

    async def pending_for_card(self, teacher_id: UUID, card_id: UUID) -> bool: ...

    async def bookings(
        self, teacher_id: UUID, card_id: UUID | None, after_id: UUID | None, limit: int
    ) -> list[Booking]: ...

    async def save_booking(self, booking: Booking) -> None: ...

    async def busy(
        self,
        teacher_id: UUID,
        start: datetime,
        end: datetime,
        now: datetime,
        limit: int,
        exclude_booking: UUID | None = None,
        exclude_lesson: UUID | None = None,
    ) -> tuple[BusyInterval, ...]: ...

    async def hours(self, card_id: UUID) -> StudentHours: ...

    async def save_hours(self, hours: StudentHours) -> None: ...


@dataclass(frozen=True)
class AvailabilityTransaction(SeriesTransaction):
    availability: AvailabilityRepository


class AvailabilityUnitOfWork(Protocol):
    def transaction(self) -> AbstractAsyncContextManager[AvailabilityTransaction]: ...
