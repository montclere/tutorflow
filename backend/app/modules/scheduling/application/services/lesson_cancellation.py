"""Транзакционная отмена и восстановление урока или участия с новым согласованием."""

from collections.abc import Callable
from dataclasses import replace
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.identity.public import Actor
from app.modules.scheduling.application.lesson_contracts import LessonResult, LessonRevision
from app.modules.scheduling.application.lesson_ports import LessonsUnitOfWork, LessonTransaction
from app.modules.scheduling.application.services.lesson_access import owned_lesson, with_warnings
from app.modules.scheduling.application.services.lesson_participants import LessonParticipantBuilder
from app.modules.scheduling.domain.policies import LessonPolicy
from app.modules.scheduling.domain.values import RevisionKind


class LessonCancellationService:
    def __init__(
        self, persistence: LessonsUnitOfWork, policy: LessonPolicy, clock: Callable[[], datetime]
    ) -> None:
        self.persistence = persistence
        self.policy = policy
        self.clock = clock

    async def change(
        self,
        actor: Actor,
        lesson_id: UUID,
        expected_version: int,
        cancelled: bool,
        reason: str | None,
        card_id: UUID | None = None,
    ) -> LessonResult:
        async with self.persistence.transaction() as unit:
            return await self.change_in_transaction(
                unit, actor, lesson_id, expected_version, cancelled, reason, card_id
            )

    async def change_in_transaction(
        self,
        unit: LessonTransaction,
        actor: Actor,
        lesson_id: UUID,
        expected_version: int,
        cancelled: bool,
        reason: str | None,
        card_id: UUID | None = None,
    ) -> LessonResult:
        initial = await owned_lesson(unit, actor, lesson_id)
        builder = LessonParticipantBuilder(self.policy)
        sources = await builder.sources(unit, actor, initial.group_id, None, initial)
        current = await owned_lesson(unit, actor, lesson_id, lock=True)
        now = self.clock()
        changed = current.change_cancellation(cancelled, reason, now, expected_version, card_id)

        if changed == current:
            return await with_warnings(unit, changed, self.policy, now)

        if not cancelled:
            parts = await builder.build(
                unit,
                sources,
                changed.conditions,
                changed.confirmation,
                None,
                now,
                previous=changed,
                reset=True,
            )

            if card_id is not None:
                by_id = {part.card_id: part for part in parts}
                parts = tuple(
                    by_id[part.card_id] if part.card_id == card_id else part
                    for part in changed.participants
                )

            changed = replace(changed, participants=parts)

        await unit.lessons.save(changed)
        await unit.lessons.mark_exception(changed.id)
        await unit.lessons.append_revision(
            LessonRevision(
                uuid4(),
                actor.account_id,
                now,
                RevisionKind.CANCELLED if cancelled else RevisionKind.RESTORED,
                changed,
            )
        )

        return await with_warnings(unit, changed, self.policy, now)
