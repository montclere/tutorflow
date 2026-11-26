"""Пользовательские значения преподавателя по умолчанию без изменения назначенных уроков."""

from dataclasses import replace

from app.modules.identity.public import Actor
from app.modules.scheduling.application.lesson_contracts import (
    PreferencesPatch,
    TeachingPreferences,
)
from app.modules.scheduling.application.lesson_ports import LessonsUnitOfWork
from app.modules.scheduling.application.services.lesson_access import require_teacher
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.policies import LessonPolicy


class TeachingPreferencesService:
    def __init__(self, persistence: LessonsUnitOfWork, policy: LessonPolicy) -> None:
        self.persistence = persistence
        self.policy = policy

    async def get(self, actor: Actor) -> TeachingPreferences:
        require_teacher(actor)

        async with self.persistence.transaction() as unit:
            return await unit.lessons.preferences(actor.account_id)

    async def update(self, actor: Actor, command: PreferencesPatch) -> TeachingPreferences:
        require_teacher(actor)

        if not command.fields or command.fields - {"price", "duration_minutes"}:
            raise LessonError("invalid_lesson_data")

        if "duration_minutes" in command.fields and command.duration_minutes is not None:
            self.policy.require_duration(command.duration_minutes)

        async with self.persistence.transaction() as unit:
            await unit.lessons.lock_calendar(actor.account_id)

            preferences = await unit.lessons.preferences(actor.account_id)

            if "price" in command.fields:
                preferences = replace(preferences, price=command.price)

            if "duration_minutes" in command.fields:
                preferences = replace(preferences, duration_minutes=command.duration_minutes)

            await unit.lessons.save_preferences(actor.account_id, preferences)

            return preferences
