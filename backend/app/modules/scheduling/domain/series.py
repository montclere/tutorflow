"""Версии регулярного расписания, будущие границы и сохраняемые периоды пауз."""

from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import date, datetime
from uuid import UUID

from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import Lesson, ReplyState
from app.modules.scheduling.domain.recurrence import RecurrenceRule


@dataclass(frozen=True)
class SeriesSegment:
    id: UUID
    rule: RecurrenceRule
    template: Lesson
    effective_at: datetime
    until_at: datetime | None = None

    def contains(self, starts_at: datetime) -> bool:
        return starts_at >= self.effective_at and (
            self.until_at is None or starts_at < self.until_at
        )


@dataclass(frozen=True)
class SeriesPause:
    id: UUID
    starts_at: datetime
    ends_at: datetime | None = None

    def __post_init__(self) -> None:
        if (
            self.starts_at.utcoffset() is None
            or self.ends_at is not None
            and (self.ends_at.utcoffset() is None or self.ends_at <= self.starts_at)
        ):
            raise LessonError("invalid_series_pause")

    def contains(self, starts_at: datetime) -> bool:
        return self.starts_at <= starts_at and (self.ends_at is None or starts_at < self.ends_at)


@dataclass(frozen=True)
class SeriesOccurrence:
    series_id: UUID
    segment_id: UUID
    local_date: date
    lesson: Lesson
    customized: bool = False
    suppressed: bool = False


@dataclass(frozen=True)
class SeriesImpact:
    affected: tuple[UUID, ...] = ()
    confirmed: tuple[UUID, ...] = ()
    exceptions: tuple[UUID, ...] = ()
    confirmed_schedule: bool = False

    def require_confirmation(self, allowed: bool) -> None:
        if (self.confirmed or self.confirmed_schedule) and not allowed:
            raise LessonError("series_confirmation_required")


@dataclass(frozen=True)
class LessonSeries:
    id: UUID
    teacher_id: UUID
    created_at: datetime
    segments: tuple[SeriesSegment, ...]
    pauses: tuple[SeriesPause, ...] = ()
    version: int = 1
    deleted: bool = False

    def __post_init__(self) -> None:
        if not self.segments or self.version < 1:
            raise LessonError("invalid_series_rule")

        if any(segment.template.teacher_id != self.teacher_id for segment in self.segments):
            raise LessonError("invalid_series_rule")

    def require_version(self, expected_version: int) -> None:
        if self.deleted or self.version != expected_version:
            raise LessonError("series_conflict")

    def replace_future(
        self, segment: SeriesSegment, now: datetime, expected_version: int
    ) -> "LessonSeries":
        self.require_version(expected_version)

        if segment.effective_at < now:
            raise LessonError("series_past_change")

        previous = tuple(
            replace(
                old,
                until_at=min(old.until_at, segment.effective_at)
                if old.until_at
                else segment.effective_at,
            )
            for old in self.segments
            if old.effective_at < segment.effective_at
        )

        return replace(self, segments=previous + (segment,), version=self.version + 1)

    def pause(self, pause: SeriesPause, now: datetime, expected_version: int) -> "LessonSeries":
        self.require_version(expected_version)

        if pause.starts_at < now:
            raise LessonError("series_past_change")

        return replace(self, pauses=self.pauses + (pause,), version=self.version + 1)

    def resume(self, pause_id: UUID, now: datetime, expected_version: int) -> "LessonSeries":
        self.require_version(expected_version)

        selected = next((pause for pause in self.pauses if pause.id == pause_id), None)

        if selected is None or selected.ends_at is not None and selected.ends_at <= now:
            raise LessonError("series_pause_not_found")

        pauses = tuple(
            replace(pause, ends_at=now) if pause.id == pause_id and pause.starts_at < now else pause
            for pause in self.pauses
            if pause.id != pause_id or pause.starts_at < now
        )

        return replace(self, pauses=pauses, version=self.version + 1)

    def remove(self, now: datetime, expected_version: int) -> "LessonSeries":
        self.require_version(expected_version)

        segments = tuple(
            replace(segment, until_at=min(segment.until_at, now) if segment.until_at else now)
            for segment in self.segments
            if segment.effective_at < now
        )

        return replace(
            self,
            segments=segments or (replace(self.segments[0], until_at=now),),
            deleted=True,
            version=self.version + 1,
        )

    def reply(
        self,
        card_id: UUID,
        answer: ReplyState,
        account_id: UUID,
        now: datetime,
        expected_version: int,
    ) -> "LessonSeries":
        self.require_version(expected_version)

        if answer not in {ReplyState.ACCEPTED, ReplyState.DECLINED}:
            raise LessonError("invalid_lesson_reply")

        segments = []
        changed = False
        found = False

        for segment in self.segments:
            part = next(
                (part for part in segment.template.participants if part.card_id == card_id),
                None,
            )

            if part is None or segment.until_at is not None and segment.until_at <= now:
                segments.append(segment)

                continue

            found = True

            if part.state is answer and part.response_by == account_id:
                segments.append(segment)

                continue

            if part.deadline is None:
                raise LessonError("lesson_reply_not_requested")

            if part.deadline <= now:
                raise LessonError("lesson_reply_expired")

            updated = replace(part, state=answer, response_by=account_id, replied_at=now)
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
            return self

        return replace(self, segments=tuple(segments))

    def impact(
        self,
        occurrences: Sequence[SeriesOccurrence],
        *,
        preserve_exceptions: bool,
        start: datetime,
        end: datetime | None = None,
    ) -> SeriesImpact:
        affected = tuple(
            item
            for item in occurrences
            if not item.lesson.deleted and (not preserve_exceptions or not item.customized)
        )

        return SeriesImpact(
            tuple(item.lesson.id for item in affected),
            tuple(
                item.lesson.id
                for item in affected
                if any(part.state is ReplyState.ACCEPTED for part in item.lesson.participants)
            ),
            tuple(item.lesson.id for item in occurrences if item.customized),
            any(
                part.state is ReplyState.ACCEPTED
                for segment in self.segments
                if (segment.until_at is None or segment.until_at > start)
                and (end is None or segment.effective_at < end)
                for part in segment.template.participants
            ),
        )

    def paused(self, starts_at: datetime) -> bool:
        return any(pause.contains(starts_at) for pause in self.pauses)
