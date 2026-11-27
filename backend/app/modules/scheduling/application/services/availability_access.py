"""Общие проверки прав, блокировок и вычислительных границ доступности."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from app.modules.identity.public import Actor, Role
from app.modules.scheduling.application.availability_ports import (
    AvailabilityTransaction,
    AvailabilityUnitOfWork,
)
from app.modules.scheduling.application.services.lesson_access import require_teacher
from app.modules.scheduling.application.services.series_access import SeriesRuntime
from app.modules.scheduling.domain.availability import AvailabilityPublication, TimeWindow
from app.modules.scheduling.domain.availability_policy import AvailabilityPolicy
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.policies import LessonPolicy
from app.modules.students.public import CardReference


@dataclass(frozen=True)
class AvailabilityRuntime:
    persistence: AvailabilityUnitOfWork
    policy: AvailabilityPolicy
    lesson_policy: LessonPolicy
    series: SeriesRuntime
    clock: Callable[[], datetime]

    async def card(
        self, unit: AvailabilityTransaction, actor: Actor, card_id: UUID, *, write: bool = False
    ) -> CardReference:
        if actor.role is Role.TEACHER:
            card = await unit.cards.find_owned(card_id, actor.account_id, lock=write)
        elif actor.role in {Role.STUDENT, Role.ADULT}:
            card = await unit.cards.find_accessible(card_id, actor)

            if card is not None and write:
                await unit.cards.find_owned(card.id, card.teacher_id, lock=True)

                card = await unit.cards.find_accessible(card_id, actor)
        else:
            raise LessonError("lesson_participant_required")

        if card is None or card.archived:
            raise LessonError("student_card_not_found")

        if write and actor.role is not Role.TEACHER:
            recipient = await unit.cards.recipient(card_id)

            if recipient.account_id != actor.account_id or recipient.role is not actor.role:
                raise LessonError("lesson_response_forbidden")

        return card

    async def publication(
        self, unit: AvailabilityTransaction, teacher_id: UUID, publication_id: UUID
    ) -> AvailabilityPublication:
        publication = await unit.availability.find_publication(publication_id, teacher_id)

        if publication is None or not publication.active:
            raise LessonError("availability_not_found")

        return publication

    async def lock_groups(
        self, unit: AvailabilityTransaction, publication: AvailabilityPublication
    ) -> None:
        for group_id in sorted(publication.audience.group_ids):
            await unit.groups.find(group_id, publication.teacher_id, lock=True)

    async def visible(
        self, unit: AvailabilityTransaction, publication: AvailabilityPublication, card_id: UUID
    ) -> bool:
        if publication.audience.all_connected or card_id in publication.audience.card_ids:
            return True

        for group_id in publication.audience.group_ids:
            group = await unit.groups.find(group_id, publication.teacher_id, lock=False)

            if (
                group is not None
                and not group.archived
                and card_id in await unit.groups.prices(group_id, (card_id,))
            ):
                return True

        return False

    def validate_windows(self, windows: tuple[TimeWindow, ...]) -> None:
        self.policy.require_count(len(windows), self.policy.windows_limit)

        for window in windows:
            if window.ends_at - window.starts_at > timedelta(
                minutes=self.policy.max_window_minutes
            ):
                raise LessonError("invalid_availability")

            if window.recurrence is not None:
                rule = window.recurrence
                maximum = max(
                    (slot.duration_minutes for slot in rule.weekly_slots),
                    default=rule.duration_minutes,
                )

                if maximum > self.policy.max_window_minutes:
                    raise LessonError("invalid_availability")

    async def validate_audience(
        self, unit: AvailabilityTransaction, actor: Actor, publication: AvailabilityPublication
    ) -> None:
        require_teacher(actor)

        self.policy.require_count(
            len(publication.audience.card_ids) + len(publication.audience.group_ids),
            self.policy.windows_limit,
        )

        for card_id in sorted(publication.audience.card_ids):
            await self.card(unit, actor, card_id, write=True)

        for group_id in sorted(publication.audience.group_ids):
            group = await unit.groups.find(group_id, actor.account_id, lock=True)

            if group is None or group.archived:
                raise LessonError("group_not_found")

    async def prepare_calendar(
        self,
        unit: AvailabilityTransaction,
        teacher_id: UUID,
        start: datetime,
        end: datetime,
        actor_id: UUID,
    ) -> None:
        rows = await unit.series.list_series(teacher_id, self.series.policy.query_series_limit + 1)

        self.policy.require_count(len(rows), self.series.policy.query_series_limit)

        for row in sorted(rows, key=lambda item: item.id):
            series = await unit.series.find(row.id, teacher_id, lock=True)

            if series is None:
                continue

            conflicts = await self.series.materializer.prepare(
                unit, series, start, end, self.clock(), actor_id
            )

            if conflicts:
                raise LessonError("series_time_conflict")
