"""Актуальные ячейки записи с учётом личных блоков, уроков, серий и резервов."""

from asyncio import to_thread
from datetime import datetime, timedelta
from uuid import UUID

from app.modules.identity.public import Actor
from app.modules.scheduling.application.availability_ports import AvailabilityTransaction
from app.modules.scheduling.application.services.availability_access import AvailabilityRuntime
from app.modules.scheduling.application.services.lesson_access import require_range
from app.modules.scheduling.domain.availability import (
    AvailabilityPublication,
    AvailableSlot,
    BusyInterval,
    available_slots,
    padded_range,
)
from app.modules.scheduling.domain.exceptions import LessonError


class AvailabilitySlotService:
    def __init__(self, runtime: AvailabilityRuntime) -> None:
        self.runtime = runtime

    async def busy(
        self,
        unit: AvailabilityTransaction,
        publication: AvailabilityPublication,
        start: datetime,
        end: datetime,
        exclude_booking: UUID | None = None,
    ) -> tuple[BusyInterval, ...]:
        padded_start, padded_end = padded_range(start, end, self.runtime.policy.max_break_minutes)
        rows = await unit.availability.busy(
            publication.teacher_id,
            padded_start,
            padded_end,
            self.runtime.clock(),
            self.runtime.policy.busy_limit + 1,
            exclude_booking,
            publication.lesson_id,
        )

        self.runtime.policy.require_count(len(rows), self.runtime.policy.busy_limit)

        return rows

    async def require_slot(
        self,
        unit: AvailabilityTransaction,
        publication: AvailabilityPublication,
        start: datetime,
        actor_id: UUID,
        exclude_booking: UUID | None = None,
    ) -> None:
        try:
            end = start + timedelta(minutes=publication.duration_minutes)
        except OverflowError as error:
            raise LessonError("invalid_lesson_range") from error

        padded_start, padded_end = padded_range(start, end, self.runtime.policy.max_break_minutes)

        await self.runtime.prepare_calendar(
            unit, publication.teacher_id, padded_start, padded_end, actor_id
        )

        busy = await self.busy(unit, publication, start, end, exclude_booking)
        slots = await to_thread(
            available_slots,
            publication,
            start,
            end,
            self.runtime.clock(),
            busy,
            self.runtime.policy.slots_limit,
        )

        if not any(slot.starts_at == start for slot in slots):
            raise LessonError("availability_conflict")

        if publication.lesson_id is not None:
            lesson = await unit.lessons.find(publication.lesson_id, publication.teacher_id)

            if lesson is None or lesson.version != publication.lesson_version:
                raise LessonError("availability_conflict")

    async def list_slots(
        self,
        actor: Actor,
        card_id: UUID,
        start: datetime,
        end: datetime,
        publication_id: UUID | None = None,
    ) -> tuple[AvailableSlot, ...]:
        start, end = require_range(start, end, 1, self.runtime.lesson_policy)

        async with self.runtime.persistence.transaction() as unit:
            card = await self.runtime.card(unit, actor, card_id)

            await unit.lessons.lock_calendar(card.teacher_id)

            padded_start, padded_end = padded_range(
                start, end, self.runtime.policy.max_break_minutes
            )

            await self.runtime.prepare_calendar(
                unit, card.teacher_id, padded_start, padded_end, actor.account_id
            )

            if publication_id is None:
                publications = await unit.availability.publications(
                    card.teacher_id, self.runtime.policy.query_publications + 1
                )

                self.runtime.policy.require_count(
                    len(publications), self.runtime.policy.query_publications
                )
            else:
                publications = [
                    await self.runtime.publication(unit, card.teacher_id, publication_id)
                ]

            result: list[AvailableSlot] = []
            busy_by_lesson: dict[UUID | None, tuple[BusyInterval, ...]] = {}

            for publication in publications:
                if not await self.runtime.visible(unit, publication, card_id):
                    continue

                if publication.lesson_id is not None:
                    lesson = await unit.lessons.find(publication.lesson_id, card.teacher_id)

                    if lesson is None or lesson.version != publication.lesson_version:
                        continue

                if publication.lesson_id not in busy_by_lesson:
                    busy_by_lesson[publication.lesson_id] = await self.busy(
                        unit, publication, start, end
                    )

                result.extend(
                    await to_thread(
                        available_slots,
                        publication,
                        start,
                        end,
                        self.runtime.clock(),
                        busy_by_lesson[publication.lesson_id],
                        self.runtime.policy.slots_limit,
                    )
                )

                self.runtime.policy.require_count(len(result), self.runtime.policy.slots_limit)

            return tuple(sorted(result, key=lambda slot: (slot.starts_at, slot.publication_id)))
