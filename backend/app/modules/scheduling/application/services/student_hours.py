"""Публикация собственных удобных часов и безопасные подсказки преподавателю."""

from asyncio import to_thread
from datetime import datetime
from uuid import UUID

from app.modules.identity.public import Actor, Role
from app.modules.scheduling.application.availability_contracts import StudentHours
from app.modules.scheduling.application.services.availability_access import AvailabilityRuntime
from app.modules.scheduling.application.services.availability_slots import AvailabilitySlotService
from app.modules.scheduling.application.services.lesson_access import require_range, require_teacher
from app.modules.scheduling.domain.availability import AvailableSlot, TimeWindow, free_intervals
from app.modules.scheduling.domain.exceptions import LessonError


class StudentHoursService:
    def __init__(self, runtime: AvailabilityRuntime, slots: AvailabilitySlotService) -> None:
        self.runtime = runtime
        self.slots = slots

    async def own(self, actor: Actor, card_id: UUID) -> StudentHours:
        if actor.role not in {Role.STUDENT, Role.ADULT}:
            raise LessonError("lesson_participant_required")

        async with self.runtime.persistence.transaction() as unit:
            await self.runtime.card(unit, actor, card_id)

            return await unit.availability.hours(card_id)

    async def update(
        self,
        actor: Actor,
        card_id: UUID,
        expected_version: int,
        free: tuple[TimeWindow, ...],
        busy: tuple[TimeWindow, ...],
    ) -> StudentHours:
        if actor.role not in {Role.STUDENT, Role.ADULT}:
            raise LessonError("lesson_participant_required")

        self.runtime.validate_windows(free + busy)

        async with self.runtime.persistence.transaction() as unit:
            await self.runtime.card(unit, actor, card_id, write=True)

            current = await unit.availability.hours(card_id)

            if current.version != expected_version:
                raise LessonError("availability_conflict")

            changed = StudentHours(card_id, current.version + 1, free, busy)

            await unit.availability.save_hours(changed)

            return changed

    async def free(
        self, actor: Actor, card_id: UUID, start: datetime, end: datetime
    ) -> tuple[TimeWindow, ...]:
        require_teacher(actor)

        start, end = require_range(start, end, 1, self.runtime.lesson_policy)

        async with self.runtime.persistence.transaction() as unit:
            await self.runtime.card(unit, actor, card_id)

            hours = await unit.availability.hours(card_id)

        return await to_thread(
            free_intervals, hours.free, hours.busy, start, end, self.runtime.policy.slots_limit
        )

    async def matches(
        self, actor: Actor, card_id: UUID, start: datetime, end: datetime
    ) -> tuple[AvailableSlot, ...]:
        free = await self.free(actor, card_id, start, end)
        slots = await self.slots.list_slots(actor, card_id, start, end)

        return tuple(
            slot
            for slot in slots
            if any(
                window.starts_at <= slot.starts_at and window.ends_at >= slot.ends_at
                for window in free
            )
        )
