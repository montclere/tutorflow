"""Полный прикладной поток серии через доменные команды и порты без HTTP-схем."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from tests.students_testkit import card, teacher

from app.modules.identity.public import Actor, Role
from app.modules.scheduling.application.lesson_contracts import LessonDraft, ParticipantDraft
from app.modules.scheduling.application.series_contracts import SeriesCreate
from app.modules.scheduling.domain.recurrence import Frequency, RecurrenceDraft
from app.modules.scheduling.domain.series import SeriesPause
from app.modules.scheduling.domain.values import LessonPrice


pytestmark = [
    pytest.mark.anyio,
    pytest.mark.br_037,
    pytest.mark.br_038,
    pytest.mark.br_039,
    pytest.mark.br_041,
]


async def test_application_creates_pauses_and_restores_same_lesson_instances(
    client, inbox, services
):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    owner = UUID((await client.get("/api/v1/me")).json()["id"])
    actor = Actor(owner, Role.TEACHER, "UTC")
    start = datetime.now(UTC) + timedelta(days=2)
    command = SeriesCreate(
        RecurrenceDraft(Frequency.DAILY, count=3),
        LessonDraft(
            start,
            participants=(
                ParticipantDraft(UUID(student["id"]), price=LessonPrice(Decimal("100"))),
            ),
        ),
    )
    created = await services.series.creation.create(actor, command)
    events = await services.lessons.queries.list_lessons(
        actor, start - timedelta(hours=1), start + timedelta(days=5), None, 50
    )

    assert len(events) == 3

    pause = SeriesPause(uuid4(), start, start + timedelta(hours=2))

    await services.series.pauses.pause(
        actor, created.series.id, 1, pause, preview=False, allow_confirmed=False
    )

    paused = await services.lessons.queries.list_lessons(
        actor, start - timedelta(hours=1), start + timedelta(days=5), None, 50
    )

    assert len(paused) == 2

    await services.series.pauses.resume(actor, created.series.id, pause.id, 2)

    restored = await services.lessons.queries.list_lessons(
        actor, start - timedelta(hours=1), start + timedelta(days=5), None, 50
    )

    assert [event.lesson.id for event in restored] == [event.lesson.id for event in events]
    assert len(await services.series.queries.history(actor, created.series.id, 50)) == 3
