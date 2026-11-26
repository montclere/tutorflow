"""Настраиваемые границы назначения и просмотра занятий."""

from dataclasses import dataclass
from datetime import timedelta

from app.modules.scheduling.domain.exceptions import LessonError


DEFAULT_PAGE_SIZE = 50


@dataclass(frozen=True)
class LessonPolicy:
    default_duration_minutes: int = 60
    min_duration_minutes: int = 5
    max_duration_minutes: int = 480
    max_participants: int = 100
    page_max_size: int = 100
    max_range_days: int = 366
    confirmation_lifetime: timedelta = timedelta(hours=48)
    conflict_limit: int = 100

    def __post_init__(self) -> None:
        if (
            not 1
            <= self.min_duration_minutes
            <= self.default_duration_minutes
            <= self.max_duration_minutes
        ):
            raise ValueError("Некорректные пределы длительности занятия")

        if min(
            self.max_participants, self.page_max_size, self.max_range_days, self.conflict_limit
        ) < 1 or self.confirmation_lifetime <= timedelta(0):
            raise ValueError("Пределы и срок согласования должны быть положительными")

    def require_duration(self, duration: int) -> None:
        if not self.min_duration_minutes <= duration <= self.max_duration_minutes:
            raise LessonError("invalid_lesson_duration")

    def require_count(self, count: int) -> None:
        if count > self.max_participants:
            raise LessonError("lesson_participant_limit")

    def page_size(self, requested: int | None) -> int:
        selected = min(DEFAULT_PAGE_SIZE, self.page_max_size) if requested is None else requested

        if not 1 <= selected <= self.page_max_size:
            raise LessonError("invalid_lesson_range")

        return selected
