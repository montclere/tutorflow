"""Паузы, возобновление и прекращение будущих повторений с сохранением истории."""

from dataclasses import replace
from uuid import UUID

from app.modules.identity.public import Actor
from app.modules.scheduling.application.series_contracts import SeriesResult
from app.modules.scheduling.application.services.series_access import (
    SeriesRuntime,
    lock_series,
    save_series,
)
from app.modules.scheduling.domain.series import SeriesPause


class SeriesPauseService:
    def __init__(self, runtime: SeriesRuntime) -> None:
        self.runtime = runtime

    async def pause(
        self,
        actor: Actor,
        series_id: UUID,
        expected_version: int,
        pause: SeriesPause,
        *,
        preview: bool,
        allow_confirmed: bool,
    ) -> SeriesResult:
        async with self.runtime.persistence.transaction() as unit:
            current = await lock_series(unit, actor, series_id, expected_version)
            now = self.runtime.clock()
            changed = current.pause(pause, now, expected_version)
            occurrences = await unit.series.occurrences(
                series_id,
                start=pause.starts_at,
                end=pause.ends_at,
                limit=self.runtime.policy.expansion_limit + 1,
            )

            self.runtime.materializer.require_budget(len(occurrences))

            affected = [
                item
                for item in occurrences
                if item.lesson.conditions.starts_at > now
                and pause.contains(item.lesson.conditions.starts_at)
            ]
            impact = current.impact(
                affected,
                preserve_exceptions=False,
                start=pause.starts_at,
                end=pause.ends_at,
            )

            if preview:
                return SeriesResult(current, now, impact)

            impact.require_confirmation(allow_confirmed)

            for item in affected:
                if not item.lesson.deleted:
                    await self.runtime.materializer.save_change(
                        unit,
                        replace(item.lesson, deleted=True, version=item.lesson.version + 1),
                        actor.account_id,
                        now,
                    )
                    await unit.series.set_suppressed(item.lesson.id, True)

            await save_series(unit, changed, actor.account_id, now, "paused")

            return SeriesResult(changed, now, impact)

    async def resume(
        self, actor: Actor, series_id: UUID, pause_id: UUID, expected_version: int
    ) -> SeriesResult:
        async with self.runtime.persistence.transaction() as unit:
            current = await lock_series(unit, actor, series_id, expected_version)
            now = self.runtime.clock()
            changed = current.resume(pause_id, now, expected_version)
            occurrences = await unit.series.occurrences(
                series_id, start=now, limit=self.runtime.policy.expansion_limit + 1
            )

            self.runtime.materializer.require_budget(len(occurrences))

            for item in occurrences:
                if (
                    not item.suppressed
                    or not item.lesson.deleted
                    or item.lesson.conditions.starts_at <= now
                    or changed.paused(item.lesson.conditions.starts_at)
                ):
                    continue

                segment = next(
                    (part for part in changed.segments if part.id == item.segment_id), None
                )

                if not item.customized and (
                    segment is None or not segment.contains(item.lesson.conditions.starts_at)
                ):
                    continue

                await self.runtime.materializer.save_change(
                    unit,
                    replace(item.lesson, deleted=False, version=item.lesson.version + 1),
                    actor.account_id,
                    now,
                )
                await unit.series.set_suppressed(item.lesson.id, False)

            await save_series(unit, changed, actor.account_id, now, "resumed")

            conflicts = await self.runtime.materializer.prepare(
                unit, changed, now, now + self.runtime.policy.horizon, now, actor.account_id
            )

            return SeriesResult(changed, now, conflicts=conflicts)

    async def remove(
        self,
        actor: Actor,
        series_id: UUID,
        expected_version: int,
        *,
        preview: bool,
        allow_confirmed: bool,
    ) -> SeriesResult:
        async with self.runtime.persistence.transaction() as unit:
            current = await lock_series(unit, actor, series_id, expected_version)
            now = self.runtime.clock()
            occurrences = await unit.series.occurrences(
                series_id, start=now, limit=self.runtime.policy.expansion_limit + 1
            )

            self.runtime.materializer.require_budget(len(occurrences))

            future = [item for item in occurrences if item.lesson.conditions.starts_at > now]
            impact = current.impact(future, preserve_exceptions=False, start=now)

            if preview:
                return SeriesResult(current, now, impact)

            impact.require_confirmation(allow_confirmed)

            for item in future:
                if not item.lesson.deleted:
                    await self.runtime.materializer.save_change(
                        unit,
                        replace(item.lesson, deleted=True, version=item.lesson.version + 1),
                        actor.account_id,
                        now,
                    )

                await unit.series.retire(item.lesson.id)

            changed = current.remove(now, expected_version)

            await save_series(unit, changed, actor.account_id, now, "deleted")

            return SeriesResult(changed, now, impact)
