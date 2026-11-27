"""Идемпотентная подготовка ограниченного диапазона конкретных занятий серии."""

from asyncio import to_thread
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from uuid import UUID, uuid4, uuid5

from app.modules.scheduling.application.lesson_contracts import LessonRevision
from app.modules.scheduling.application.series_contracts import SeriesOccurrence
from app.modules.scheduling.application.series_ports import SeriesTransaction
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import Lesson, ReplyState
from app.modules.scheduling.domain.policies import SeriesPolicy
from app.modules.scheduling.domain.recurrence import RecurrenceConflict, RecurrenceOccurrence
from app.modules.scheduling.domain.series import LessonSeries, SeriesSegment
from app.modules.scheduling.domain.values import RevisionKind


class SeriesMaterializer:
    def __init__(self, policy: SeriesPolicy) -> None:
        self.policy = policy

    def require_budget(self, count: int) -> None:
        if count > self.policy.expansion_limit:
            raise LessonError("series_expansion_limit")

    async def save_change(
        self, unit: SeriesTransaction, lesson: Lesson, actor_id: UUID, now: datetime
    ) -> None:
        await unit.lessons.save(lesson)
        await unit.lessons.append_revision(
            LessonRevision(
                uuid4(),
                actor_id,
                now,
                RevisionKind.DELETED if lesson.deleted else RevisionKind.UPDATED,
                lesson,
            )
        )

    def build_lesson(
        self, series: LessonSeries, segment: SeriesSegment, occurrence: RecurrenceOccurrence
    ) -> Lesson:
        conditions = replace(
            segment.template.conditions,
            starts_at=occurrence.starts_at,
            timezone=segment.rule.timezone,
            duration_minutes=occurrence.duration_minutes,
        )
        participants = tuple(
            replace(participant, deadline=occurrence.starts_at)
            if participant.state in {ReplyState.ACCEPTED, ReplyState.DECLINED}
            else replace(participant, deadline=min(participant.deadline, occurrence.starts_at))
            if participant.deadline is not None
            else participant
            for participant in segment.template.participants
        )

        return replace(
            segment.template,
            id=uuid5(series.id, f"{segment.id}:{occurrence.local_date.isoformat()}"),
            conditions=conditions,
            participants=participants,
            version=1,
            deleted=False,
            series_id=series.id,
            original_date=occurrence.local_date,
        )

    async def prepare(
        self,
        unit: SeriesTransaction,
        series: LessonSeries,
        start: datetime,
        end: datetime,
        now: datetime,
        actor_id: UUID,
    ) -> tuple[RecurrenceConflict, ...]:
        existing = await unit.series.occurrences(
            series.id, start=start, end=end, limit=self.policy.expansion_limit + 1
        )

        self.require_budget(len(existing))

        by_key = {(item.segment_id, item.local_date): item for item in existing}
        preserved_dates = {item.local_date for item in existing if item.customized}
        conflicts: list[RecurrenceConflict] = []
        prepared = 0

        for segment in series.segments:
            duration = max(
                (slot.duration_minutes for slot in segment.rule.weekly_slots),
                default=segment.rule.duration_minutes,
            )

            try:
                preceding = start - timedelta(minutes=duration)
            except OverflowError:
                preceding = datetime.min.replace(tzinfo=UTC)

            left = max(preceding, segment.effective_at, series.created_at)
            right = min(end, segment.until_at) if segment.until_at else end

            if right <= left:
                continue

            result = await to_thread(
                segment.rule.expand,
                left,
                right,
                self.policy.expansion_limit,
                self.policy.scan_limit,
            )

            conflicts.extend(result.conflicts)

            for occurrence in result.occurrences:
                if occurrence.ends_at <= start:
                    continue

                prepared += 1

                self.require_budget(prepared)

                old = by_key.get((segment.id, occurrence.local_date))

                if old is not None and old.customized:
                    continue

                if old is None and occurrence.local_date in preserved_dates:
                    continue

                paused = series.paused(occurrence.starts_at)

                if old is not None:
                    if old.lesson.conditions.starts_at <= now:
                        continue

                    if paused != old.suppressed:
                        changed = replace(
                            old.lesson, deleted=paused, version=old.lesson.version + 1
                        )

                        await self.save_change(unit, changed, actor_id, now)
                        await unit.series.set_suppressed(old.lesson.id, paused)

                    continue

                if paused:
                    continue

                lesson = self.build_lesson(series, segment, occurrence)
                fingerprint = sha256(str(lesson.id).encode()).hexdigest()

                if await unit.lessons.add(lesson, None, fingerprint):
                    await unit.series.link(
                        SeriesOccurrence(series.id, segment.id, occurrence.local_date, lesson)
                    )
                    await unit.lessons.append_revision(
                        LessonRevision(uuid4(), actor_id, now, RevisionKind.CREATED, lesson)
                    )

        return tuple(conflicts)
