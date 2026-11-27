"""Атомарная самостоятельная запись, резерв и рассмотрение текущим владельцем прав."""

from datetime import datetime
from hashlib import sha256
from uuid import UUID, uuid4

from app.modules.identity.public import Actor, Role
from app.modules.scheduling.application.availability_ports import AvailabilityTransaction
from app.modules.scheduling.application.lesson_contracts import LessonPatch, LessonRevision
from app.modules.scheduling.application.services.availability_access import AvailabilityRuntime
from app.modules.scheduling.application.services.availability_slots import AvailabilitySlotService
from app.modules.scheduling.application.services.lesson_access import require_limit, require_teacher
from app.modules.scheduling.application.services.lesson_changes import LessonChangeService
from app.modules.scheduling.domain.availability import AvailabilityPublication, BookingMode
from app.modules.scheduling.domain.bookings import Booking, BookingState
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import Lesson, LessonConditions, LessonParticipant
from app.modules.scheduling.domain.values import RevisionKind
from app.modules.students.public import CardReference


class BookingService:
    def __init__(
        self,
        runtime: AvailabilityRuntime,
        slots: AvailabilitySlotService,
        changes: LessonChangeService,
    ) -> None:
        self.runtime = runtime
        self.slots = slots
        self.changes = changes

    async def accept(
        self,
        unit: AvailabilityTransaction,
        actor: Actor,
        booking: Booking,
        publication: AvailabilityPublication,
        card: CardReference,
    ) -> Booking:
        if publication.lesson_id is not None:
            result = await self.changes.update_in_transaction(
                unit,
                Actor(card.teacher_id, Role.TEACHER, publication.timezone),
                publication.lesson_id,
                LessonPatch(publication.lesson_version or 0, starts_at=booking.starts_at),
                audit_actor_id=actor.account_id,
            )
            lesson_id = result.lesson.id

            await unit.availability.save_publication(publication.remove(publication.version))
            await unit.availability.invalidate(publication.id)
        else:
            now = self.runtime.clock()
            lesson = Lesson.create(
                card.teacher_id,
                LessonConditions(
                    booking.starts_at, publication.timezone, publication.duration_minutes
                ),
                (LessonParticipant(card.id, card.name, publication.price),),
                now,
            )

            if not await unit.lessons.add(
                lesson, None, sha256(str(booking.id).encode()).hexdigest()
            ):
                raise LessonError("booking_conflict")

            await unit.lessons.append_revision(
                LessonRevision(uuid4(), actor.account_id, now, RevisionKind.CREATED, lesson)
            )

            lesson_id = lesson.id

        return booking.decide(
            BookingState.ACCEPTED, actor.account_id, self.runtime.clock(), lesson_id
        )

    async def book(
        self,
        actor: Actor,
        card_id: UUID,
        publication_id: UUID,
        expected_version: int,
        starts_at: datetime,
        request_id: UUID,
    ) -> Booking:
        if actor.role not in {Role.STUDENT, Role.ADULT}:
            raise LessonError("lesson_participant_required")

        async with self.runtime.persistence.transaction() as unit:
            card = await self.runtime.card(unit, actor, card_id, write=True)
            initial = await unit.availability.find_publication(publication_id, card.teacher_id)

            if initial is None:
                raise LessonError("availability_not_found")

            await self.runtime.lock_groups(unit, initial)
            await unit.lessons.lock_calendar(card.teacher_id)
            await unit.availability.expire(card.teacher_id, self.runtime.clock())

            replay = await unit.availability.find_replay(card.teacher_id, card_id, request_id)

            if replay is not None:
                if (replay.publication_id, replay.publication_version, replay.starts_at) != (
                    publication_id,
                    expected_version,
                    starts_at,
                ):
                    raise LessonError("booking_conflict")

                return replay

            publication = await self.runtime.publication(unit, card.teacher_id, publication_id)

            publication.require_version(expected_version)

            if not await self.runtime.visible(unit, publication, card_id):
                raise LessonError("availability_not_found")

            if (
                publication.mode is BookingMode.APPROVAL
                and await unit.availability.pending_for_card(card.teacher_id, card_id)
            ):
                raise LessonError("booking_pending_limit")

            await self.slots.require_slot(unit, publication, starts_at, actor.account_id)

            booking = Booking.create(
                request_id,
                publication,
                card_id,
                actor.account_id,
                starts_at,
                self.runtime.clock(),
                self.runtime.policy.lifetime,
            )

            if publication.mode is BookingMode.INSTANT:
                booking = await self.accept(unit, actor, booking, publication, card)

            await unit.availability.save_booking(booking)

            return booking

    async def decide(
        self, actor: Actor, booking_id: UUID, state: BookingState, card_id: UUID | None = None
    ) -> Booking:
        if card_id is None:
            require_teacher(actor)
        elif actor.role not in {Role.STUDENT, Role.ADULT} or state is not BookingState.WITHDRAWN:
            raise LessonError("lesson_response_forbidden")

        async with self.runtime.persistence.transaction() as unit:
            if card_id is None:
                initial = await unit.availability.find_booking(booking_id, actor.account_id)

                if initial is None:
                    raise LessonError("booking_not_found")

                card = await unit.cards.find_owned(initial.card_id, actor.account_id, lock=True)
                teacher_id = actor.account_id
            else:
                card = await self.runtime.card(unit, actor, card_id, write=True)
                teacher_id = card.teacher_id
                initial = await unit.availability.find_booking(booking_id, teacher_id, card_id)

                if initial is None:
                    raise LessonError("booking_not_found")

            publication = await unit.availability.find_publication(
                initial.publication_id, teacher_id
            )

            if publication is None:
                raise LessonError("availability_not_found")

            await self.runtime.lock_groups(unit, publication)
            await unit.lessons.lock_calendar(teacher_id)
            await unit.availability.expire(teacher_id, self.runtime.clock())

            current = await unit.availability.find_booking(booking_id, teacher_id, card_id)

            if current is None:
                raise LessonError("booking_not_found")

            if state is BookingState.ACCEPTED:
                if card is None or card.archived:
                    raise LessonError("student_card_not_found")

                recipient = await unit.cards.recipient(card.id)

                if not recipient.connected or recipient.account_id is None:
                    raise LessonError("lesson_response_forbidden")

                publication = await self.runtime.publication(
                    unit, teacher_id, current.publication_id
                )

                publication.require_version(current.publication_version)

                if not await self.runtime.visible(unit, publication, card.id):
                    raise LessonError("availability_not_found")

                await self.slots.require_slot(
                    unit, publication, current.starts_at, actor.account_id, current.id
                )

                changed = await self.accept(unit, actor, current, publication, card)
            else:
                if card_id is None and state is not BookingState.REJECTED:
                    raise LessonError("invalid_availability")

                changed = current.decide(state, actor.account_id, self.runtime.clock())

            await unit.availability.save_booking(changed)

            return changed

    async def list_bookings(
        self, actor: Actor, card_id: UUID | None, after_id: UUID | None, limit: int
    ) -> list[Booking]:
        require_limit(limit, self.runtime.lesson_policy)

        async with self.runtime.persistence.transaction() as unit:
            if card_id is None:
                require_teacher(actor)

                teacher_id = actor.account_id
            else:
                card = await self.runtime.card(unit, actor, card_id)
                teacher_id = card.teacher_id

            await unit.lessons.lock_calendar(teacher_id)
            await unit.availability.expire(teacher_id, self.runtime.clock())

            return await unit.availability.bookings(teacher_id, card_id, after_id, limit + 1)
