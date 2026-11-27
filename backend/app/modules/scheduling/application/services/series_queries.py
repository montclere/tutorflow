"""Ограниченные выборки серий и безопасная подготовка собственного календаря."""

from datetime import datetime, timedelta
from uuid import UUID

from app.modules.identity.public import Actor, Role
from app.modules.scheduling.application.series_contracts import (
    OwnSeriesResult,
    SeriesResult,
    SeriesRevision,
)
from app.modules.scheduling.application.services.lesson_access import require_range, require_teacher
from app.modules.scheduling.application.services.series_access import (
    SeriesRuntime,
    lock_series,
    owned_series,
)
from app.modules.scheduling.domain.exceptions import LessonError


class SeriesQueryService:
    def __init__(self, runtime: SeriesRuntime) -> None:
        self.runtime = runtime

    async def list_series(
        self, actor: Actor, limit: int, after_id: UUID | None = None
    ) -> list[SeriesResult]:
        require_teacher(actor)
        self.runtime.lesson_policy.page_size(limit)

        async with self.runtime.persistence.transaction() as unit:
            rows = await unit.series.list_series(actor.account_id, limit + 1, after_id)
            now = self.runtime.clock()

            return [SeriesResult(row, now) for row in rows]

    async def get(
        self,
        actor: Actor,
        series_id: UUID,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> SeriesResult:
        now = self.runtime.clock()
        start = start or now
        end = end or start + min(
            self.runtime.policy.horizon, timedelta(days=self.runtime.lesson_policy.max_range_days)
        )

        start, end = require_range(start, end, 1, self.runtime.lesson_policy)

        async with self.runtime.persistence.transaction() as unit:
            series = await lock_series(unit, actor, series_id)
            conflicts = await self.runtime.materializer.prepare(
                unit, series, start, end, self.runtime.clock(), actor.account_id
            )

            return SeriesResult(series, self.runtime.clock(), conflicts=conflicts)

    async def history(
        self, actor: Actor, series_id: UUID, limit: int, after_id: UUID | None = None
    ) -> list[SeriesRevision]:
        self.runtime.lesson_policy.page_size(limit)

        async with self.runtime.persistence.transaction() as unit:
            await owned_series(unit, actor, series_id)

            return await unit.series.history(series_id, after_id, limit + 1)

    async def own(self, actor: Actor, card_id: UUID, series_id: UUID) -> OwnSeriesResult:
        if actor.role not in {Role.STUDENT, Role.ADULT}:
            raise LessonError("lesson_participant_required")

        async with self.runtime.persistence.transaction() as unit:
            card = await unit.cards.find_accessible(card_id, actor, include_archived=True)

            if card is None:
                raise LessonError("series_not_found")

            series = await unit.series.find(series_id, card.teacher_id)

            if series is None or not any(
                part.card_id == card_id
                for segment in series.segments
                for part in segment.template.participants
            ):
                raise LessonError("series_not_found")

            recipient = await unit.cards.recipient(card_id)
            now = self.runtime.clock()
            has_open_request = any(
                part.card_id == card_id and part.deadline is not None and part.deadline > now
                for segment in series.segments
                if segment.until_at is None or segment.until_at > now
                for part in segment.template.participants
            )
            can_reply = (
                not card.archived
                and not series.deleted
                and recipient.account_id == actor.account_id
                and recipient.role is actor.role
                and has_open_request
            )

            return OwnSeriesResult(SeriesResult(series, now), card_id, can_reply)


class SeriesCalendarPreparation:
    def __init__(self, runtime: SeriesRuntime) -> None:
        self.runtime = runtime

    async def prepare(
        self, actor: Actor, start: datetime, end: datetime, card_id: UUID | None = None
    ) -> None:
        start, end = require_range(start, end, 1, self.runtime.lesson_policy)

        async with self.runtime.persistence.transaction() as unit:
            owner_id = actor.account_id

            if card_id is not None:
                if actor.role not in {Role.STUDENT, Role.ADULT}:
                    raise LessonError("lesson_participant_required")

                card = await unit.cards.find_accessible(card_id, actor, include_archived=True)

                if card is None:
                    raise LessonError("lesson_not_found")

                owner_id = card.teacher_id
            else:
                require_teacher(actor)

            rows = await unit.series.list_series(
                owner_id, self.runtime.policy.query_series_limit + 1, card_id=card_id
            )

        if len(rows) > self.runtime.policy.query_series_limit:
            raise LessonError("series_expansion_limit")

        for series in rows:
            async with self.runtime.persistence.transaction() as unit:
                for identifier in sorted(
                    {
                        part.card_id
                        for segment in series.segments
                        for part in segment.template.participants
                    }
                ):
                    await unit.cards.find_owned(identifier, owner_id, lock=True)

                await unit.lessons.lock_calendar(owner_id)

                current = await unit.series.find(series.id, owner_id, lock=True)

                if current is None:
                    continue

                conflicts = await self.runtime.materializer.prepare(
                    unit, current, start, end, self.runtime.clock(), actor.account_id
                )

            if conflicts:
                raise LessonError("series_time_conflict")
