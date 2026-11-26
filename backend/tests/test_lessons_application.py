"""Транзакционный сквозной сценарий занятия без зависимости от HTTP-схем."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from tests.postgres_testkit import check_schema
from tests.students_testkit import card, teacher

from app.modules.identity.public import Actor, Role
from app.modules.scheduling.application.lesson_contracts import (
    LessonDraft,
    LessonPatch,
    ParticipantDraft,
)
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.values import LessonPrice


pytestmark = [
    pytest.mark.anyio,
    pytest.mark.br_028,
    pytest.mark.br_029,
    pytest.mark.br_095,
    pytest.mark.br_097,
]


async def test_create_replay_edit_and_audit_are_one_consistent_lesson(
    client, inbox, services, database
):
    headers = await teacher(client, inbox, "teacher@example.com")
    student = await card(client, headers)
    owner_id = UUID((await client.get("/api/v1/me")).json()["id"])
    actor = Actor(owner_id, Role.TEACHER, "UTC")
    start = datetime.now(UTC) + timedelta(days=1)
    draft = LessonDraft(
        start,
        participants=(ParticipantDraft(UUID(student["id"]), price=LessonPrice(Decimal("100"))),),
        request_id=uuid4(),
    )
    result = await services.lessons.creation.create(actor, draft)
    replay = await services.lessons.creation.create(actor, draft)

    assert replay.lesson.id == result.lesson.id
    assert result.lesson.participants[0].price.amount == Decimal("100.00")
    assert len(await services.lessons.queries.history(actor, result.lesson.id, None, 50)) == 1

    changed = await services.lessons.changes.update(
        actor, result.lesson.id, LessonPatch(1, starts_at=start + timedelta(hours=1))
    )

    assert changed.lesson.version == 2
    assert len(await services.lessons.queries.history(actor, result.lesson.id, None, 50)) == 2

    with pytest.raises(LessonError, match="lesson_conflict"):
        await services.lessons.changes.update(
            actor, result.lesson.id, LessonPatch(1, duration_minutes=90)
        )

    assert (
        len(
            await services.lessons.queries.list_lessons(
                actor, start, start + timedelta(days=1), None, 50
            )
        )
        == 1
    )

    await check_schema(database)
