"""Проверки кабинета, владельца и ограниченного диапазона занятий."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from app.modules.identity.public import Actor, Role
from app.modules.scheduling.application.lesson_contracts import LessonResult
from app.modules.scheduling.application.lesson_ports import LessonTransaction
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import Lesson
from app.modules.scheduling.domain.policies import LessonPolicy


def require_teacher(actor: Actor) -> None:
    if actor.role is not Role.TEACHER:
        raise LessonError("teacher_required")


def require_limit(limit: int, policy: LessonPolicy) -> None:
    if not 1 <= limit <= policy.page_max_size:
        raise LessonError("invalid_lesson_range")


def require_range(
    start: datetime, end: datetime, limit: int, policy: LessonPolicy
) -> tuple[datetime, datetime]:
    require_limit(limit, policy)

    try:
        if start.utcoffset() is None or end.utcoffset() is None:
            raise ValueError

        start, end = start.astimezone(UTC), end.astimezone(UTC)

        if not timedelta(0) < end - start <= timedelta(days=policy.max_range_days):
            raise ValueError
    except (ValueError, OverflowError) as error:
        raise LessonError("invalid_lesson_range") from error

    return start, end


async def owned_lesson(
    unit: LessonTransaction,
    actor: Actor,
    lesson_id: UUID,
    *,
    lock: bool = False,
    include_deleted: bool = False,
) -> Lesson:
    require_teacher(actor)

    lesson = await unit.lessons.find(
        lesson_id, actor.account_id, lock=lock, include_deleted=include_deleted
    )

    if lesson is None:
        raise LessonError("lesson_not_found")

    return lesson


async def with_warnings(
    unit: LessonTransaction, lesson: Lesson, policy: LessonPolicy, now: datetime
) -> LessonResult:
    if lesson.deleted:
        return LessonResult(lesson, now)

    warnings = await unit.lessons.warnings(lesson, policy.conflict_limit + 1)

    return LessonResult(
        lesson, now, tuple(warnings[: policy.conflict_limit]), len(warnings) > policy.conflict_limit
    )
