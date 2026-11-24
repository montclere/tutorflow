# API аккаунта преподавателя

Все маршруты ниже начинаются с `/api/v1`. Контракт доступен в OpenAPI через `/docs`.

## Регистрация и сессия

| Метод и путь                        | Запрос                                                                                                                   | Результат                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `POST /auth/registrations`          | `{"login_contact":{"type":"email","value":"teacher@example.com"}}` или контакт `phone` с номером в международном формате | `202` и `challenge_id`. Код доставляется по выбранному каналу.          |
| `POST /auth/registrations/complete` | `challenge_id`, восьмизначный `code`, `password` от 15 до 128 символов                                                   | `201`, кабинет преподавателя и cookie сессии.                           |
| `POST /auth/login`                  | `login_contact` и `password`                                                                                             | `200`, существующий кабинет и новая cookie сессии.                      |
| `GET /auth/csrf`                    | Cookie сессии                                                                                                            | Токен для выхода.                                   |
| `DELETE /auth/session`              | Cookie сессии и заголовок `X-CSRF-Token`                                                                                 | `204`, сессия отозвана.                                                 |
| `GET /me`                           | Cookie сессии                                                                                                            | `id`, `workspace_id`, `role`, подтверждённый `login_contact` владельца. |

Успешные регистрация и вход возвращают объект `account` и `csrf_token`. Кабинет доступен сразу. Роль `teacher` назначает сервер. Сессия действует до семи суток и хранится на сервере. Cookie использует HttpOnly, Secure и SameSite=Lax. Повторный вход из того же браузера заменяет его текущую сессию.

Код действует десять минут и допускает пять неверных попыток. Новый код можно запросить через 45 секунд. Успешное подтверждение погашает код и создаёт аккаунт и сессию одной транзакцией. Повторная регистрация не перезаписывает аккаунт. Запрос кода возвращает одинаковый формат для существующего и нового контакта. Ответ `202` сообщает о принятии запроса. Доставка выполняется после ответа.

Неверный, использованный или просроченный код возвращает `400 challenge_invalid`. Неизвестный контакт и неверный пароль возвращают `401 invalid_credentials`. Отсутствующая или истёкшая сессия возвращает `401 authentication_required`, превышение лимита запросов — `429 rate_limited`.

## Локальный запуск

1. Скопируйте `deploy/.env.example` в `deploy/.env` и задайте пароль PostgreSQL. Запустите базу и перехватчик сообщений командой `docker compose --env-file deploy/.env -f deploy/compose.yaml --profile identity up -d db mailpit`.
2. В окружении API задайте `IDENTITY_DATABASE_URL` с драйвером `postgresql+psycopg` и `IDENTITY_SECRET` со случайным значением, например сгенерированным через `openssl rand -hex 32`. Для локального Mailpit задайте `IDENTITY_LOCAL_MAILPIT=1`, а для HTTP на loopback — `IDENTITY_SECURE_COOKIE=0`.
3. Примените миграции через `uv run --directory backend --locked alembic upgrade head` и запустите `uv run --directory backend --locked uvicorn app.main:app`. API откроется на `http://127.0.0.1:8000/docs`.
4. В Mailpit на `http://127.0.0.1:8025` будут email-коды и локальные копии SMS-кодов. Для телефона используется адрес вида `sms-15551234567@tutorflow.invalid`.

Для реальной отправки почты API использует `IDENTITY_SMTP_HOST`, `IDENTITY_SMTP_PORT`, `IDENTITY_SMTP_FROM`, `IDENTITY_SMTP_USER` и `IDENTITY_SMTP_PASSWORD`. Для SMS используются `IDENTITY_SMSC_API_KEY` и необязательный `IDENTITY_SMSC_SENDER`. В реальном окружении локальный режим выключен, Secure cookie включена, а прокси передаёт адрес клиента только из доверенного источника.
