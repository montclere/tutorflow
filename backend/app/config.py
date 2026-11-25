"""Валидируемая конфигурация процесса из переменных окружения."""

from pathlib import Path
from typing import Annotated

from pydantic import Field, SecretBytes, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.modules.identity.domain.policies import IdentityPolicy
from app.modules.identity.infrastructure.delivery.settings import DeliverySettings
from app.modules.identity.infrastructure.security.settings import PasswordHashingSettings
from app.modules.identity.infrastructure.security.tokens import MINIMUM_SECRET_BYTES


DEFAULT_METRICS_DIRECTORY = Path(__file__).resolve().parents[2] / ".artifacts" / "metrics"


class DatabaseSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="IDENTITY_",
        frozen=True,
        hide_input_in_errors=True,
        env_nested_delimiter="__",
        nested_model_default_partial_update=True,
    )
    database_url: Annotated[SecretStr, Field(min_length=1)]


class MonitoringSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="TUTORFLOW_METRICS_", frozen=True, hide_input_in_errors=True
    )
    token: SecretStr = SecretStr("")
    directory: Path = DEFAULT_METRICS_DIRECTORY


class Settings(DatabaseSettings):
    identity_secret: Annotated[
        SecretBytes, Field(min_length=MINIMUM_SECRET_BYTES, validation_alias="IDENTITY_SECRET")
    ]
    secure_cookie: bool = True
    delivery: DeliverySettings = Field(default_factory=DeliverySettings)
    policy: IdentityPolicy = IdentityPolicy()
    password_hashing: PasswordHashingSettings = Field(default_factory=PasswordHashingSettings)


def database_url() -> str:
    return DatabaseSettings.model_validate({}).database_url.get_secret_value()
