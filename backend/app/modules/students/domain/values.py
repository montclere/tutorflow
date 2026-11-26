"""Значения текста, стоимости и изменений карточек."""

from dataclasses import dataclass
from decimal import Decimal

from app.modules.students.domain.exceptions import StudentError


MAX_ADULT_CONNECTIONS = 2
NAME_MAX_LENGTH = 120
TEXT_MAX_LENGTH = 4000
WELCOME_MAX_LENGTH = 2000
MONEY_QUANTUM = Decimal("0.01")
MAX_AMOUNT = Decimal("9999999999.99")
CURRENCY = "RUB"


def optional_text(value: str | None, maximum: int = TEXT_MAX_LENGTH) -> str | None:
    if value is None:
        return None

    value = value.strip()

    if len(value) > maximum or any(
        not character.isprintable() and character not in "\n\t" for character in value
    ):
        raise StudentError("invalid_student_data")

    return value or None


def card_name(value: str) -> str:
    normalized = optional_text(value, NAME_MAX_LENGTH)

    if normalized is None or not normalized.isprintable():
        raise StudentError("invalid_student_data")

    return normalized


@dataclass(frozen=True)
class Money:
    amount: Decimal
    currency: str = CURRENCY

    def __post_init__(self) -> None:
        if (
            self.currency != CURRENCY
            or not self.amount.is_finite()
            or not 0 <= self.amount <= MAX_AMOUNT
        ):
            raise StudentError("invalid_student_price")

        normalized = self.amount.quantize(MONEY_QUANTUM)

        if normalized != self.amount:
            raise StudentError("invalid_student_price")

        object.__setattr__(self, "amount", normalized)
