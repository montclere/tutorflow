"""Создание регулярного расписания из команды или существующего будущего урока."""

import json
from dataclasses import asdict, replace
from datetime import UTC, date, datetime, time
from decimal import Decimal
from hashlib import sha256
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from app.modules.identity.public import Actor
from app.modules.scheduling.application.lesson_contracts import LessonRevision
from app.modules.scheduling.application.series_contracts import (
    RecurrenceDraft,
    SeriesCreate,
    SeriesResult,
    SeriesRevision,
)
from app.modules.scheduling.application.services.lesson_access import owned_lesson, require_teacher
from app.modules.scheduling.application.services.lesson_participants import LessonParticipantBuilder
from app.modules.scheduling.application.services.series_access import (
    SeriesRuntime,
    create_template,
    validate_rule,
)
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.series import LessonSeries, SeriesOccurrence, SeriesSegment
from app.modules.scheduling.domain.values import RevisionKind


def command_value(value: object) -> str:
    if isinstance(value, datetime):
        if value.utcoffset() is None:
            raise LessonError("invalid_series_rule")

        return value.astimezone(UTC).isoformat()

    if isinstance(value, (date, time)):
        return value.isoformat()

    if isinstance(value, (UUID, Decimal)):
        return str(value)

    raise TypeError("Неподдерживаемый тип команды серии")


def series_fingerprint(command: SeriesCreate) -> str:
    value = asdict(command)

    value.pop("request_id")

    return sha256(
        json.dumps(value, default=command_value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


class SeriesCreationService:
    def __init__(self, runtime: SeriesRuntime) -> None:
        self.runtime = runtime

    async def create(self, actor: Actor, command: SeriesCreate) -> SeriesResult:
        require_teacher(actor)

        if (command.lesson is None) == (command.source_lesson_id is None):
            raise LessonError("invalid_series_rule")

        fingerprint = series_fingerprint(command)

        async with self.runtime.persistence.transaction() as unit:
            if command.request_id is not None:
                old = await unit.series.find_request(actor.account_id, command.request_id)

                if old:
                    if old.fingerprint != fingerprint:
                        raise LessonError("series_request_conflict")

                    return SeriesResult(old.series, self.runtime.clock())

            source = None

            if command.lesson is not None:
                template = await create_template(unit, actor, command.lesson, self.runtime)
            else:
                assert command.source_lesson_id is not None

                initial = await owned_lesson(unit, actor, command.source_lesson_id)

                builder = LessonParticipantBuilder(self.runtime.lesson_policy)
                sources = await builder.sources(unit, actor, initial.group_id, None, initial)
                source = await owned_lesson(unit, actor, command.source_lesson_id, lock=True)

                source.require_editable(self.runtime.clock(), command.source_version or 0)

                if source.series_id is not None:
                    raise LessonError("series_conflict")

                parts = await builder.build(
                    unit,
                    sources,
                    source.conditions,
                    source.confirmation,
                    None,
                    self.runtime.clock(),
                    previous=source,
                    reset=True,
                )
                template = replace(source, participants=parts)

            rule = (
                command.rule.resolve(template.conditions)
                if isinstance(command.rule, RecurrenceDraft)
                else command.rule
            )

            validate_rule(rule, self.runtime)

            now = self.runtime.clock()

            if rule.first_date < now.astimezone(ZoneInfo(rule.timezone)).date():
                raise LessonError("series_past_change")

            segment = SeriesSegment(uuid4(), rule, template, now)
            series = LessonSeries(uuid4(), actor.account_id, now, (segment,))

            if not await unit.series.add(series, command.request_id, fingerprint):
                old = (
                    await unit.series.find_request(actor.account_id, command.request_id)
                    if command.request_id
                    else None
                )

                if old is None or old.fingerprint != fingerprint:
                    raise LessonError("series_request_conflict")

                return SeriesResult(old.series, self.runtime.clock())

            if source is not None:
                local_day = source.conditions.starts_at.astimezone(ZoneInfo(rule.timezone)).date()
                slot = rule.slot_on(local_day)
                moment, conflict = rule.resolve(local_day, slot.starts_at) if slot else (None, None)

                if (
                    conflict
                    or moment != source.conditions.starts_at
                    or slot is None
                    or slot.duration_minutes != source.conditions.duration_minutes
                ):
                    raise LessonError("series_source_mismatch")

                linked = replace(
                    template,
                    series_id=series.id,
                    original_date=local_day,
                    version=source.version + 1,
                )

                await unit.lessons.save(linked)
                await unit.series.link(SeriesOccurrence(series.id, segment.id, local_day, linked))
                await unit.lessons.append_revision(
                    LessonRevision(uuid4(), actor.account_id, now, RevisionKind.UPDATED, linked)
                )

            await unit.series.append_revision(
                SeriesRevision(uuid4(), actor.account_id, now, "created", series)
            )

            conflicts = await self.runtime.materializer.prepare(
                unit, series, now, now + self.runtime.policy.horizon, now, actor.account_id
            )

            return SeriesResult(series, now, conflicts=conflicts)
