"""Валидируемые настройки каналов доставки кодов Identity."""

from typing import Annotated

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


Port = Annotated[int, Field(ge=1, le=65535)]


class DeliverySettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="IDENTITY_", frozen=True, hide_input_in_errors=True, populate_by_name=True
    )
    local_mailpit: bool = False
    mailpit_port: Port = 1025
    smtp_host: str | None = None
    smtp_port: Port = 465
    smtp_from: str = "tutorflow@tutorflow.invalid"
    smtp_user: str | None = None
    smtp_password: SecretStr = SecretStr("")
    smsc_key: SecretStr | None = Field(default=None, validation_alias="IDENTITY_SMSC_API_KEY")
    smsc_sender: str | None = None
    timeout_seconds: Annotated[float, Field(gt=0, allow_inf_nan=False)] = Field(
        default=8, validation_alias="IDENTITY_DELIVERY_TIMEOUT_SECONDS"
    )
