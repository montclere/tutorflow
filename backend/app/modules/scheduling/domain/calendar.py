"""Личный календарный блок и правила интерпретации местного времени."""

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


MIN_DURATION = 5
MAX_DURATION = 480


class CalendarError(Exception):
    def __init__(self, code: str):
        self.code = code


def resolve_start(local_start: datetime, timezone: str) -> datetime:
    try:
        zone = ZoneInfo(timezone)
        instants = (local_start.replace(tzinfo=zone, fold=fold).astimezone(UTC) for fold in (0, 1))
        candidates = {
            instant
            for instant in instants
            if instant.astimezone(zone).replace(tzinfo=None) == local_start
        }
    except (OverflowError, ZoneInfoNotFoundError, ValueError) as error:
        raise CalendarError("invalid_local_start") from error

    if len(candidates) != 1:
        raise CalendarError("invalid_local_start")

    return candidates.pop()


@dataclass(frozen=True)
class CalendarBlock:
    id: UUID
    owner_id: UUID
    starts_at: datetime
    timezone: str
    duration_minutes: int

    @classmethod
    def create(
        cls,
        owner_id: UUID,
        local_start: datetime,
        timezone: str | None,
        duration_minutes: int,
        *,
        block_id: UUID | None = None,
    ) -> "CalendarBlock":
        zone = timezone or "UTC"

        if not MIN_DURATION <= duration_minutes <= MAX_DURATION:
            raise CalendarError("invalid_duration")

        return cls(
            block_id or uuid4(), owner_id, resolve_start(local_start, zone), zone, duration_minutes
        )
