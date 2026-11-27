"""Публикация и изменение свободного времени и альтернатив индивидуального занятия."""

from dataclasses import replace
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.identity.public import Actor
from app.modules.scheduling.application.availability_contracts import PublicationDraft
from app.modules.scheduling.application.services.availability_access import AvailabilityRuntime
from app.modules.scheduling.application.services.lesson_access import (
    owned_lesson,
    require_limit,
    require_teacher,
)
from app.modules.scheduling.domain.availability import (
    AvailabilityAudience,
    AvailabilityPublication,
    BookingMode,
    TimeWindow,
)
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import LessonConditions


class PublicationService:
    def __init__(self, runtime: AvailabilityRuntime) -> None:
        self.runtime = runtime

    def build(self, actor: Actor, draft: PublicationDraft) -> AvailabilityPublication:
        require_teacher(actor)

        self.runtime.validate_windows(draft.windows)

        duration = draft.duration_minutes or self.runtime.lesson_policy.default_duration_minutes
        step = draft.step_minutes or duration

        self.runtime.lesson_policy.require_duration(duration)

        if (
            not 1 <= step <= self.runtime.policy.max_window_minutes
            or not 0 <= draft.break_minutes <= self.runtime.policy.max_break_minutes
        ):
            raise LessonError("invalid_availability")

        return AvailabilityPublication(
            uuid4(),
            actor.account_id,
            draft.windows,
            draft.timezone,
            duration,
            step,
            draft.break_minutes,
            draft.price,
            draft.mode,
            draft.audience,
        )

    async def create(self, actor: Actor, draft: PublicationDraft) -> AvailabilityPublication:
        publication = self.build(actor, draft)

        async with self.runtime.persistence.transaction() as unit:
            await self.runtime.validate_audience(unit, actor, publication)
            await unit.lessons.lock_calendar(actor.account_id)
            await unit.availability.save_publication(publication)

            return publication

    async def update(
        self, actor: Actor, publication_id: UUID, expected_version: int, draft: PublicationDraft
    ) -> AvailabilityPublication:
        replacement = self.build(actor, draft)

        async with self.runtime.persistence.transaction() as unit:
            await self.runtime.validate_audience(unit, actor, replacement)
            await unit.lessons.lock_calendar(actor.account_id)

            current = await self.runtime.publication(unit, actor.account_id, publication_id)

            current.require_version(expected_version)

            if current.lesson_id is not None:
                raise LessonError("availability_conflict")

            changed = replace(replacement, id=current.id, version=current.version + 1)

            await unit.availability.invalidate(current.id)
            await unit.availability.save_publication(changed)

            return changed

    async def remove(self, actor: Actor, publication_id: UUID, expected_version: int) -> None:
        require_teacher(actor)

        async with self.runtime.persistence.transaction() as unit:
            await unit.lessons.lock_calendar(actor.account_id)

            current = await self.runtime.publication(unit, actor.account_id, publication_id)
            changed = current.remove(expected_version)

            await unit.availability.invalidate(current.id)
            await unit.availability.save_publication(changed)

    async def list_publications(
        self, actor: Actor, limit: int, after_id: UUID | None
    ) -> list[AvailabilityPublication]:
        require_teacher(actor)
        require_limit(limit, self.runtime.lesson_policy)

        async with self.runtime.persistence.transaction() as unit:
            return await unit.availability.publications(actor.account_id, limit + 1, after_id)

    async def alternatives(
        self, actor: Actor, lesson_id: UUID, expected_version: int, starts: tuple[datetime, ...]
    ) -> AvailabilityPublication:
        require_teacher(actor)

        self.runtime.policy.require_count(len(starts), self.runtime.policy.windows_limit)

        if not starts or len(set(starts)) != len(starts):
            raise LessonError("invalid_availability")

        async with self.runtime.persistence.transaction() as unit:
            initial = await owned_lesson(unit, actor, lesson_id)

            if initial.collective:
                raise LessonError("group_reschedule_forbidden")

            for part in initial.participants:
                await self.runtime.card(unit, actor, part.card_id, write=True)

            await unit.lessons.lock_calendar(actor.account_id)

            lesson = await owned_lesson(unit, actor, lesson_id, lock=True)

            lesson.require_editable(self.runtime.clock(), expected_version)

            if any(start <= self.runtime.clock() for start in starts):
                raise LessonError("invalid_lesson_time")

            duration = lesson.conditions.duration_minutes
            windows = tuple(
                TimeWindow(
                    start, LessonConditions(start, lesson.conditions.timezone, duration).ends_at
                )
                for start in starts
            )
            publication = AvailabilityPublication(
                uuid4(),
                actor.account_id,
                windows,
                lesson.conditions.timezone,
                duration,
                duration,
                0,
                lesson.participants[0].price,
                BookingMode.INSTANT,
                AvailabilityAudience(False, (lesson.participants[0].card_id,)),
                lesson_id=lesson.id,
                lesson_version=lesson.version,
            )

            await unit.availability.save_publication(publication)

            return publication
