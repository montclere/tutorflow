"""Проверяемые параметры длительности, согласования и ограниченных выборок занятий."""

from datetime import timedelta

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.modules.scheduling.domain.availability_policy import AvailabilityPolicy
from app.modules.scheduling.domain.policies import LessonPolicy, SeriesPolicy


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


class SeriesSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SCHEDULING_SERIES_", extra="ignore")
    preparation_days: int = Field(default=90, ge=1)
    expansion_limit: int = Field(default=1000, ge=1)
    scan_limit: int = Field(default=100_000, ge=1)
    query_series_limit: int = Field(default=100, ge=1)

    @property
    def policy(self) -> SeriesPolicy:
        return SeriesPolicy(**self.model_dump())


class AvailabilitySettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SCHEDULING_AVAILABILITY_", extra="ignore")
    reservation_hours: int = Field(default=24, ge=1)
    query_publications: int = Field(default=100, ge=1)
    slots_limit: int = Field(default=1000, ge=1)
    windows_limit: int = Field(default=100, ge=1)
    busy_limit: int = Field(default=1000, ge=1)
    max_window_minutes: int = Field(default=1440, ge=1)
    max_break_minutes: int = Field(default=480, ge=0)

    @property
    def policy(self) -> AvailabilityPolicy:
        return AvailabilityPolicy(**self.model_dump())
