"""Параметры Argon2id и ограничение вычислений в одном процессе."""

from typing import Annotated

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


MINIMUM_MEMORY_KIB = 19 * 1024
MINIMUM_TIME_COST = 2


class PasswordHashingSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="IDENTITY_ARGON_", frozen=True, hide_input_in_errors=True
    )
    memory_kib: Annotated[int, Field(ge=MINIMUM_MEMORY_KIB)] = MINIMUM_MEMORY_KIB
    time_cost: Annotated[int, Field(ge=MINIMUM_TIME_COST)] = MINIMUM_TIME_COST
    parallelism: Annotated[int, Field(ge=1)] = 1
    max_concurrent: Annotated[int, Field(ge=1)] = 2
    wait_timeout_seconds: Annotated[float, Field(gt=0, allow_inf_nan=False)] = 1
