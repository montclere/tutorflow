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


MAX_VALIDATION_ERRORS = 20
DESCRIPTIONS = {
    "lesson_cancelled": "Сначала восстановите отменённое занятие или участие.",
    "lesson_group_required": "Отдельная отмена участия доступна для группового занятия.",
    "group_reschedule_forbidden": "Участник группы может запросить отмену своего участия.",
    "invalid_lesson_change_request": "Проверьте вид запроса и предложенное время.",
    "lesson_change_request_conflict": "Запрос уже рассмотрен либо занятие изменилось.",
    "lesson_change_request_not_found": "Запрос изменения занятия недоступен.",
    "series_not_found": "Серия не найдена.",
    "series_conflict": "Расписание изменилось; прочитайте актуальную версию.",
    "series_request_conflict": "Идентификатор запроса уже использован с другим содержанием.",
    "series_source_mismatch": "Исходное занятие не соответствует первому повторению.",
    "series_past_change": "Прошедшие и начавшиеся события не изменяются этой операцией.",
    "series_pause_not_found": "Действующая пауза не найдена.",
    "series_confirmation_required": "Подтвердите изменение согласованного расписания.",
    "series_time_conflict": "Откройте серию и разрешите конфликт местного времени.",
    "series_expansion_limit": "Сузьте диапазон подготовки или выберите одну серию.",
    "invalid_series_rule": "Некорректное правило повторения.",
    "invalid_series_pause": "Некорректный период паузы.",
    "group_conflict": "Состав группы изменился. Повторите действие.",
    "lesson_not_found": "Занятие недоступно.",
    "lesson_participant_required": "Операция доступна участнику занятия.",
    "lesson_response_forbidden": "Ответить может только ответственный за расписание карточки.",
    "lesson_conflict": "Занятие изменилось. Откройте его и повторите действие.",
    "lesson_request_conflict": "Этот идентификатор запроса уже использован с другими данными.",
    "lesson_already_started": "Начавшееся или прошедшее занятие нельзя менять этим действием.",
    "lesson_reply_not_requested": "Согласование этого участия не запрашивалось.",
    "lesson_reply_expired": "Срок ответа истёк.",
    "confirmation_responsible_required": "Выберите ответственного за расписание карточки.",
    "lesson_price_required": "Укажите стоимость либо настройте значение по умолчанию.",
    "lesson_participants_required": "Для индивидуального занятия нужен хотя бы один ученик.",
    "lesson_duplicate_participant": "Один ученик не должен повторяться в занятии.",
    "lesson_participant_limit": "Состав превышает допустимый размер одного запроса.",
    "invalid_lesson_data": "Проверьте данные занятия.",
    "invalid_lesson_time": "Укажите точное время и допустимый часовой пояс.",
    "invalid_lesson_duration": "Длительность выходит за допустимые пределы.",
    "invalid_lesson_price": "Укажите точную неотрицательную стоимость занятия в рублях.",
    "invalid_lesson_reply": "Выберите подтверждение или отказ.",
    "invalid_lesson_range": "Укажите допустимый диапазон и размер страницы.",
    "invalid_lesson_cursor": "Передайте допустимую пару даты и идентификатора страницы.",
    "group_not_found": "Группа недоступна.",
    "group_member_not_found": "Участник группы недоступен.",
    "group_member_exists": "Карточка уже состоит в группе.",
    "group_archived": "Сначала восстановите группу из архива.",
    "invalid_group_data": "Проверьте название, заметку и параметры группы.",
    "invalid_group_price": "Укажите точную неотрицательную стоимость занятия в рублях.",
    "role_not_enabled": "Этот кабинет ещё не подключён к аккаунту.",
    "self_connection_forbidden": "Нельзя быть собственным учеником или взрослым самого себя.",
    "adult_required": "Операция доступна приглашённому взрослому.",
    "adult_limit_reached": "Нет свободных мест для взрослых.",
    "adult_already_connected": "Аккаунт уже подключён к этой карточке.",
    "adult_connection_not_found": "Подключение взрослого недоступно.",
    "adult_invitation_not_found": "Приглашение взрослого недоступно.",
    "invalid_registration_role": "Назначение регистрации недопустимо.",
    "request_too_large": "Размер запроса превышает допустимый предел.",
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
    "invitation_id",
    "account_id",
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
        for item in error.errors()[:MAX_VALIDATION_ERRORS]
    ]

    return problem_response(request_id(request), 422, "validation_error", errors=fields)


PROBLEM_RESPONSES: dict[int | str, dict[str, Any]] = {
    status: {
        "description": HTTPStatus(status).phrase,
        "content": {"application/problem+json": {"schema": Problem.model_json_schema()}},
    }
    for status in (400, 401, 403, 404, 405, 409, 413, 415, 422, 429, 500, 503)
}
