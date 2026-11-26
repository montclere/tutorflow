"""Текстовые значения и персональная стоимость занятия в группе."""

from dataclasses import dataclass
from decimal import Decimal

from app.modules.groups.domain.exceptions import GroupError


NAME_MAX_LENGTH = 120
NOTES_MAX_LENGTH = 4000
PRICE_QUANTUM = Decimal("0.01")
MAX_PRICE = Decimal("9999999999.99")
CURRENCY = "RUB"


def normalized_text(value: str | None, maximum: int) -> str | None:
    if value is None:
        return None

    value = value.strip()

    if len(value) > maximum or any(not ch.isprintable() and ch not in "\n\t" for ch in value):
        raise GroupError("invalid_group_data")

    return value or None


def group_name(value: str | None) -> str:
    value = normalized_text(value, NAME_MAX_LENGTH)

    if value is None or not value.isprintable():
        raise GroupError("invalid_group_data")

    return value


@dataclass(frozen=True)
class Price:
    amount: Decimal

    def __post_init__(self) -> None:
        if not self.amount.is_finite() or not 0 <= self.amount <= MAX_PRICE:
            raise GroupError("invalid_group_price")

        normalized = self.amount.quantize(PRICE_QUANTUM)

        if normalized != self.amount:
            raise GroupError("invalid_group_price")

        object.__setattr__(self, "amount", normalized)
