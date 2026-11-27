"""Версионированное представление календарного правила и истории серии в JSON."""

from datetime import date, datetime, time
from uuid import UUID

from app.modules.scheduling.domain.recurrence import Frequency, RecurrenceRule, WeeklySlot
from app.modules.scheduling.domain.series import LessonSeries, SeriesPause, SeriesSegment
from app.modules.scheduling.infrastructure.persistence.lesson_snapshots import (
    lesson_from_snapshot,
    lesson_snapshot,
)


def rule_snapshot(rule: RecurrenceRule) -> dict:
    return dict(
        first_date=rule.first_date.isoformat(),
        starts_at=rule.starts_at.isoformat(),
        timezone=rule.timezone,
        frequency=rule.frequency,
        interval=rule.interval,
        weekly_slots=[
            dict(
                weekday=slot.weekday,
                starts_at=slot.starts_at.isoformat(),
                duration_minutes=slot.duration_minutes,
            )
            for slot in rule.weekly_slots
        ],
        until=rule.until.isoformat() if rule.until else None,
        count=rule.count,
        duration_minutes=rule.duration_minutes,
        ambiguous_time=rule.ambiguous_time,
        nonexistent_time=rule.nonexistent_time,
    )


def rule_from_snapshot(value: dict) -> RecurrenceRule:
    return RecurrenceRule(
        date.fromisoformat(value["first_date"]),
        time.fromisoformat(value["starts_at"]),
        value["timezone"],
        Frequency(value["frequency"]),
        value["interval"],
        tuple(
            WeeklySlot(
                slot["weekday"], time.fromisoformat(slot["starts_at"]), slot["duration_minutes"]
            )
            for slot in value["weekly_slots"]
        ),
        date.fromisoformat(value["until"]) if value["until"] else None,
        value["count"],
        value["duration_minutes"],
        value["ambiguous_time"],
        value["nonexistent_time"],
    )


def series_snapshot(series: LessonSeries) -> dict:
    return dict(
        schema=1,
        id=str(series.id),
        teacher_id=str(series.teacher_id),
        created_at=series.created_at.isoformat(),
        version=series.version,
        deleted=series.deleted,
        pauses=[
            dict(
                id=str(pause.id),
                starts_at=pause.starts_at.isoformat(),
                ends_at=pause.ends_at.isoformat() if pause.ends_at else None,
            )
            for pause in series.pauses
        ],
        segments=[
            dict(
                id=str(segment.id),
                rule=rule_snapshot(segment.rule),
                template=lesson_snapshot(segment.template),
                effective_at=segment.effective_at.isoformat(),
                until_at=segment.until_at.isoformat() if segment.until_at else None,
            )
            for segment in series.segments
        ],
    )


def series_from_snapshot(value: dict) -> LessonSeries:
    if value["schema"] != 1:
        raise ValueError("Неизвестная версия снимка серии")

    return LessonSeries(
        UUID(value["id"]),
        UUID(value["teacher_id"]),
        datetime.fromisoformat(value["created_at"]),
        tuple(
            SeriesSegment(
                UUID(item["id"]),
                rule_from_snapshot(item["rule"]),
                lesson_from_snapshot(item["template"]),
                datetime.fromisoformat(item["effective_at"]),
                datetime.fromisoformat(item["until_at"]) if item["until_at"] else None,
            )
            for item in value["segments"]
        ),
        tuple(
            SeriesPause(
                UUID(item["id"]),
                datetime.fromisoformat(item["starts_at"]),
                datetime.fromisoformat(item["ends_at"]) if item["ends_at"] else None,
            )
            for item in value["pauses"]
        ),
        value["version"],
        value["deleted"],
    )
