"""Ограниченные списки, история преподавателя и безопасный обзор собственного участия."""

from collections.abc import Callable
from datetime import datetime
from uuid import UUID

from app.modules.identity.public import Actor, Role
from app.modules.scheduling.application.lesson_contracts import (
    LessonCursor,
    LessonResult,
    LessonRevision,
    OwnLesson,
)
from app.modules.scheduling.application.lesson_ports import (
    LessonCalendarPreparation,
    LessonsUnitOfWork,
)
from app.modules.scheduling.application.services.lesson_access import (
    owned_lesson,
    require_limit,
    require_range,
    require_teacher,
    with_warnings,
)
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import Lesson
from app.modules.scheduling.domain.policies import LessonPolicy
from app.modules.students.public import CardReference, ConfirmationRecipient


class LessonQueryService:
    def __init__(
        self,
        persistence: LessonsUnitOfWork,
        policy: LessonPolicy,
        clock: Callable[[], datetime],
        preparation: LessonCalendarPreparation | None = None,
    ) -> None:
        self.persistence = persistence
        self.policy = policy
        self.clock = clock
        self.preparation = preparation

    async def get(self, actor: Actor, lesson_id: UUID) -> LessonResult:
        async with self.persistence.transaction() as unit:
            lesson = await owned_lesson(unit, actor, lesson_id)

            return await with_warnings(unit, lesson, self.policy, self.clock())

    async def list_lessons(
        self,
        actor: Actor,
        start: datetime,
        end: datetime,
        cursor: LessonCursor | None,
        limit: int,
        group_id: UUID | None = None,
    ) -> list[LessonResult]:
        require_teacher(actor)

        start, end = require_range(start, end, limit, self.policy)

        if self.preparation is not None:
            await self.preparation.prepare(actor, start, end)

        async with self.persistence.transaction() as unit:
            lessons = await unit.lessons.for_teacher(
                actor.account_id, start, end, cursor, limit + 1, group_id
            )
            now = self.clock()

            return [LessonResult(lesson, now) for lesson in lessons]

    async def history(
        self, actor: Actor, lesson_id: UUID, after_id: UUID | None, limit: int
    ) -> list[LessonRevision]:
        require_limit(limit, self.policy)

        async with self.persistence.transaction() as unit:
            await owned_lesson(unit, actor, lesson_id, include_deleted=True)

            return await unit.lessons.history(lesson_id, after_id, limit + 1)

    def own_view(
        self,
        actor: Actor,
        card: CardReference,
        recipient: ConfirmationRecipient,
        lesson: Lesson,
        now: datetime,
    ) -> OwnLesson:
        participant = next((part for part in lesson.participants if part.card_id == card.id), None)

        if participant is None:
            raise LessonError("lesson_not_found")

        can_reply = (
            not card.archived
            and recipient.account_id == actor.account_id
            and recipient.role is actor.role
            and participant.deadline is not None
            and participant.deadline > now
            and lesson.conditions.starts_at > now
        )

        return OwnLesson(lesson, card.id, can_reply, now)

    async def get_own(self, actor: Actor, card_id: UUID, lesson_id: UUID) -> OwnLesson:
        if actor.role not in {Role.STUDENT, Role.ADULT}:
            raise LessonError("lesson_participant_required")

        async with self.persistence.transaction() as unit:
            card = await unit.cards.find_accessible(card_id, actor, include_archived=True)

            if card is None:
                raise LessonError("lesson_not_found")

            lesson = await unit.lessons.find(lesson_id, card.teacher_id)

            if lesson is None:
                raise LessonError("lesson_not_found")

            recipient = await unit.cards.recipient(card_id)

            return self.own_view(actor, card, recipient, lesson, self.clock())

    async def list_own(
        self,
        actor: Actor,
        card_id: UUID,
        start: datetime,
        end: datetime,
        cursor: LessonCursor | None,
        limit: int,
        group_id: UUID | None = None,
    ) -> list[OwnLesson]:
        if actor.role not in {Role.STUDENT, Role.ADULT}:
            raise LessonError("lesson_participant_required")

        start, end = require_range(start, end, limit, self.policy)

        if self.preparation is not None:
            await self.preparation.prepare(actor, start, end, card_id)

        async with self.persistence.transaction() as unit:
            card = await unit.cards.find_accessible(card_id, actor, include_archived=True)

            if card is None:
                raise LessonError("lesson_not_found")

            lessons = await unit.lessons.for_card(
                card_id, card.teacher_id, start, end, cursor, limit + 1, group_id
            )

            recipient = await unit.cards.recipient(card_id)
            now = self.clock()

            return [self.own_view(actor, card, recipient, lesson, now) for lesson in lessons]

    async def list_for_group(
        self,
        actor: Actor,
        group_id: UUID,
        start: datetime,
        end: datetime,
        cursor: LessonCursor | None,
        limit: int,
    ) -> list[LessonResult]:
        require_teacher(actor)

        start, end = require_range(start, end, limit, self.policy)

        if self.preparation is not None:
            await self.preparation.prepare(actor, start, end)

        async with self.persistence.transaction() as unit:
            if await unit.groups.find(group_id, actor.account_id, lock=False) is None:
                raise LessonError("group_not_found")

            lessons = await unit.lessons.for_teacher(
                actor.account_id, start, end, cursor, limit + 1, group_id
            )
            now = self.clock()

            return [LessonResult(lesson, now) for lesson in lessons]
