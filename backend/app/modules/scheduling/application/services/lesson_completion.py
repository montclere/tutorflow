"""Ручная фиксация и исправление результата с атомарной историей преподавателя."""

from collections.abc import Callable
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.identity.public import Actor
from app.modules.scheduling.application.lesson_contracts import LessonResult, LessonRevision
from app.modules.scheduling.application.lesson_ports import (
    LessonCalendarPreparation,
    LessonsUnitOfWork,
)
from app.modules.scheduling.application.services.lesson_access import (
    owned_lesson,
    require_range,
    require_teacher,
)
from app.modules.scheduling.domain.completion import Attendance, LessonOutcome
from app.modules.scheduling.domain.policies import LessonPolicy
from app.modules.scheduling.domain.values import RevisionKind


class LessonCompletionService:
    def __init__(
        self,
        persistence: LessonsUnitOfWork,
        policy: LessonPolicy,
        clock: Callable[[], datetime],
        preparation: LessonCalendarPreparation,
    ) -> None:
        self.persistence = persistence
        self.policy = policy
        self.clock = clock
        self.preparation = preparation

    async def complete(
        self,
        actor: Actor,
        lesson_id: UUID,
        expected_version: int,
        outcome: LessonOutcome,
        attendance: dict[UUID, Attendance],
        notes: str | None,
    ) -> LessonResult:
        async with self.persistence.transaction() as unit:
            initial = await owned_lesson(unit, actor, lesson_id)

            for card_id in sorted(part.card_id for part in initial.participants):
                await unit.cards.find_owned(card_id, actor.account_id, lock=True)

            await unit.lessons.lock_calendar(actor.account_id)

            current = await owned_lesson(unit, actor, lesson_id, lock=True)
            now = self.clock()
            changed = current.complete(outcome, attendance, notes, now, expected_version)

            await unit.lessons.save(changed)
            await unit.lessons.mark_exception(changed.id)
            await unit.lessons.append_revision(
                LessonRevision(uuid4(), actor.account_id, now, RevisionKind.COMPLETED, changed)
            )

            return LessonResult(changed, now)

    async def unfinished(
        self, actor: Actor, start: datetime, end: datetime, limit: int, after_id: UUID | None
    ) -> list[LessonResult]:
        require_teacher(actor)

        start, end = require_range(start, end, limit, self.policy)

        now = self.clock()

        if start >= now:
            return []

        await self.preparation.prepare(actor, start, min(end, now))

        async with self.persistence.transaction() as unit:
            lessons = await unit.lessons.unfinished(
                actor.account_id, start, end, now, after_id, limit + 1
            )

            return [LessonResult(lesson, now) for lesson in lessons]
