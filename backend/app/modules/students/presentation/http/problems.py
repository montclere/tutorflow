"""HTTP-представление ошибок сценариев Students."""

from fastapi import Request

from app.modules.students.domain.exceptions import StudentError
from app.shared.presentation.problems import ProblemResponse, problem_response, request_id


STUDENT_STATUSES = {
    "adult_required": 403,
    "adult_limit_reached": 409,
    "adult_already_connected": 409,
    "adult_connection_not_found": 404,
    "adult_invitation_not_found": 404,
    "teacher_required": 403,
    "student_required": 403,
    "student_card_not_found": 404,
    "student_profile_not_found": 404,
    "student_connection_not_found": 404,
    "student_already_connected": 409,
    "student_card_archived": 409,
    "invitation_invalid": 400,
    "invalid_student_data": 422,
    "invalid_student_price": 422,
}


async def student_problem(request: Request, error: Exception) -> ProblemResponse:
    assert isinstance(error, StudentError)

    return problem_response(request_id(request), STUDENT_STATUSES[error.code], error.code)
