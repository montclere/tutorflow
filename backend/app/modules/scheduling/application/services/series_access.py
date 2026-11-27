"""Общие транзакционные шаги доступа и подготовки шаблона регулярного расписания."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.identity.public import Actor
from app.modules.scheduling.application.lesson_contracts import LessonDraft
from app.modules.scheduling.application.series_contracts import SeriesRevision
from app.modules.scheduling.application.series_ports import SeriesTransaction, SeriesUnitOfWork
from app.modules.scheduling.application.services.lesson_access import require_teacher
from app.modules.scheduling.application.services.lesson_participants import LessonParticipantBuilder
from app.modules.scheduling.application.services.series_materialization import SeriesMaterializer
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import Lesson, LessonConditions
from app.modules.scheduling.domain.policies import LessonPolicy, SeriesPolicy
from app.modules.scheduling.domain.recurrence import RecurrenceRule
from app.modules.scheduling.domain.series import LessonSeries


@dataclass(frozen=True)
class SeriesRuntime:
    persistence: SeriesUnitOfWork
    lesson_policy: LessonPolicy
    policy: SeriesPolicy
    clock: Callable[[], datetime]
    materializer: SeriesMaterializer


def participant_ids(series: LessonSeries) -> tuple[UUID, ...]:
    return tuple(
        sorted(
            {part.card_id for segment in series.segments for part in segment.template.participants}
        )
    )


async def owned_series(
    unit: SeriesTransaction, actor: Actor, series_id: UUID, *, lock: bool = False
) -> LessonSeries:
    require_teacher(actor)

    series = await unit.series.find(series_id, actor.account_id, lock=lock)

    if series is None:
        raise LessonError("series_not_found")

    return series


async def lock_series(
    unit: SeriesTransaction, actor: Actor, series_id: UUID, expected_version: int | None = None
) -> LessonSeries:
    initial = await owned_series(unit, actor, series_id)

    for card_id in participant_ids(initial):
        await unit.cards.find_owned(card_id, actor.account_id, lock=True)

    await unit.lessons.lock_calendar(actor.account_id)

    current = await owned_series(unit, actor, series_id, lock=True)

    if expected_version is not None:
        current.require_version(expected_version)

    return current


async def save_series(
    unit: SeriesTransaction, series: LessonSeries, actor_id: UUID, now: datetime, kind: str
) -> None:
    await unit.series.save(series)
    await unit.series.append_revision(SeriesRevision(uuid4(), actor_id, now, kind, series))


def validate_rule(rule: RecurrenceRule, runtime: SeriesRuntime) -> None:
    runtime.lesson_policy.require_duration(rule.duration_minutes)

    for slot in rule.weekly_slots:
        runtime.lesson_policy.require_duration(slot.duration_minutes)


async def create_template(
    unit: SeriesTransaction,
    actor: Actor,
    draft: LessonDraft,
    runtime: SeriesRuntime,
    extra_card_ids: tuple[UUID, ...] = (),
) -> Lesson:
    if draft.request_id is not None:
        raise LessonError("invalid_series_rule")

    builder = LessonParticipantBuilder(runtime.lesson_policy)
    sources = await builder.sources(
        unit, actor, draft.group_id, draft.participants, extra_card_ids=extra_card_ids
    )
    preferences = await unit.lessons.preferences(actor.account_id)
    duration = (
        draft.duration_minutes
        or preferences.duration_minutes
        or runtime.lesson_policy.default_duration_minutes
    )

    runtime.lesson_policy.require_duration(duration)

    conditions = LessonConditions(
        draft.starts_at,
        draft.timezone or actor.timezone or "UTC",
        duration,
        draft.title,
        draft.subject,
        draft.delivery_format,
        draft.private_notes,
    )
    now = runtime.clock()
    participants = await builder.build(
        unit, sources, conditions, draft.confirmation, preferences.price, now
    )

    return Lesson.create(
        actor.account_id,
        conditions,
        participants,
        now,
        group_id=sources.group.id if sources.group else None,
        group_name=sources.group.name if sources.group else None,
        confirmation=draft.confirmation,
    )
