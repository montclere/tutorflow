"""Авторизация и атомарное рассмотрение запросов собственного участия в занятии."""

from collections.abc import Callable
from datetime import datetime
from uuid import UUID

from app.modules.identity.public import Actor, Role
from app.modules.scheduling.application.lesson_contracts import LessonPatch
from app.modules.scheduling.application.lesson_ports import LessonsUnitOfWork, LessonTransaction
from app.modules.scheduling.application.services.lesson_access import require_limit, require_teacher
from app.modules.scheduling.application.services.lesson_cancellation import (
    LessonCancellationService,
)
from app.modules.scheduling.application.services.lesson_changes import LessonChangeService
from app.modules.scheduling.domain.change_requests import (
    ChangeKind,
    ChangeState,
    LessonChangeRequest,
)
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import Lesson
from app.modules.scheduling.domain.policies import LessonPolicy


class LessonRequestService:
    def __init__(
        self,
        persistence: LessonsUnitOfWork,
        policy: LessonPolicy,
        clock: Callable[[], datetime],
        changes: LessonChangeService,
        cancellation: LessonCancellationService,
    ) -> None:
        self.persistence = persistence
        self.policy = policy
        self.clock = clock
        self.changes = changes
        self.cancellation = cancellation

    async def accessible(
        self,
        unit: LessonTransaction,
        actor: Actor,
        lesson_id: UUID,
        card_id: UUID | None,
        *,
        write: bool,
    ) -> Lesson:
        if card_id is None:
            require_teacher(actor)

            lesson = await unit.lessons.find(lesson_id, actor.account_id)
        else:
            if actor.role not in {Role.STUDENT, Role.ADULT}:
                raise LessonError("lesson_participant_required")

            card = await unit.cards.find_accessible(card_id, actor)

            if card is None or card.archived:
                raise LessonError("lesson_not_found")

            lesson = await unit.lessons.find(lesson_id, card.teacher_id)

        if lesson is None or (
            card_id is not None and not any(part.card_id == card_id for part in lesson.participants)
        ):
            raise LessonError("lesson_not_found")

        if not write:
            return lesson

        for identifier in sorted(part.card_id for part in lesson.participants):
            await unit.cards.find_owned(identifier, lesson.teacher_id, lock=True)

        if lesson.group_id is not None:
            await unit.groups.find(lesson.group_id, lesson.teacher_id, lock=True)

        await unit.lessons.lock_calendar(lesson.teacher_id)

        locked = await unit.lessons.find(lesson.id, lesson.teacher_id, lock=True)

        if locked is None:
            raise LessonError("lesson_not_found")

        if locked.version != lesson.version:
            raise LessonError("lesson_conflict")

        if card_id is not None:
            card = await unit.cards.find_accessible(card_id, actor)
            recipient = await unit.cards.recipient(card_id)

            if card is None or card.archived:
                raise LessonError("lesson_not_found")

            if recipient.account_id != actor.account_id or recipient.role is not actor.role:
                raise LessonError("lesson_response_forbidden")

        return locked

    async def create(
        self,
        actor: Actor,
        card_id: UUID,
        lesson_id: UUID,
        expected_version: int,
        kind: ChangeKind,
        reason: str | None,
        proposed_start: datetime | None,
    ) -> LessonChangeRequest:
        async with self.persistence.transaction() as unit:
            lesson = await self.accessible(unit, actor, lesson_id, card_id, write=True)
            request = LessonChangeRequest.create(
                lesson,
                card_id,
                actor.account_id,
                kind,
                reason,
                proposed_start,
                self.clock(),
                expected_version,
            )

            await unit.requests.add(request)

            return request

    async def list_requests(
        self,
        actor: Actor,
        lesson_id: UUID,
        card_id: UUID | None,
        after_id: UUID | None,
        limit: int,
    ) -> list[LessonChangeRequest]:
        require_limit(limit, self.policy)

        async with self.persistence.transaction() as unit:
            await self.accessible(unit, actor, lesson_id, card_id, write=False)

            return await unit.requests.list_for_lesson(lesson_id, card_id, after_id, limit + 1)

    async def decide(
        self,
        actor: Actor,
        lesson_id: UUID,
        request_id: UUID,
        state: ChangeState,
        expected_version: int,
        card_id: UUID | None = None,
        starts_at: datetime | None = None,
    ) -> LessonChangeRequest:
        async with self.persistence.transaction() as unit:
            lesson = await self.accessible(unit, actor, lesson_id, card_id, write=True)
            request = await unit.requests.find(lesson_id, request_id)

            if request is None or (card_id is not None and request.card_id != card_id):
                raise LessonError("lesson_change_request_not_found")

            if card_id is not None and (
                state is not ChangeState.WITHDRAWN or request.author_id != actor.account_id
            ):
                raise LessonError("lesson_response_forbidden")

            if card_id is None and state not in {ChangeState.ACCEPTED, ChangeState.REJECTED}:
                raise LessonError("invalid_lesson_change_request")

            lesson.require_editable(self.clock(), expected_version)

            if request.lesson_version != lesson.version:
                raise LessonError("lesson_change_request_conflict")

            changed = request.decide(state, actor.account_id, self.clock())

            if state is ChangeState.ACCEPTED:
                recipient = await unit.cards.recipient(request.card_id)

                if recipient.account_id != request.author_id:
                    raise LessonError("lesson_change_request_conflict")

                if request.kind is ChangeKind.CANCEL:
                    await self.cancellation.change_in_transaction(
                        unit,
                        actor,
                        lesson_id,
                        expected_version,
                        True,
                        request.reason,
                        request.card_id if lesson.collective else None,
                    )
                else:
                    selected = starts_at or request.proposed_start

                    if selected is None:
                        raise LessonError("invalid_lesson_change_request")

                    await self.changes.update_in_transaction(
                        unit, actor, lesson_id, LessonPatch(expected_version, starts_at=selected)
                    )

            await unit.requests.save(changed)

            return changed
