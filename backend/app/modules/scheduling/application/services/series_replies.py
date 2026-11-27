"""Согласование будущего расписания одним ответственным с приоритетом ответов на даты."""

from dataclasses import replace
from uuid import UUID

from app.modules.identity.public import Actor, Role
from app.modules.scheduling.application.series_contracts import OwnSeriesResult, SeriesResult
from app.modules.scheduling.application.services.series_access import SeriesRuntime, save_series
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import ReplyState


class SeriesReplyService:
    def __init__(self, runtime: SeriesRuntime) -> None:
        self.runtime = runtime

    async def reply(
        self,
        actor: Actor,
        card_id: UUID,
        series_id: UUID,
        answer: ReplyState,
        expected_version: int,
    ) -> OwnSeriesResult:
        if actor.role not in {Role.STUDENT, Role.ADULT}:
            raise LessonError("lesson_participant_required")

        if answer not in {ReplyState.ACCEPTED, ReplyState.DECLINED}:
            raise LessonError("invalid_lesson_reply")

        async with self.runtime.persistence.transaction() as unit:
            card = await unit.cards.find_accessible(card_id, actor)

            if card is None:
                raise LessonError("series_not_found")

            locked = await unit.cards.find_owned(card_id, card.teacher_id, lock=True)

            if locked is None or locked.archived:
                raise LessonError("series_not_found")

            recipient = await unit.cards.recipient(card_id)

            if recipient.account_id != actor.account_id or recipient.role is not actor.role:
                raise LessonError("lesson_response_forbidden")

            await unit.lessons.lock_calendar(card.teacher_id)

            series = await unit.series.find(series_id, card.teacher_id, lock=True)

            if series is None:
                raise LessonError("series_not_found")

            series.require_version(expected_version)

            now = self.runtime.clock()
            segments = []
            changed = False
            found = False

            for segment in series.segments:
                part = next(
                    (part for part in segment.template.participants if part.card_id == card_id),
                    None,
                )

                if part is None or segment.until_at is not None and segment.until_at <= now:
                    segments.append(segment)

                    continue

                found = True

                if part.state is answer and part.response_by == actor.account_id:
                    segments.append(segment)

                    continue

                if part.deadline is None:
                    raise LessonError("lesson_reply_not_requested")

                if part.deadline <= now:
                    raise LessonError("lesson_reply_expired")

                updated = replace(part, state=answer, response_by=actor.account_id, replied_at=now)
                participants = tuple(
                    updated if item.card_id == card_id else item
                    for item in segment.template.participants
                )

                segments.append(
                    replace(segment, template=replace(segment.template, participants=participants))
                )

                changed = True

            if not found:
                raise LessonError("series_not_found")

            if not changed:
                return OwnSeriesResult(SeriesResult(series, now), card_id, True)

            revised = replace(series, segments=tuple(segments))
            overrides = await unit.series.response_overrides(series_id, card_id)
            occurrences = await unit.series.occurrences(
                series_id, start=now, limit=self.runtime.policy.expansion_limit + 1
            )

            self.runtime.materializer.require_budget(len(occurrences))

            for occurrence in occurrences:
                if (
                    occurrence.customized
                    or occurrence.lesson.id in overrides
                    or occurrence.lesson.deleted
                ):
                    continue

                lesson = await unit.lessons.find(occurrence.lesson.id, card.teacher_id, lock=True)

                if lesson is None or lesson.conditions.starts_at <= now:
                    continue

                part = next((item for item in lesson.participants if item.card_id == card_id), None)

                if part is None:
                    continue

                participant = replace(
                    part,
                    state=answer,
                    deadline=lesson.conditions.starts_at,
                    response_by=actor.account_id,
                    replied_at=now,
                )
                participants = tuple(
                    participant if item.card_id == card_id else item for item in lesson.participants
                )

                await self.runtime.materializer.save_change(
                    unit, replace(lesson, participants=participants), actor.account_id, now
                )

            await save_series(unit, revised, actor.account_id, now, "reply")

            return OwnSeriesResult(SeriesResult(revised, now), card_id, True)
