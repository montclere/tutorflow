from datetime import UTC, datetime
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import Engine, select
from sqlalchemy.orm import sessionmaker

from app.modules.scheduling.models import CalendarBlock


def resolve_start(local_start: datetime, timezone: str) -> datetime:
    """Переводит однозначное локальное время в UTC."""
    zone = ZoneInfo(timezone)
    candidates = {
        instant
        for fold in (0, 1)
        if (instant := local_start.replace(tzinfo=zone, fold=fold).astimezone(UTC))
        .astimezone(zone)
        .replace(tzinfo=None)
        == local_start
    }
    if len(candidates) != 1:
        raise ValueError("invalid_local_start")
    return candidates.pop()


class Calendar:
    def __init__(self, engine: Engine):
        self.sessions = sessionmaker(engine, expire_on_commit=False)

    def create(
        self,
        owner_id: UUID,
        local_start: datetime,
        timezone: str | None,
        duration_minutes: int,
    ) -> CalendarBlock:
        zone = timezone or "UTC"
        block = CalendarBlock(
            id=uuid4(),
            owner_id=owner_id,
            starts_at=resolve_start(local_start, zone),
            timezone=zone,
            duration_minutes=duration_minutes,
        )
        with self.sessions.begin() as db:
            db.add(block)
        return block

    def list(self, owner_id: UUID) -> list[CalendarBlock]:
        with self.sessions() as db:
            statement = (
                select(CalendarBlock)
                .where(CalendarBlock.owner_id == owner_id)
                .order_by(CalendarBlock.starts_at, CalendarBlock.id)
            )
            return list(db.scalars(statement))
