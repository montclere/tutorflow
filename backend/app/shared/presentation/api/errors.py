"""Договор Problem Details для ответов и OpenAPI."""

from collections.abc import Mapping
from dataclasses import dataclass
from http import HTTPStatus
from typing import Any, Literal
from uuid import UUID

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from fastapi.routing import APIRoute
from fastapi.utils import is_body_allowed_for_status_code
from pydantic import BaseModel
from starlette.datastructures import Headers
from starlette.exceptions import HTTPException
from starlette.routing import Match

from app.shared.domain.errors import Problem, ProblemCode

MEDIA_TYPE = "application/problem+json"


@dataclass(frozen=True)
class ProblemType:
    status: int
    title: str
    detail: str


PROBLEMS = {
    ProblemCode.INVALID_REQUEST: ProblemType(
        400, "Некорректный запрос", "Проверьте синтаксис запроса."
    ),
    ProblemCode.CHALLENGE_INVALID: ProblemType(
        400, "Код неверный или истёк", "Проверьте код или запросите новый."
    ),
    ProblemCode.INVITATION_UNAVAILABLE: ProblemType(
        400, "Приглашение недоступно", "Запросите новую ссылку у репетитора."
    ),
    ProblemCode.AUTHENTICATION_REQUIRED: ProblemType(
        403, "Требуется вход", "Войдите, чтобы продолжить."
    ),
    ProblemCode.INVALID_CREDENTIALS: ProblemType(
        403, "Не удалось войти", "Проверьте логин и пароль."
    ),
    ProblemCode.CSRF_FAILED: ProblemType(
        403, "Запрос не подтверждён", "Обновите контекст сессии и повторите действие."
    ),
    ProblemCode.TEACHER_CABINET_REQUIRED: ProblemType(
        403, "Требуется кабинет репетитора", "Включите кабинет репетитора."
    ),
    ProblemCode.FORBIDDEN: ProblemType(
        403, "Доступ запрещён", "Действие для этого пользователя недоступно."
    ),
    ProblemCode.RESOURCE_NOT_FOUND: ProblemType(
        404, "Ресурс не найден", "Ресурс отсутствует или недоступен."
    ),
    ProblemCode.METHOD_NOT_ALLOWED: ProblemType(
        405, "Метод не поддерживается", "Используйте метод из заголовка Allow."
    ),
    ProblemCode.VERSION_CONFLICT: ProblemType(
        409, "Запись изменилась", "Откройте актуальную запись перед сохранением."
    ),
    ProblemCode.INVITATION_ALREADY_ACCEPTED: ProblemType(
        409, "Приглашение уже принято", "Отзыв принятого приглашения недоступен."
    ),
    ProblemCode.INVITATION_ACCEPTANCE_CONFLICT: ProblemType(
        409, "Приглашение принято с другими данными", "Для повтора используйте исходные данные."
    ),
    ProblemCode.STUDENT_CARD_ALREADY_LINKED: ProblemType(
        409, "Карточка уже привязана", "У ученика уже есть карточка у этого репетитора."
    ),
    ProblemCode.PARENT_APPLICATION_CONFLICT: ProblemType(
        409, "Заявка недоступна", "Обновите список заявок на доступ."
    ),
    ProblemCode.LESSON_STUDENT_NOT_LINKED: ProblemType(
        409, "Ученик не подключён", "Выберите карточку с активным учеником."
    ),
    ProblemCode.LESSON_TIME_CONFLICT: ProblemType(
        409, "Время уже занято", "Выберите другое время и повторите действие."
    ),
    ProblemCode.LESSON_STATE_CONFLICT: ProblemType(
        409, "Действие недоступно", "Откройте актуальную карточку занятия."
    ),
    ProblemCode.LESSON_CREATE_CONFLICT: ProblemType(
        409, "Запрос уже использован", "Откройте новую форму занятия."
    ),
    ProblemCode.LESSON_RESCHEDULE_PENDING: ProblemType(
        409, "Перенос уже предложен", "Откройте действующее предложение."
    ),
    ProblemCode.LESSON_ABSENCE_NOTICE_PENDING: ProblemType(
        409, "Предупреждение уже есть", "Откройте действующее предупреждение."
    ),
    ProblemCode.STUDENT_CARD_HAS_OPEN_LESSONS: ProblemType(
        409,
        "У карточки есть открытые уроки",
        "Отмените будущие занятия и поставьте отметки за прошедшие.",
    ),
    ProblemCode.PRECONDITION_REQUIRED: ProblemType(
        428, "Требуется версия записи", "Обновите карточку перед удалением."
    ),
    ProblemCode.PRECONDITION_FAILED: ProblemType(
        412, "Версия записи изменилась", "Обновите карточку перед удалением."
    ),
    ProblemCode.REQUEST_TOO_LARGE: ProblemType(
        413, "Запрос слишком большой", "Допустимое тело запроса — до 16 КиБ."
    ),
    ProblemCode.UNSUPPORTED_MEDIA_TYPE: ProblemType(
        415, "Тип содержимого не поддерживается", "Отправьте тело запроса как JSON."
    ),
    ProblemCode.VALIDATION_FAILED: ProblemType(
        422, "Данные не прошли проверку", "Проверьте формат и заполнение полей."
    ),
    ProblemCode.CURSOR_INVALID: ProblemType(
        422, "Курсор недействителен", "Начните чтение списка с первой страницы."
    ),
    ProblemCode.RATE_LIMITED: ProblemType(
        429, "Слишком много запросов", "Повторите запрос после указанной задержки."
    ),
    ProblemCode.INTERNAL_ERROR: ProblemType(
        500, "Внутренняя ошибка", "Не удалось выполнить запрос."
    ),
    ProblemCode.DEPENDENCY_UNAVAILABLE: ProblemType(
        503, "Сервис временно недоступен", "Попробуйте позже."
    ),
}

HTTP_PROBLEMS = {
    PROBLEMS[code].status: code
    for code in (
        ProblemCode.INVALID_REQUEST,
        ProblemCode.FORBIDDEN,
        ProblemCode.RESOURCE_NOT_FOUND,
        ProblemCode.METHOD_NOT_ALLOWED,
        ProblemCode.REQUEST_TOO_LARGE,
        ProblemCode.UNSUPPORTED_MEDIA_TYPE,
        ProblemCode.VALIDATION_FAILED,
        ProblemCode.RATE_LIMITED,
        ProblemCode.INTERNAL_ERROR,
        ProblemCode.DEPENDENCY_UNAVAILABLE,
    )
}
HTTP_METHODS = ("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "CONNECT", "TRACE")

JSON_BODY_ERRORS = (
    ProblemCode.INVALID_REQUEST,
    ProblemCode.UNSUPPORTED_MEDIA_TYPE,
    ProblemCode.VALIDATION_FAILED,
)
MUTATION_ERRORS = (ProblemCode.CSRF_FAILED, ProblemCode.REQUEST_TOO_LARGE)
CREATED_RESOURCE = {
    201: {
        "headers": {
            "Location": {
                "description": "URI созданного ресурса",
                "schema": {"type": "string", "format": "uri-reference"},
            }
        }
    }
}


class FieldProblem(BaseModel):
    field: str
    code: Literal["required", "invalid_value", "unknown_field"]


class LocalTimeProblem(BaseModel):
    series_position: int
    local_date: str
    code: Literal["nonexistent", "ambiguous"]


class ProblemDetails(BaseModel):
    type: str
    title: str
    status: int
    detail: str
    instance: str
    code: str
    request_id: UUID
    errors: list[FieldProblem] | None = None
    local_time_issue: LocalTimeProblem | None = None


def _document(
    request: Request,
    code: str,
    spec: ProblemType,
    headers: Mapping[str, str] | None,
    fields: list[FieldProblem] | None = None,
    *,
    problem_type: str | None = None,
    local_time_issue: LocalTimeProblem | None = None,
) -> JSONResponse:
    request_id: UUID = request.state.request_id
    document = ProblemDetails(
        type=problem_type or f"urn:tutorflow:problem:{code}",
        title=spec.title,
        status=spec.status,
        detail=spec.detail,
        instance=request_id.urn,
        code=code,
        request_id=request_id,
        errors=fields or None,
        local_time_issue=local_time_issue,
    )
    return JSONResponse(
        document.model_dump(mode="json", exclude_none=True),
        status_code=spec.status,
        media_type=MEDIA_TYPE,
        headers=headers,
    )


def problem_response(
    request: Request,
    problem: Problem,
    fields: list[FieldProblem] | None = None,
    *,
    headers: Mapping[str, str] | None = None,
    local_time_issue: LocalTimeProblem | None = None,
) -> JSONResponse:
    result_headers = dict(headers or {})
    if problem.retry_after is not None:
        result_headers["Retry-After"] = str(problem.retry_after)
    return _document(
        request,
        problem.code.value,
        PROBLEMS[problem.code],
        result_headers,
        fields,
        local_time_issue=local_time_issue,
    )


def validation_problem(request: Request, error: RequestValidationError) -> JSONResponse:
    issues = error.errors()
    if any(item["type"] == "json_invalid" for item in issues):
        return problem_response(request, Problem(ProblemCode.INVALID_REQUEST))
    fields = []
    for item in issues:
        location = item["loc"]
        error_type = item["type"]
        if error_type == "extra_forbidden":
            issue = FieldProblem(field="body", code="unknown_field")
        else:
            field = ".".join(str(part) for part in location[:2])
            issue = FieldProblem(
                field=field, code="required" if error_type == "missing" else "invalid_value"
            )
        if issue not in fields:
            fields.append(issue)
    return problem_response(request, Problem(ProblemCode.VALIDATION_FAILED), fields)


def framework_problem(request: Request, error: HTTPException) -> Response:
    headers = {
        key: value
        for key, value in (error.headers or {}).items()
        if key.lower() not in {"content-type", "content-length"}
    }
    if not is_body_allowed_for_status_code(error.status_code):
        return Response(status_code=error.status_code, headers=headers)
    if error.status_code == 401 and not Headers(headers).get("www-authenticate"):
        return problem_response(
            request, Problem(ProblemCode.AUTHENTICATION_REQUIRED), headers=headers
        )
    if error.status_code == 405:
        allowed = {
            method
            for method in HTTP_METHODS
            if any(
                route.matches({**request.scope, "method": method})[0] is Match.FULL
                for route in request.app.router.routes
            )
        }
        provided_allow = Headers(headers).get("allow")
        if provided_allow:
            allowed.update(method.strip() for method in provided_allow.split(",") if method.strip())
        headers = {name: value for name, value in headers.items() if name.lower() != "allow"}
        headers["Allow"] = ", ".join(sorted(allowed))
    if code := HTTP_PROBLEMS.get(error.status_code):
        return problem_response(request, Problem(code), headers=headers)
    try:
        title = HTTPStatus(error.status_code).phrase
    except ValueError:
        title = "Ошибка HTTP"
    return _document(
        request,
        "request_failed",
        ProblemType(error.status_code, title, "Не удалось выполнить запрос."),
        headers,
        problem_type="about:blank",
    )


class JsonRoute(APIRoute):
    """Проверяет формат тела на маршрутах с входной JSON-схемой."""

    def get_route_handler(self):
        handle = super().get_route_handler()

        async def json_handler(request: Request) -> Response:
            media = request.headers.get("content-type", "").partition(";")[0].strip().lower()
            is_json = media == "application/json" or (
                media.startswith("application/") and media.endswith("+json")
            )
            if self.body_field and not is_json and await request.body():
                raise Problem(ProblemCode.UNSUPPORTED_MEDIA_TYPE)
            return await handle(request)

        return json_handler


def problem_responses(*codes: ProblemCode) -> dict[int | str, dict[str, Any]]:
    responses: dict[int | str, dict[str, Any]] = {}
    for code in codes:
        spec = PROBLEMS[code]
        response = responses.setdefault(
            spec.status,
            {
                "description": HTTPStatus(spec.status).phrase,
                "content": {
                    MEDIA_TYPE: {"schema": {"$ref": "#/components/schemas/ProblemDetails"}}
                },
                "x-problem-codes": [],
            },
        )
        response["x-problem-codes"].append(code.value)
        if code is ProblemCode.RATE_LIMITED:
            response["headers"] = {
                "Retry-After": {
                    "description": "Задержка в секундах",
                    "schema": {"type": "integer", "minimum": 1},
                }
            }
    return responses


def include_problem_schema(app: FastAPI) -> None:
    original_openapi = app.openapi

    def openapi():
        document = original_openapi()
        schemas = document.setdefault("components", {}).setdefault("schemas", {})
        schema = ProblemDetails.model_json_schema(ref_template="#/components/schemas/{model}")
        schemas.update(schema.pop("$defs", {}))
        schemas["ProblemDetails"] = schema
        return document

    app.openapi = openapi
