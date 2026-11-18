# backend

Модульный монолит TutorFlow. Первое API под `/api/v1` обслуживает аккаунты, личные профили, кабинет преподавателя, приглашения, карточки и родительский доступ. Документация API доступна на `/docs`, OpenAPI — на `/openapi.json`. Контракт и правила описаны в [docs/api](../docs/api/README.md).

## Локальный запуск

Нужен отдельный PostgreSQL. Из корня репозитория установите окружение командой `./scripts/dev.sh setup`, затем перейдите в `backend`. Пример для локальной БД без внешней доставки:

```bash
export TUTORFLOW_DATABASE_URL='postgresql+psycopg://localhost/tutorflow_dev'
export TUTORFLOW_SECRET_KEY="$(uv run --no-sync python -c 'import secrets; print(secrets.token_urlsafe(48))')"
export TUTORFLOW_INSECURE_LOCAL_HTTP=1
export TUTORFLOW_LOCAL_INBOX="$(mktemp -d)"
uv run --no-sync alembic upgrade head
uv run --no-sync uvicorn app.main:create_app --factory --host 127.0.0.1 --no-access-log --no-proxy-headers
```

Подставьте URL своей БД. `GET /api/v1/health` проверяет, что процесс отвечает. Проверка жизнеспособности процесса не заменяет проверку подключения к БД. Локальный приёмник пишет тестовый телефон и код в файл с доступом только владельцу. Используйте вымышленные данные в изолированной среде и удалите файлы после проверки.

Для проверки обоих каналов удобнее запустить [полный dev](../scripts/README.md). SMTP без TLS допускается только для сервиса `mailpit` внутри dev Compose. Production требует HTTPS origin, защищённые cookie, SMTP с TLS и реквизиты SMSC. Возможный сбой отправки не раскрывает наличие аккаунта через ответ на запрос кода. [Окружения](../deploy/README.md)

## Миграции и тесты

- `uv run --no-sync alembic upgrade head` применяет схему. `alembic upgrade head --sql` позволяет проверить SQL перед применением. Приложение само таблицы не создаёт.
- Миграция `0001` добавляет таблицы с нуля. `downgrade base` удаляет их вместе с данными и допустим только на расходуемой тестовой БД. Для отката кода оставьте добавленную схему. Процедуры резервирования и восстановления для рабочей среды входят в подготовку выпуска.
- Общий `./scripts/dev.sh check` поднимает отдельную PostgreSQL и передаёт её URL тестам. Точечный прогон в backend можно запустить через `TUTORFLOW_TEST_DATABASE_URL=... uv run --no-sync pytest` на отдельной БД. Без URL интеграционные сценарии пропускаются в точечном прогоне.
- Одноразовой ручной очистке нужен `TUTORFLOW_DATABASE_URL`. Для dev SMS можно дополнительно указать `TUTORFLOW_APP_ENV=development` и `TUTORFLOW_LOCAL_INBOX`. Запуск из backend: `uv run --no-sync python -m app.maintenance`. В Compose работает отдельный цикл очистки.
- Код аутентификации и доставки находится в `app/modules/identity`, учебные сценарии в `app/modules/students`. `app/main.py` собирает приложение, а `app/composition.py` задаёт межмодульные зависимости и транзакции.
