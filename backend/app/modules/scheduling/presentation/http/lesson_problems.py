"""Единое представление отказов назначения, согласования и изменения занятий."""

from fastapi import Request

from app.modules.scheduling.domain.exceptions import LessonError
from app.shared.presentation.problems import ProblemResponse, problem_response, request_id


LESSON_STATUSES = {
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
