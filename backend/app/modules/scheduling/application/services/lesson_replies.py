"""Запись ответа только текущим ответственным за расписание конкретной карточки."""

from collections.abc import Callable
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.identity.public import Actor, Role
from app.modules.scheduling.application.lesson_contracts import LessonRevision, OwnLesson
from app.modules.scheduling.application.lesson_ports import LessonsUnitOfWork
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import ReplyState
from app.modules.scheduling.domain.values import RevisionKind


class LessonReplyService:
    def __init__(self, persistence: LessonsUnitOfWork, clock: Callable[[], datetime]) -> None:
        self.persistence = persistence
        self.clock = clock

    async def reply(
        self,
        actor: Actor,
        card_id: UUID,
        lesson_id: UUID,
        answer: ReplyState,
        expected_version: int,
    ) -> OwnLesson:
        if actor.role not in {Role.STUDENT, Role.ADULT}:
            raise LessonError("lesson_participant_required")

        async with self.persistence.transaction() as unit:
            card = await unit.cards.find_accessible(card_id, actor)

            if card is None:
                raise LessonError("lesson_not_found")

            locked = await unit.cards.find_owned(card.id, card.teacher_id, lock=True)

            if locked is None or locked.archived:
                raise LessonError("lesson_not_found")

            recipient = await unit.cards.recipient(card_id)

            if recipient.account_id != actor.account_id or recipient.role is not actor.role:
                raise LessonError("lesson_response_forbidden")

            lesson = await unit.lessons.find(lesson_id, card.teacher_id, lock=True)

            if lesson is None:
                raise LessonError("lesson_not_found")

            now = self.clock()
            changed = lesson.reply(
                card_id, answer, actor.account_id, now, expected_version=expected_version
            )

            if changed != lesson:
                await unit.lessons.save(changed)
                await unit.lessons.append_revision(
                    LessonRevision(uuid4(), actor.account_id, now, RevisionKind.REPLY, changed)
                )

            return OwnLesson(changed, card_id, True, now)
