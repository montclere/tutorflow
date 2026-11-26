"""Создание занятия с идемпотентным запросом и единой транзакцией снимка."""

import json
from collections.abc import Callable
from dataclasses import asdict
from datetime import UTC, datetime
from decimal import Decimal
from hashlib import sha256
from uuid import UUID, uuid4

from app.modules.identity.public import Actor
from app.modules.scheduling.application.lesson_contracts import (
    LessonDraft,
    LessonResult,
    LessonRevision,
)
from app.modules.scheduling.application.lesson_ports import LessonsUnitOfWork
from app.modules.scheduling.application.services.lesson_access import require_teacher, with_warnings
from app.modules.scheduling.application.services.lesson_participants import LessonParticipantBuilder
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import Lesson, LessonConditions
from app.modules.scheduling.domain.policies import LessonPolicy
from app.modules.scheduling.domain.values import RevisionKind


def fingerprint_value(value: object) -> str:
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat()

    if isinstance(value, (UUID, Decimal)):
        return str(value)

    raise TypeError("Неподдерживаемый тип команды занятия")


def request_fingerprint(command: LessonDraft) -> str:
    values = asdict(command)

    values.pop("request_id")

    if values["participants"] is not None:
        values["participants"] = sorted(
            values["participants"], key=lambda item: str(item["card_id"])
        )

    return sha256(
        json.dumps(
            values, default=fingerprint_value, sort_keys=True, separators=(",", ":")
        ).encode()
    ).hexdigest()


class LessonCreationService:
    def __init__(
        self, persistence: LessonsUnitOfWork, policy: LessonPolicy, clock: Callable[[], datetime]
    ) -> None:
        self.persistence = persistence
        self.policy = policy
        self.clock = clock
        self.participants = LessonParticipantBuilder(policy)

    async def create(self, actor: Actor, command: LessonDraft) -> LessonResult:
        require_teacher(actor)

        fingerprint = request_fingerprint(command)

        async with self.persistence.transaction() as unit:
            if command.request_id is not None:
                existing = await unit.lessons.find_request(actor.account_id, command.request_id)

                if existing is not None:
                    if existing.fingerprint != fingerprint:
                        raise LessonError("lesson_request_conflict")

                    return await with_warnings(unit, existing.lesson, self.policy, self.clock())

            sources = await self.participants.sources(
                unit, actor, command.group_id, command.participants
            )
            preferences = await unit.lessons.preferences(actor.account_id)
            duration = (
                command.duration_minutes
                if command.duration_minutes is not None
                else preferences.duration_minutes
            )
            duration = duration if duration is not None else self.policy.default_duration_minutes

            self.policy.require_duration(duration)

            zone = command.timezone if command.timezone is not None else actor.timezone or "UTC"
            conditions = LessonConditions(
                command.starts_at,
                zone,
                duration,
                command.title,
                command.subject,
                command.delivery_format,
                command.private_notes,
            )
            now = self.clock()
            participants = await self.participants.build(
                unit, sources, conditions, command.confirmation, preferences.price, now
            )
            lesson = Lesson.create(
                actor.account_id,
                conditions,
                participants,
                now,
                group_id=sources.group.id if sources.group else None,
                group_name=sources.group.name if sources.group else None,
                confirmation=command.confirmation,
            )

            if not await unit.lessons.add(lesson, command.request_id, fingerprint):
                existing = (
                    await unit.lessons.find_request(actor.account_id, command.request_id)
                    if command.request_id
                    else None
                )

                if existing is None or existing.fingerprint != fingerprint:
                    raise LessonError("lesson_request_conflict")

                return await with_warnings(unit, existing.lesson, self.policy, self.clock())

            await unit.lessons.append_revision(
                LessonRevision(uuid4(), actor.account_id, now, RevisionKind.CREATED, lesson)
            )

            return await with_warnings(unit, lesson, self.policy, self.clock())
