"""Версионированные изменения и удаление будущего занятия с сохранением истории."""

from collections.abc import Callable
from dataclasses import replace
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.identity.public import Actor
from app.modules.scheduling.application.lesson_contracts import (
    LessonPatch,
    LessonResult,
    LessonRevision,
)
from app.modules.scheduling.application.lesson_ports import LessonsUnitOfWork, LessonTransaction
from app.modules.scheduling.application.services.lesson_access import owned_lesson, with_warnings
from app.modules.scheduling.application.services.lesson_participants import LessonParticipantBuilder
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.policies import LessonPolicy
from app.modules.scheduling.domain.values import RevisionKind


TEXT_FIELDS = frozenset({"title", "subject", "delivery_format", "private_notes"})


class LessonChangeService:
    def __init__(
        self, persistence: LessonsUnitOfWork, policy: LessonPolicy, clock: Callable[[], datetime]
    ) -> None:
        self.persistence = persistence
        self.policy = policy
        self.clock = clock
        self.participants = LessonParticipantBuilder(policy)

    async def update(self, actor: Actor, lesson_id: UUID, command: LessonPatch) -> LessonResult:
        async with self.persistence.transaction() as unit:
            return await self.update_in_transaction(unit, actor, lesson_id, command)

    async def update_in_transaction(
        self, unit: LessonTransaction, actor: Actor, lesson_id: UUID, command: LessonPatch
    ) -> LessonResult:
        initial = await owned_lesson(unit, actor, lesson_id)
        sources = await self.participants.sources(
            unit, actor, initial.group_id, command.participants, initial
        )
        current = await owned_lesson(unit, actor, lesson_id, lock=True)
        now = self.clock()

        current.require_editable(now, command.expected_version)

        if command.text_changes.keys() - TEXT_FIELDS:
            raise LessonError("invalid_lesson_data")

        conditions = replace(current.conditions, **command.text_changes)

        if command.starts_at is not None:
            conditions = replace(conditions, starts_at=command.starts_at)

        if command.timezone is not None:
            conditions = replace(conditions, timezone=command.timezone)

        if command.duration_minutes is not None:
            conditions = replace(conditions, duration_minutes=command.duration_minutes)

        self.policy.require_duration(conditions.duration_minutes)

        confirmation = (
            current.confirmation if command.confirmation is None else command.confirmation
        )
        preferences = await unit.lessons.preferences(actor.account_id)
        participants = await self.participants.build(
            unit,
            sources,
            conditions,
            confirmation,
            preferences.price,
            now,
            previous=current,
            reset=command.reset_confirmations,
        )
        changed = current.revise(
            conditions, participants, confirmation, now, command.expected_version
        )

        await unit.lessons.save(changed)
        await unit.lessons.mark_exception(changed.id)
        await unit.lessons.append_revision(
            LessonRevision(uuid4(), actor.account_id, now, RevisionKind.UPDATED, changed)
        )

        return await with_warnings(unit, changed, self.policy, self.clock())

    async def remove(self, actor: Actor, lesson_id: UUID, expected_version: int) -> None:
        async with self.persistence.transaction() as unit:
            initial = await owned_lesson(unit, actor, lesson_id)

            for card_id in sorted(participant.card_id for participant in initial.participants):
                await unit.cards.find_owned(card_id, actor.account_id, lock=True)

            await unit.lessons.lock_calendar(actor.account_id)

            current = await owned_lesson(unit, actor, lesson_id, lock=True)
            now = self.clock()
            changed = current.remove(now, expected_version)

            await unit.lessons.save(changed)
            await unit.lessons.mark_exception(changed.id)
            await unit.lessons.append_revision(
                LessonRevision(uuid4(), actor.account_id, now, RevisionKind.DELETED, changed)
            )
