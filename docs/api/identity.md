# identity API

Пути относительно `/api/v1`. Сессии описаны в [identity](../adr/identity.md), поля в [data](../adr/privacy.md).

| Метод и путь | Вход | Успех и доступ |
| --- | --- | --- |
| GET /auth/csrf | — | 200 `{csrf_token}`; анонимный или текущий контекст с cookie |
| DELETE /auth/session | — | 204; отзыв текущей сессии и очистка cookie |
| GET /auth/sessions | limit, cursor | 200 список собственных SessionSummary |
| DELETE /auth/sessions/{session_id} | — | 204 отзыв своей сессии; для текущей также очищается cookie |
| POST /auth/sessions/revoke-all | — | 204 отзыв всех своих сессий и очистка cookie |
| GET /me | — | 200 AccountSelf для владельца аккаунта |
| GET /me/profile | — | 200 AccountProfile для владельца |
| PATCH /me/profile | `{display_name?, timezone?, expected_version}` | 200 AccountProfile; хотя бы одно изменяемое поле |
| PUT /me/teacher-cabinet | — | 201 TeacherCabinet при явном включении, 200 при повторе |
| GET /cabinets | — | 200 `{teacher_enabled, student_available, parent_available}` для навигации |

`AccountSelf`: `account_id, status, login_contact: {type, value, verified_at}`. Контакт виден только его владельцу. `AccountProfile`: `display_name, timezone, version`. `TeacherCabinet`: `enabled_at`. `SessionSummary`: `session_id, created_at, last_seen_at, expires_at, is_current`; без сырого IP, fingerprint и User-Agent.

Признаки `student_available` и `parent_available` вычисляются по наличию доступных карточек в соответствующей роли. Это подсказки для интерфейса; сами маршруты снова проверяют доступ. Identity возвращает сведения об аккаунте и кабинете преподавателя, students проверяет учебные связи, общий маршрут собирает результат.

## Договор регистрации и входа

В новом аккаунте используется один из вариантов `login_contact.type`: `email` или `phone`. Пользователь подтверждает владение контактом и заполняет `display_name` и `timezone` для единственного профиля. Нельзя передать начальную учебную роль или учительский кабинет как часть профиля. Включение кабинета преподавателя и принятие приглашения — явные отдельные запросы после входа.

| Метод и путь | Вход | Успех |
| --- | --- | --- |
| POST /auth/registrations | `{login_contact: {type, value}, entrypoint, invitation_token?}` | 202 `{challenge_id}` |
| POST /auth/registrations/complete | `{challenge_id, code, password, display_name, timezone, invitation_token?}` | 201 `{account, csrf_token}` с новой cookie |
| POST /auth/login | `{login_contact: {type, value}, password}` | 200 `{account, csrf_token}` с новой cookie |
| POST /auth/password-resets | `{login_contact: {type, value}}` | 202 `{challenge_id}` |
| POST /auth/password-resets/complete | `{challenge_id, code, password}` | 204 |

`entrypoint` имеет значение `teacher` или `invitation`. Для приглашения тот же `invitation_token` нужен на обоих шагах. На пути преподавателя токен запрещён. Неизвестный, неверный и исчерпанный код дают одинаковый `400 challenge_invalid`. Вход с неверными данными даёт `401 invalid_credentials`. Email проверяется синтаксически и нормализуется. Телефон вводится в международном формате с «+». Код содержит 8 цифр. Пароль от 15 до 128 символов.

У ответа на запрос регистрации или сброса статус 202 и случайный `challenge_id`. Формат одинаков для доступных и недоступных логинов. Доступный код отправляется только после фиксации записи. После 202 интерфейс предлагает ввести код и повторить запрос, если код не пришёл. Восстановление отправляет код по текущему подтверждённому каналу и аннулирует предыдущий запрос. Просроченный, неверный, исчерпанный или уже использованный код дают одну ошибку `challenge_invalid`. После сброса все старые сессии отозваны, cookie запроса очищается и требуется обычный вход. [ADR Identity](../adr/identity.md)
