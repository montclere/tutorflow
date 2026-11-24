"""Политики срока действия и ограничений Identity."""

from dataclasses import dataclass
from datetime import timedelta

from app.modules.identity.domain.exceptions import IdentityError


REGISTRATION_CODE_DIGITS = 8
PASSWORD_MIN_LENGTH = 15
PASSWORD_MAX_LENGTH = 128


@dataclass(frozen=True)
class AttemptLimit:
    attempts: int
    period: timedelta

    def __post_init__(self) -> None:
        if self.attempts < 1 or self.period <= timedelta(0):
            raise ValueError("Лимит попыток и период должны быть положительными")


@dataclass(frozen=True)
class IdentityPolicy:
    session_lifetime: timedelta = timedelta(days=7)
    code_lifetime: timedelta = timedelta(minutes=10)
    code_cooldown: timedelta = timedelta(seconds=45)
    code_attempts: int = 5
    delivery_attempts: int = 3
    delivery_retry_delay: timedelta = timedelta(minutes=1)
    registration_ip: AttemptLimit = AttemptLimit(30, timedelta(hours=1))
    registration_contact: AttemptLimit = AttemptLimit(5, timedelta(hours=1))
    confirmation_ip: AttemptLimit = AttemptLimit(60, timedelta(minutes=10))
    login_ip: AttemptLimit = AttemptLimit(60, timedelta(minutes=10))
    login_contact: AttemptLimit = AttemptLimit(10, timedelta(minutes=10))

    def __post_init__(self) -> None:
        if self.code_attempts < 1 or self.delivery_attempts < 1:
            raise ValueError("Количество попыток должно быть положительным")

        if any(
            value <= timedelta(0)
            for value in (
                self.session_lifetime,
                self.code_lifetime,
                self.code_cooldown,
                self.delivery_retry_delay,
            )
        ):
            raise ValueError("Сроки действия и интервалы должны быть положительными")


def validate_password(password: str, *, registering: bool) -> None:
    minimum = PASSWORD_MIN_LENGTH if registering else 1

    if not minimum <= len(password) <= PASSWORD_MAX_LENGTH:
        raise IdentityError("invalid_password")


def validate_registration_code(code: str) -> None:
    if len(code) != REGISTRATION_CODE_DIGITS or not code.isascii() or not code.isdigit():
        raise IdentityError("challenge_invalid")
