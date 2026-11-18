# api

Первый HTTP API TutorFlow. Базовый путь `/api/v1`. Правила, причины и статусы собраны в [ADR](../adr/README.md).

- [Identity](identity.md) — аккаунт, личный профиль, включение кабинета преподавателя, сессии и граница договора входа.
- [Students](students.md) — карточки, приглашения, связи и представления кабинетов.

## Общий договор

- JSON UTF-8; неизвестные поля запрещены. UUID передаются строкой, время — RFC 3339 UTC. Владелец определяется сервером.
- Ответы аутентификации, приглашений и приватных маршрутов — `Cache-Control: no-store`. Секреты и контакты не передаются в пути или query API, не записываются в журналы и ошибки.
- API использует cookie и CSRF. Любой POST/PATCH/PUT/DELETE требует cookie context и `X-CSRF-Token`. Для CLI сначала `GET /auth/csrf` с cookie jar. До входа возможны выдача CSRF, маршруты регистрации, входа, восстановления, предпросмотр приглашения и проверка процесса; прочие описанные маршруты требуют активного подтверждённого аккаунта.
- Списки: `limit` от 1 до 100, по умолчанию 20; `cursor` подписан и привязан к актору, фильтру и сортировке. Результат `{items, next_cursor}`, без общего числа чужих объектов. Порядок — по `created_at DESC` и ID DESC; карточки по `updated_at DESC, student_card_id DESC`. В преподавательском списке `status=active` по умолчанию, `status=archived` — свой архив.
- `expected_version` передаётся только там, где указан в таблицах маршрутов; это целое >= 1. При устаревшей версии — 409 без записи. Для принятия и отзыва ссылки используется проверка её текущего состояния под блокировкой; см. [повторы](students.md#принятие-и-повтор).
- Схемы запросов и ответов публикуются в OpenAPI запущенного приложения.

## Ошибки

`application/problem+json`: `type` (URI `urn:tutorflow:problem:<code>`), `title, status, detail, instance, code, request_id`. У `instance` нет query; для 422 допускаются `errors: [{field, code}]` без исходных значений.

| HTTP | Код | Когда |
| --- | --- | --- |
| 401 | authentication_required | Нет действующей подтверждённой сессии для защищённого действия |
| 403 | csrf_failed | Неверный контекст, CSRF или Origin |
| 403 | teacher_cabinet_required | Собственный кабинет преподавателя не включён |
| 404 | resource_not_found | Объект отсутствует либо недоступен |
| 400 | invitation_unavailable, challenge_invalid | Приглашение или код недоступны. Причина и результат скрыты |
| 401 | invalid_credentials | Данные входа не подходят |
| 413 | request_too_large | Тело изменяющего запроса больше 16 КиБ |
| 409 | version_conflict, invitation_already_accepted, invitation_acceptance_conflict, student_card_already_linked | Конфликт для разрешённого вызывающему действия |
| 422 | validation_failed, cursor_invalid | Неверная форма запроса или курсора |
| 429 | rate_limited | Превышен лимит, с `Retry-After` |
| 503 | dependency_unavailable | Операция не может быть надёжно выполнена, частичного успеха нет |
