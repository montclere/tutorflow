"""Явная замена будущего шаблона с предварительной оценкой подтверждений и исключений."""

from dataclasses import replace
from uuid import UUID, uuid4

from app.modules.identity.public import Actor
from app.modules.scheduling.application.lesson_contracts import LessonDraft
from app.modules.scheduling.application.series_contracts import (
    RecurrenceDraft,
    SeriesChange,
    SeriesResult,
)
from app.modules.scheduling.application.services.lesson_participants import LessonParticipantBuilder
from app.modules.scheduling.application.services.series_access import (
    SeriesRuntime,
    create_template,
    owned_series,
    participant_ids,
    save_series,
    validate_rule,
)
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.series import SeriesSegment


class SeriesChangeService:
    def __init__(self, runtime: SeriesRuntime) -> None:
        self.runtime = runtime

    async def update(self, actor: Actor, series_id: UUID, command: SeriesChange) -> SeriesResult:
        async with self.runtime.persistence.transaction() as unit:
            initial = await owned_series(unit, actor, series_id)
            cutoff = command.effective_at or self.runtime.clock()

            if cutoff.utcoffset() is None or cutoff < self.runtime.clock():
                if command.effective_at is not None:
                    raise LessonError("series_past_change")

                cutoff = self.runtime.clock()

            base = next(
                (segment for segment in reversed(initial.segments) if segment.contains(cutoff)),
                initial.segments[-1],
            )
            selected_rule = command.rule or base.rule

            builder = LessonParticipantBuilder(self.runtime.lesson_policy)
            template = None
            sources = None

            if command.lesson is not None:
                template = await create_template(
                    unit, actor, command.lesson, self.runtime, participant_ids(initial)
                )
            elif command.refresh_group:
                if base.template.group_id is None:
                    raise LessonError("group_not_found")

                draft = LessonDraft(
                    self.runtime.clock() + self.runtime.lesson_policy.confirmation_lifetime,
                    base.rule.timezone,
                    base.template.conditions.duration_minutes,
                    group_id=base.template.group_id,
                    title=base.template.conditions.title,
                    subject=base.template.conditions.subject,
                    delivery_format=base.template.conditions.delivery_format,
                    private_notes=base.template.conditions.private_notes,
                    confirmation=base.template.confirmation,
                )
                template = await create_template(
                    unit, actor, draft, self.runtime, participant_ids(initial)
                )
            else:
                sources = await builder.sources(
                    unit,
                    actor,
                    base.template.group_id,
                    None,
                    base.template,
                    extra_card_ids=participant_ids(initial),
                )

            current = await owned_series(unit, actor, series_id, lock=True)

            current.require_version(command.expected_version)

            now = self.runtime.clock()
            cutoff = cutoff if command.effective_at is not None else now

            if template is None:
                assert sources is not None

                active = next(
                    (segment for segment in reversed(current.segments) if segment.contains(cutoff)),
                    current.segments[-1],
                )
                anchor = replace(
                    active.template.conditions,
                    starts_at=now + self.runtime.lesson_policy.confirmation_lifetime,
                )
                parts = await builder.build(
                    unit,
                    sources,
                    anchor,
                    active.template.confirmation,
                    None,
                    now,
                    previous=active.template,
                    reset=True,
                )
                template = replace(active.template, conditions=anchor, participants=parts)

            rule = (
                selected_rule.resolve(template.conditions, base.rule)
                if isinstance(selected_rule, RecurrenceDraft)
                else selected_rule
            )

            validate_rule(rule, self.runtime)

            occurrences = await unit.series.occurrences(
                series_id, start=cutoff, limit=self.runtime.policy.expansion_limit + 1
            )
            future = [item for item in occurrences if item.lesson.conditions.starts_at > now]

            self.runtime.materializer.require_budget(len(occurrences))

            impact = current.impact(
                future, preserve_exceptions=not command.overwrite_exceptions, start=cutoff
            )

            if command.preview:
                return SeriesResult(current, now, impact)

            impact.require_confirmation(command.allow_confirmed)

            for item in future:
                if item.customized and not command.overwrite_exceptions:
                    continue

                if not item.lesson.deleted:
                    await self.runtime.materializer.save_change(
                        unit,
                        replace(item.lesson, deleted=True, version=item.lesson.version + 1),
                        actor.account_id,
                        now,
                    )

                await unit.series.retire(item.lesson.id)

                if item.customized:
                    await unit.series.set_customized(item.lesson.id, False)

            changed = current.replace_future(
                SeriesSegment(uuid4(), rule, template, cutoff), now, command.expected_version
            )

            await save_series(unit, changed, actor.account_id, now, "updated")

            conflicts = await self.runtime.materializer.prepare(
                unit, changed, now, now + self.runtime.policy.horizon, now, actor.account_id
            )

            return SeriesResult(changed, now, impact, conflicts)
