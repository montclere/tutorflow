"""Собранные сценарии занятий, ответов и пользовательских значений по умолчанию."""

from dataclasses import dataclass

from app.modules.scheduling.application.services.lesson_cancellation import (
    LessonCancellationService,
)
from app.modules.scheduling.application.services.lesson_changes import LessonChangeService
from app.modules.scheduling.application.services.lesson_creation import LessonCreationService
from app.modules.scheduling.application.services.lesson_preferences import (
    TeachingPreferencesService,
)
from app.modules.scheduling.application.services.lesson_queries import LessonQueryService
from app.modules.scheduling.application.services.lesson_replies import LessonReplyService
from app.modules.scheduling.application.services.lesson_requests import LessonRequestService
from app.modules.scheduling.domain.policies import LessonPolicy


@dataclass(frozen=True)
class LessonServices:
    creation: LessonCreationService
    changes: LessonChangeService
    queries: LessonQueryService
    replies: LessonReplyService
    preferences: TeachingPreferencesService
    policy: LessonPolicy
    cancellation: LessonCancellationService
    requests: LessonRequestService
