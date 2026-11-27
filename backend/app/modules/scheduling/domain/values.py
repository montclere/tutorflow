"""Точные цены, ограниченный текст и момент занятия в выбранном часовом поясе."""

from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from enum import StrEnum
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.modules.scheduling.domain.exceptions import LessonError


PRICE_QUANTUM = Decimal("0.01")
MAX_PRICE = Decimal("9999999999.99")
TEXT_MAX_LENGTH = 4000
TITLE_MAX_LENGTH = 200
TIMEZONE_MAX_LENGTH = 80


def lesson_text(value: str | None, maximum: int = TEXT_MAX_LENGTH) -> str | None:
    if value is None:
        return None

    value = value.strip()

    if len(value) > maximum or any(not char.isprintable() and char not in "\n\t" for char in value):
        raise LessonError("invalid_lesson_data")

    return value or None


def utc_start(value: datetime, timezone: str) -> datetime:
    try:
        if value.tzinfo is None or value.utcoffset() is None or len(timezone) > TIMEZONE_MAX_LENGTH:
            raise ValueError

        ZoneInfo(timezone)

        return value.astimezone(UTC)
    except (ValueError, OverflowError, ZoneInfoNotFoundError) as error:
        raise LessonError("invalid_lesson_time") from error


@dataclass(frozen=True)
class LessonPrice:
    amount: Decimal

    def __post_init__(self) -> None:
        if not self.amount.is_finite() or not 0 <= self.amount <= MAX_PRICE:
            raise LessonError("invalid_lesson_price")

        normalized = self.amount.quantize(PRICE_QUANTUM)

        if self.amount != normalized:
            raise LessonError("invalid_lesson_price")

        object.__setattr__(self, "amount", normalized)


class RevisionKind(StrEnum):
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"
    REPLY = "reply"
    CANCELLED = "cancelled"
    RESTORED = "restored"
