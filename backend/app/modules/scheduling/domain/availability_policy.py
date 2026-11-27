"""Технические границы вычисления свободного времени и срок временного резерва."""

from dataclasses import dataclass
from datetime import timedelta

from app.modules.scheduling.domain.exceptions import LessonError


@dataclass(frozen=True)
class AvailabilityPolicy:
    reservation_hours: int = 24
    query_publications: int = 100
    slots_limit: int = 1000
    windows_limit: int = 100
    busy_limit: int = 1000
    max_window_minutes: int = 1440
    max_break_minutes: int = 480

    def __post_init__(self) -> None:
        if (
            min(
                self.reservation_hours,
                self.query_publications,
                self.slots_limit,
                self.windows_limit,
                self.busy_limit,
                self.max_window_minutes,
            )
            < 1
            or self.max_break_minutes < 0
        ):
            raise ValueError("Некорректные пределы доступности")

    @property
    def lifetime(self) -> timedelta:
        return timedelta(hours=self.reservation_hours)

    def require_count(self, count: int, maximum: int) -> None:
        if count > maximum:
            raise LessonError("availability_limit")
