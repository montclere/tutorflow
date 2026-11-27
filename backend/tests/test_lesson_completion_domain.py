"""Инварианты ручного проведения и независимой посещаемости занятия."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest

from app.modules.scheduling.domain.completion import Attendance, LessonOutcome
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import Lesson, LessonConditions, LessonParticipant
from app.modules.scheduling.domain.values import LessonPrice


pytestmark = [pytest.mark.br_053, pytest.mark.br_054, pytest.mark.br_055, pytest.mark.br_061]


def test_completion_requires_started_lesson_and_consistent_attendance():
    now = datetime.now(UTC)
    part = LessonParticipant(uuid4(), "Ученик", LessonPrice(Decimal(100)))
    lesson = Lesson(
        uuid4(), uuid4(), LessonConditions(now + timedelta(hours=1), "UTC", 60), (part,)
    )

    with pytest.raises(LessonError, match="lesson_not_started"):
        lesson.complete(LessonOutcome.HELD, {}, None, now, 1)

    ended = now + timedelta(hours=3)
    completed = lesson.complete(
        LessonOutcome.HELD, {part.card_id: Attendance.PRESENT}, "Итог", ended, 1
    )

    assert completed.outcome is LessonOutcome.HELD and completed.version == 2

    with pytest.raises(LessonError, match="invalid_lesson_completion"):
        completed.complete(LessonOutcome.NOT_HELD, {}, None, ended, 2)

    corrected = completed.complete(
        LessonOutcome.NOT_HELD, {part.card_id: Attendance.ABSENT}, None, ended, 2
    )

    assert corrected.outcome is LessonOutcome.NOT_HELD and corrected.completion_notes is None

    with pytest.raises(LessonError, match="lesson_cancelled"):
        replace(lesson, cancelled=True).complete(LessonOutcome.HELD, {}, None, ended, 1)
