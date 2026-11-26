"""Единое HTTP-представление ошибок групп и членства."""

from fastapi import Request

from app.modules.groups.domain.exceptions import GroupError
from app.shared.presentation.problems import ProblemResponse, problem_response, request_id


GROUP_STATUSES = {
    "group_not_found": 404,
    "group_member_not_found": 404,
    "group_member_exists": 409,
    "group_archived": 409,
    "invalid_group_data": 422,
    "invalid_group_price": 422,
    "student_card_not_found": 404,
    "student_card_archived": 409,
    "teacher_required": 403,
}


async def group_problem(request: Request, error: Exception) -> ProblemResponse:
    assert isinstance(error, GroupError)

    return problem_response(request_id(request), GROUP_STATUSES[error.code], error.code)
