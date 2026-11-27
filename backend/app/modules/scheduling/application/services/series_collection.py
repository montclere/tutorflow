"""Сборка сценариев создания, изменения и согласования регулярного расписания."""

from dataclasses import dataclass

from app.modules.scheduling.application.services.series_changes import SeriesChangeService
from app.modules.scheduling.application.services.series_creation import SeriesCreationService
from app.modules.scheduling.application.services.series_pauses import SeriesPauseService
from app.modules.scheduling.application.services.series_queries import (
    SeriesCalendarPreparation,
    SeriesQueryService,
)
from app.modules.scheduling.application.services.series_replies import SeriesReplyService
from app.modules.scheduling.domain.policies import LessonPolicy


@dataclass(frozen=True)
class SeriesServices:
    creation: SeriesCreationService
    changes: SeriesChangeService
    pauses: SeriesPauseService
    queries: SeriesQueryService
    replies: SeriesReplyService
    calendar: SeriesCalendarPreparation
    policy: LessonPolicy
