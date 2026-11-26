"""Явное преобразование предметного снимка занятия в версионированную JSON-историю."""

import json
from dataclasses import asdict
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from app.modules.scheduling.domain.lessons import (
    Lesson,
    LessonConditions,
    LessonParticipant,
    ReplyState,
)
from app.modules.scheduling.domain.values import LessonPrice


def json_value(value: object) -> str:
    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, (UUID, Decimal)):
        return str(value)

    raise TypeError("Неподдерживаемый тип снимка занятия")


def lesson_snapshot(lesson: Lesson) -> dict[str, Any]:
    return json.loads(json.dumps(asdict(lesson), default=json_value))


def lesson_from_snapshot(value: dict[str, Any]) -> Lesson:
    conditions = value["conditions"]
    participants = tuple(
        LessonParticipant(
            UUID(item["card_id"]),
            item["name"],
            LessonPrice(Decimal(item["price"]["amount"])),
            UUID(item["profile_id"]) if item["profile_id"] else None,
            item["profile_subject"],
            ReplyState(item["state"]),
            datetime.fromisoformat(item["deadline"]) if item["deadline"] else None,
            UUID(item["response_by"]) if item["response_by"] else None,
            datetime.fromisoformat(item["replied_at"]) if item["replied_at"] else None,
        )
        for item in value["participants"]
    )

    return Lesson(
        UUID(value["id"]),
        UUID(value["teacher_id"]),
        LessonConditions(
            datetime.fromisoformat(conditions["starts_at"]),
            conditions["timezone"],
            conditions["duration_minutes"],
            conditions["title"],
            conditions["subject"],
            conditions["delivery_format"],
            conditions["private_notes"],
        ),
        participants,
        UUID(value["group_id"]) if value["group_id"] else None,
        value["group_name"],
        value["confirmation"],
        value["version"],
        value["deleted"],
    )
