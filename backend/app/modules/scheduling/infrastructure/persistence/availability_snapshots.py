"""Явное представление публикаций и персональных часов в JSON без HTTP-схем."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from app.modules.scheduling.application.availability_contracts import StudentHours
from app.modules.scheduling.domain.availability import (
    AvailabilityAudience,
    AvailabilityPublication,
    BookingMode,
    TimeWindow,
)
from app.modules.scheduling.domain.values import LessonPrice
from app.modules.scheduling.infrastructure.persistence.series_snapshots import (
    rule_from_snapshot,
    rule_snapshot,
)


def window_snapshot(window: TimeWindow) -> dict:
    return dict(
        starts_at=window.starts_at.isoformat(),
        ends_at=window.ends_at.isoformat(),
        recurrence=rule_snapshot(window.recurrence) if window.recurrence else None,
    )


def window_value(value: dict) -> TimeWindow:
    return TimeWindow(
        datetime.fromisoformat(value["starts_at"]),
        datetime.fromisoformat(value["ends_at"]),
        rule_from_snapshot(value["recurrence"]) if value["recurrence"] else None,
    )


def publication_snapshot(publication: AvailabilityPublication) -> dict:
    return dict(
        schema=1,
        id=str(publication.id),
        teacher_id=str(publication.teacher_id),
        windows=[window_snapshot(window) for window in publication.windows],
        timezone=publication.timezone,
        duration_minutes=publication.duration_minutes,
        step_minutes=publication.step_minutes,
        break_minutes=publication.break_minutes,
        price=str(publication.price.amount),
        mode=publication.mode,
        audience=dict(
            all_connected=publication.audience.all_connected,
            card_ids=[str(item) for item in publication.audience.card_ids],
            group_ids=[str(item) for item in publication.audience.group_ids],
        ),
        version=publication.version,
        active=publication.active,
        lesson_id=str(publication.lesson_id) if publication.lesson_id else None,
        lesson_version=publication.lesson_version,
    )


def publication_value(value: dict) -> AvailabilityPublication:
    if value["schema"] != 1:
        raise ValueError("Неизвестная версия публикации")

    audience = value["audience"]

    return AvailabilityPublication(
        UUID(value["id"]),
        UUID(value["teacher_id"]),
        tuple(window_value(window) for window in value["windows"]),
        value["timezone"],
        value["duration_minutes"],
        value["step_minutes"],
        value["break_minutes"],
        LessonPrice(Decimal(value["price"])),
        BookingMode(value["mode"]),
        AvailabilityAudience(
            audience["all_connected"],
            tuple(UUID(item) for item in audience["card_ids"]),
            tuple(UUID(item) for item in audience["group_ids"]),
        ),
        value["version"],
        value["active"],
        UUID(value["lesson_id"]) if value["lesson_id"] else None,
        value["lesson_version"],
    )


def hours_snapshot(hours: StudentHours) -> dict:
    return dict(
        free=[window_snapshot(window) for window in hours.free],
        busy=[window_snapshot(window) for window in hours.busy],
    )
