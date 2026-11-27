"""Инварианты отмены, восстановления и запросов индивидуального участия."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest

from app.modules.scheduling.domain.change_requests import (
    ChangeKind,
    ChangeState,
    LessonChangeRequest,
)
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import Lesson, LessonConditions, LessonParticipant
from app.modules.scheduling.domain.values import LessonPrice


def example_lesson(group: bool = False) -> tuple[Lesson, datetime]:
    now = datetime.now(UTC)
    lesson = Lesson.create(
        uuid4(),
        LessonConditions(now + timedelta(days=1), "UTC", 60),
        (LessonParticipant(uuid4(), "Ученик", LessonPrice(Decimal(100))),),
        now,
        group_id=uuid4() if group else None,
        group_name="Группа" if group else None,
    )

    return lesson, now


def test_cancellation_keeps_snapshot_and_restores_with_version() -> None:
    lesson, now = example_lesson()
    cancelled = lesson.change_cancellation(True, "  Отпуск  ", now, 1)

    assert cancelled.cancelled and not cancelled.deleted
    assert cancelled.participants == lesson.participants
    assert cancelled.cancellation_reason == "Отпуск"

    with pytest.raises(LessonError, match="lesson_cancelled"):
        cancelled.require_editable(now, 2)

    with pytest.raises(LessonError, match="lesson_conflict"):
        cancelled.change_cancellation(False, None, now, 1)

    restored = cancelled.change_cancellation(False, None, now, 2)

    assert not restored.cancelled and restored.version == 3

    with pytest.raises(LessonError, match="lesson_already_started"):
        restored.change_cancellation(True, None, lesson.conditions.starts_at, 3)


def test_group_member_requests_only_own_cancellation() -> None:
    lesson, now = example_lesson(True)
    card_id = lesson.participants[0].card_id

    with pytest.raises(LessonError, match="group_reschedule_forbidden"):
        LessonChangeRequest.create(
            lesson, card_id, uuid4(), ChangeKind.RESCHEDULE, None, None, now, 1
        )

    request = LessonChangeRequest.create(
        lesson, card_id, uuid4(), ChangeKind.CANCEL, "Болею", None, now, 1
    )
    accepted = request.decide(ChangeState.ACCEPTED, lesson.teacher_id, now)
    cancelled = lesson.change_cancellation(True, request.reason, now, 1, card_id)

    assert not cancelled.cancelled and cancelled.participants[0].cancelled
    assert accepted.state is ChangeState.ACCEPTED

    with pytest.raises(LessonError, match="lesson_change_request_conflict"):
        accepted.decide(ChangeState.REJECTED, lesson.teacher_id, now)

    with pytest.raises(LessonError, match="lesson_cancelled"):
        LessonChangeRequest.create(
            cancelled, card_id, uuid4(), ChangeKind.CANCEL, None, None, now, 2
        )


def test_request_validates_time_version_and_participant() -> None:
    lesson, now = example_lesson()
    card_id = lesson.participants[0].card_id

    for kind, start, version, error in (
        (ChangeKind.CANCEL, lesson.conditions.starts_at, 1, "invalid_lesson_change_request"),
        (ChangeKind.RESCHEDULE, now, 1, "invalid_lesson_time"),
        (ChangeKind.RESCHEDULE, None, 2, "lesson_conflict"),
    ):
        with pytest.raises(LessonError, match=error):
            LessonChangeRequest.create(lesson, card_id, uuid4(), kind, None, start, now, version)

    with pytest.raises(LessonError, match="lesson_not_found"):
        LessonChangeRequest.create(lesson, uuid4(), uuid4(), ChangeKind.CANCEL, None, None, now, 1)

    with pytest.raises(LessonError, match="lesson_conflict"):
        replace(lesson, deleted=True).change_cancellation(True, None, now, 1)
