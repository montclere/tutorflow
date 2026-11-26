"""Проверяемые параметры длительности, согласования и ограниченных выборок занятий."""

from datetime import timedelta

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.modules.scheduling.domain.policies import LessonPolicy


class LessonSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SCHEDULING_", extra="ignore")
    default_duration_minutes: int = Field(default=60, ge=1)
    min_duration_minutes: int = Field(default=5, ge=1)
    max_duration_minutes: int = Field(default=480, ge=1)
    max_participants: int = Field(default=100, ge=1)
    page_max_size: int = Field(default=100, ge=1)
    max_range_days: int = Field(default=366, ge=1)
    confirmation_hours: int = Field(default=48, ge=1)
    conflict_limit: int = Field(default=100, ge=1)

    @property
    def policy(self) -> LessonPolicy:
        return LessonPolicy(
            self.default_duration_minutes,
            self.min_duration_minutes,
            self.max_duration_minutes,
            self.max_participants,
            self.page_max_size,
            self.max_range_days,
            timedelta(hours=self.confirmation_hours),
            self.conflict_limit,
        )
