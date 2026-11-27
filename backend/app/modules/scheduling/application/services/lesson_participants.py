"""Подготовка снимка участников, источников стоимости и запросов согласования."""

from dataclasses import replace
from datetime import datetime
from uuid import UUID

from app.modules.identity.public import Actor
from app.modules.scheduling.application.lesson_contracts import LessonSources, ParticipantDraft
from app.modules.scheduling.application.lesson_ports import LessonTransaction
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import (
    Lesson,
    LessonConditions,
    LessonParticipant,
    ReplyState,
)
from app.modules.scheduling.domain.policies import LessonPolicy
from app.modules.scheduling.domain.values import LessonPrice
from app.modules.students.public import CardReference


class LessonParticipantBuilder:
    def __init__(self, policy: LessonPolicy) -> None:
        self.policy = policy

    async def sources(
        self,
        unit: LessonTransaction,
        actor: Actor,
        group_id: UUID | None,
        commands: tuple[ParticipantDraft, ...] | None,
        previous: Lesson | None = None,
        extra_card_ids: tuple[UUID, ...] = (),
    ) -> LessonSources:
        group = await unit.groups.find(group_id, actor.account_id, lock=False) if group_id else None
        preserve = previous is not None and commands is None
        implicit_group = previous is None and commands is None and group is not None

        if previous is None and group_id is not None and (group is None):
            raise LessonError("group_not_found")

        if previous is None and group is not None and group.archived:
            raise LessonError("group_archived")

        if preserve and previous is not None:
            commands = tuple(
                ParticipantDraft(item.card_id, item.profile_id, item.price)
                for item in previous.participants
            )
        elif implicit_group and group is not None:
            members = await unit.groups.members(group.id, self.policy.max_participants + 1)
            commands = tuple(ParticipantDraft(item.card_id) for item in members)

        commands = commands or ()

        self.policy.require_count(len(commands))

        if len({command.card_id for command in commands}) != len(commands):
            raise LessonError("lesson_duplicate_participant")

        requested_ids = {command.card_id for command in commands}
        previous_ids = {item.card_id for item in previous.participants} if previous else set()
        lock_ids = requested_ids | previous_ids | set(extra_card_ids)

        cards: dict[UUID, CardReference] = {}

        for card_id in sorted(lock_ids):
            card = await unit.cards.find_owned(card_id, actor.account_id, lock=True)

            if card is None:
                if card_id in requested_ids and not (preserve and card_id in previous_ids):
                    raise LessonError("student_card_not_found")
            else:
                cards[card_id] = card

        if group_id is not None:
            group = await unit.groups.find(group_id, actor.account_id, lock=True)

            if previous is None and (group is None):
                raise LessonError("group_not_found")

            if previous is None and group is not None and group.archived:
                raise LessonError("group_archived")

            if implicit_group and group is not None:
                current = await unit.groups.members(group.id, self.policy.max_participants + 1)

                if {item.card_id for item in current} != {item.card_id for item in commands}:
                    raise LessonError("group_conflict")

        group_prices = (
            await unit.groups.prices(group.id, tuple(item.card_id for item in commands))
            if group
            else {}
        )

        await unit.lessons.lock_calendar(actor.account_id)

        return LessonSources(
            tuple(sorted(commands, key=lambda item: item.card_id)),
            cards,
            group,
            group_prices,
            preserve,
        )

    async def build(
        self,
        unit: LessonTransaction,
        sources: LessonSources,
        conditions: LessonConditions,
        confirmation: bool,
        default_price: LessonPrice | None,
        now: datetime,
        *,
        previous: Lesson | None = None,
        reset: bool = False,
    ) -> tuple[LessonParticipant, ...]:
        rescheduled = previous is not None and (
            previous.conditions.starts_at != conditions.starts_at
            or previous.conditions.duration_minutes != conditions.duration_minutes
        )
        previous_parts = {item.card_id: item for item in previous.participants} if previous else {}
        result = []

        for command in sources.commands:
            old = previous_parts.get(command.card_id)
            card = sources.cards.get(command.card_id)
            keep_snapshot = sources.preserve_snapshot and old is not None
            preserve_response = (
                previous is not None
                and previous.confirmation
                and confirmation
                and not rescheduled
                and not reset
                and old is not None
            )
            require_active = (
                previous is None
                or not keep_snapshot
                or rescheduled
                or reset
                or confirmation
                and not previous.confirmation
            )

            if require_active and (card is None or card.archived):
                raise LessonError("student_card_archived" if card else "student_card_not_found")

            if keep_snapshot and old is not None:
                participant = replace(
                    old,
                    state=ReplyState.NOT_REQUIRED,
                    deadline=None,
                    response_by=None,
                    replied_at=None,
                )
            else:
                profile = (
                    await unit.cards.find_profile(command.card_id, command.profile_id)
                    if command.profile_id
                    else None
                )

                if command.profile_id is not None and profile is None:
                    raise LessonError("student_profile_not_found")

                amount = command.price

                if amount is None and command.card_id in sources.group_prices:
                    amount = LessonPrice(sources.group_prices[command.card_id])

                if amount is None and profile is not None:
                    amount = LessonPrice(profile.amount)

                if amount is None:
                    amount = default_price

                if amount is None:
                    raise LessonError("lesson_price_required")

                if card is None:
                    raise LessonError("student_card_not_found")

                participant = LessonParticipant(
                    command.card_id,
                    card.name,
                    amount,
                    command.profile_id,
                    profile.subject if profile else None,
                )

            if preserve_response and old is not None:
                participant = replace(
                    participant,
                    state=old.state,
                    deadline=old.deadline,
                    response_by=old.response_by,
                    replied_at=old.replied_at,
                )
            elif confirmation:
                recipient = await unit.cards.recipient(command.card_id)

                if recipient.connected:
                    if recipient.account_id is None:
                        raise LessonError("confirmation_responsible_required")

                    participant = replace(
                        participant,
                        state=ReplyState.PENDING,
                        deadline=min(now + self.policy.confirmation_lifetime, conditions.starts_at),
                    )

            result.append(participant)

        return tuple(result)
