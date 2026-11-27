"""Единое представление отказов назначения, согласования и изменения занятий."""

from fastapi import Request

from app.modules.scheduling.domain.exceptions import LessonError
from app.shared.presentation.problems import ProblemResponse, problem_response, request_id


LESSON_STATUSES = {
    "lesson_cancelled": 409,
    "lesson_group_required": 422,
    "group_reschedule_forbidden": 422,
    "invalid_lesson_change_request": 422,
    "lesson_change_request_conflict": 409,
    "lesson_change_request_not_found": 404,
    "series_not_found": 404,
    "series_conflict": 409,
    "series_request_conflict": 409,
    "series_source_mismatch": 409,
    "series_past_change": 409,
    "series_pause_not_found": 404,
    "series_confirmation_required": 409,
    "series_time_conflict": 409,
    "series_expansion_limit": 422,
    "invalid_series_rule": 422,
    "invalid_series_pause": 422,
    "teacher_required": 403,
    "lesson_participant_required": 403,
    "lesson_response_forbidden": 403,
    "lesson_not_found": 404,
    "student_card_not_found": 404,
    "student_profile_not_found": 404,
    "group_not_found": 404,
    "group_conflict": 409,
    "group_archived": 409,
    "student_card_archived": 409,
    "lesson_conflict": 409,
    "lesson_request_conflict": 409,
    "lesson_already_started": 409,
    "lesson_reply_not_requested": 409,
    "lesson_reply_expired": 409,
    "confirmation_responsible_required": 409,
    "lesson_price_required": 422,
    "lesson_participants_required": 422,
    "lesson_duplicate_participant": 422,
    "lesson_participant_limit": 422,
    "invalid_lesson_data": 422,
    "invalid_lesson_time": 422,
    "invalid_lesson_duration": 422,
    "invalid_lesson_price": 422,
    "invalid_lesson_reply": 422,
    "invalid_lesson_range": 422,
    "invalid_lesson_cursor": 422,
}


async def lesson_problem(request: Request, error: Exception) -> ProblemResponse:
    assert isinstance(error, LessonError)

    return problem_response(request_id(request), LESSON_STATUSES[error.code], error.code)
