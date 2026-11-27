"""Команды публикации свободного времени и персональных часов ученика."""

from dataclasses import dataclass
from uuid import UUID

from app.modules.scheduling.domain.availability import AvailabilityAudience, BookingMode, TimeWindow
from app.modules.scheduling.domain.values import LessonPrice


@dataclass(frozen=True)
class PublicationDraft:
    windows: tuple[TimeWindow, ...]
    timezone: str
    duration_minutes: int | None
    step_minutes: int | None
    break_minutes: int
    price: LessonPrice
    mode: BookingMode
    audience: AvailabilityAudience


@dataclass(frozen=True)
class StudentHours:
    card_id: UUID
    version: int = 0
    free: tuple[TimeWindow, ...] = ()
    busy: tuple[TimeWindow, ...] = ()
