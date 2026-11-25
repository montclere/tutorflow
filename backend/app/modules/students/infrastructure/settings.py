"""Конфигурация сроков и ограничений Students через окружение."""

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.modules.students.domain.policies import AdultAccessPolicy, StudentPolicy


class StudentSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="TUTORFLOW_STUDENTS_",
        extra="ignore",
        env_nested_delimiter="__",
        nested_model_default_partial_update=True,
        frozen=True,
    )
    policy: StudentPolicy = StudentPolicy()
    adult_policy: AdultAccessPolicy = AdultAccessPolicy()
