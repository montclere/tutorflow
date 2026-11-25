"""Единый HTTP-контракт ошибок RFC 9457 без содержимого запросов."""

from collections.abc import Mapping
from http import HTTPStatus
from typing import Any
from uuid import uuid4

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse


DESCRIPTIONS = {
    "student_required": "Приглашение предназначено аккаунту ученика.",
    "student_card_not_found": "Карточка недоступна.",
    "student_profile_not_found": "Учебный профиль недоступен.",
    "student_connection_not_found": "Подключение недоступно.",
    "student_already_connected": "Аккаунт уже подключён к этому преподавателю.",
    "student_card_archived": "Карточка находится в архиве.",
    "invitation_invalid": "Приглашение недействительно, истекло или уже использовано.",
    "invalid_student_data": "Проверьте данные карточки или учебного профиля.",
    "invalid_student_price": "Укажите неотрицательную стоимость в рублях с точностью до копейки.",
    "authentication_required": "Требуется вход в аккаунт.",
    "invalid_credentials": "Неверный контакт или пароль.",
    "challenge_invalid": "Код неверен, истёк или уже использован.",
    "rate_limited": "Слишком много попыток.",
    "identity_busy": "Сервис аккаунтов занят. Повторите попытку позже.",
    "invalid_password": "Пароль не соответствует допустимой длине.",
    "invalid_contact": "Проверьте адрес почты или номер телефона.",
    "csrf_invalid": "Обновите страницу и повторите действие.",
    "application_json_required": "Требуется JSON.",
    "teacher_required": "Операция доступна преподавателю.",
    "invalid_local_start": "Выберите допустимое однозначное местное время.",
    "invalid_duration": "Длительность должна быть от 5 до 480 минут.",
    "invalid_calendar_cursor": "Передайте дату и идентификатор страницы вместе.",
    "calendar_block_not_found": "Блок недоступен.",
    "calendar_block_conflict": "Запрос конфликтует с предыдущей операцией.",
    "identity_unavailable": "Сервис аккаунтов временно недоступен.",
    "database_unavailable": "База данных временно недоступна.",
    "database_schema_not_ready": "Сервис ещё не готов к работе.",
    "validation_error": "Проверьте поля запроса.",
    "internal_error": "Не удалось выполнить операцию.",
    "http_error": "Не удалось обработать запрос.",
    "not_found": "Маршрут не найден.",
    "method_not_allowed": "Метод запроса не поддерживается.",
    "metrics_unavailable": "Метрики временно недоступны.",
    "metrics_forbidden": "Доступ к метрикам запрещён.",
}
SAFE_LOCATIONS = {
    "body",
    "query",
    "path",
    "header",
    "cookie",
    "login_contact",
    "type",
    "value",
    "password",
    "challenge_id",
    "code",
    "display_name",
    "timezone",
    "local_start",
    "duration_minutes",
    "request_id",
    "block_id",
    "after_start",
    "after_id",
    "limit",
    "name",
    "notes",
    "price",
    "amount",
    "currency",
    "subject",
    "level",
    "goal",
    "duration",
    "description",
    "welcome",
    "token",
    "card_id",
    "profile_id",
    "include_archived",
    "kind",
    "contact",
}


class InvalidField(BaseModel):
    location: list[str | int]
    code: str


class Problem(BaseModel):
    type: str
    title: str
    status: int
    detail: str
    instance: str
    code: str
    request_id: str
    errors: list[InvalidField] = Field(default_factory=list)


class ProblemResponse(JSONResponse):
    media_type = "application/problem+json"


def problem_response(
    request_id: str,
    status: int,
    code: str,
    *,
    errors: list[InvalidField] | None = None,
    headers: Mapping[str, str] | None = None,
) -> ProblemResponse:
    body = Problem(
        type=f"urn:tutorflow:problem:{code}",
        title=HTTPStatus(status).phrase,
        status=status,
        detail=DESCRIPTIONS[code],
        instance=f"urn:uuid:{request_id}",
        request_id=request_id,
        code=code,
        errors=errors or [],
    )

    return ProblemResponse(
        body.model_dump(exclude_defaults=True),
        status_code=status,
        headers={**(headers or {}), "Cache-Control": "no-store", "X-Request-ID": request_id},
    )


def request_id(request: Request) -> str:
    return getattr(request.state, "request_id", str(uuid4()))


async def http_problem(request: Request, error: Exception) -> ProblemResponse:
    assert isinstance(error, HTTPException)

    default = {404: "not_found", 405: "method_not_allowed"}.get(
        error.status_code, "internal_error" if error.status_code >= 500 else "http_error"
    )
    code = (
        error.detail if isinstance(error.detail, str) and error.detail in DESCRIPTIONS else default
    )

    return problem_response(request_id(request), error.status_code, code, headers=error.headers)


async def validation_problem(request: Request, error: Exception) -> ProblemResponse:
    assert isinstance(error, RequestValidationError)

    fields = [
        InvalidField(
            location=[
                part if isinstance(part, int) or part in SAFE_LOCATIONS else "[field]"
                for part in item["loc"]
            ],
            code=item["type"],
        )
        for item in error.errors()
    ]

    return problem_response(request_id(request), 422, "validation_error", errors=fields)


PROBLEM_RESPONSES: dict[int | str, dict[str, Any]] = {
    status: {
        "description": HTTPStatus(status).phrase,
        "content": {"application/problem+json": {"schema": Problem.model_json_schema()}},
    }
    for status in (400, 401, 403, 404, 405, 409, 415, 422, 429, 500, 503)
}
