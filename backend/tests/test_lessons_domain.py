"""Предметные инварианты занятия, снимков и отдельного согласования участников."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest

from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import (
    Lesson,
    LessonConditions,
    LessonParticipant,
    ReplyState,
)
from app.modules.scheduling.domain.values import LessonPrice


NOW = datetime(2030, 1, 1, tzinfo=UTC)


@pytest.mark.br_095
def test_individual_lesson_cannot_be_empty_but_group_can_be_planned_before_enrollment():
    conditions = LessonConditions(NOW + timedelta(days=1), "UTC", 60)

    with pytest.raises(LessonError, match="lesson_participants_required"):
        Lesson.create(uuid4(), conditions, (), NOW)

    lesson = Lesson.create(uuid4(), conditions, (), NOW, group_id=uuid4(), group_name="Группа")

    assert lesson.participants == ()


@pytest.mark.br_096
def test_reply_changes_only_own_participation_without_cancelling_the_lesson():
    first = LessonParticipant(
        uuid4(),
        "Первый",
        LessonPrice(Decimal("100")),
        state=ReplyState.PENDING,
        deadline=NOW + timedelta(hours=1),
    )
    second = LessonParticipant(
        uuid4(),
        "Второй",
        LessonPrice(Decimal("150")),
        state=ReplyState.PENDING,
        deadline=NOW + timedelta(hours=1),
    )
    lesson = Lesson.create(
        uuid4(),
        LessonConditions(NOW + timedelta(days=1), "UTC", 60),
        (first, second),
        NOW,
        confirmation=True,
    )
    changed = lesson.reply(first.card_id, ReplyState.DECLINED, uuid4(), NOW, expected_version=1)

    assert changed.participants[0].state is ReplyState.DECLINED
    assert changed.participants[1].state is ReplyState.PENDING
    assert not changed.deleted
    assert lesson.participants[0].state is ReplyState.PENDING


@pytest.mark.br_097
def test_started_lesson_and_stale_version_cannot_be_rewritten():
    lesson = Lesson.create(
        uuid4(),
        LessonConditions(NOW + timedelta(hours=1), "UTC", 60),
        (),
        NOW,
        group_id=uuid4(),
        group_name="Группа",
    )

    with pytest.raises(LessonError, match="lesson_conflict"):
        lesson.require_editable(NOW, 2)

    with pytest.raises(LessonError, match="lesson_already_started"):
        lesson.require_editable(NOW + timedelta(hours=1), 1)
