# deploy

Compose запускает PostgreSQL, отдельный контейнер миграции, FastAPI и Caddy. Caddy отдаёт интерфейс и проксирует API на том же origin. Общие настройки лежат в [compose.yaml](compose.yaml), различия среды — в [compose.dev.yaml](compose.dev.yaml) и [compose.prod.yaml](compose.prod.yaml).

| | Dev | Prod |
| --- | --- | --- |
| Проект | `tutorflow-dev` | `tutorflow-prod` |
| Адрес | Loopback HTTP | HTTPS на указанном DNS-имени |
| База | Отдельный локальный том. Только тестовый стек публикует порт БД на loopback | Отдельный том, порт только в приватной сети Compose |
| Доставка | Mailpit для email и закрытый каталог для тестовых SMS | SMTP с TLS и SMSC по HTTPS |
| Артефакты | Локальная сборка интерфейса и исходники на чтение | Версионированные образы с собранными статическими файлами |

Dev запускается по [локальной инструкции](../scripts/README.md). В prod локальная доставка запрещена конфигурацией backend. Caddy использует HTTPS, backend выдаёт Secure cookie. Backend и PostgreSQL не открывают порты на хосте. Генерируемые ключи, env-файлы рабочей среды и контакты хранятся вне Git.

## Сетевые порты

| Компонент | Порт внутри Compose | Dev на хосте | Test на хосте | Prod на хосте |
| --- | --- | --- | --- | --- |
| Caddy | HTTP `80/tcp`, в prod также HTTPS `443/tcp` | `127.0.0.1:18760`, `TUTORFLOW_DEV_PORT` | Свободный порт на `127.0.0.1` | `0.0.0.0:80` и `0.0.0.0:443`, переменные `TUTORFLOW_BIND_IP`, `TUTORFLOW_HTTP_PORT` и `TUTORFLOW_HTTPS_PORT` |
| API | `api:8000/tcp` | Через Caddy, путь `/api/v1` | Через Caddy, путь `/api/v1` | Через Caddy, путь `/api/v1` |
| PostgreSQL | `db:5432/tcp` | Только Compose | Свободный порт на `127.0.0.1` | Только Compose |
| Mailpit | SMTP `mailpit:1025/tcp`, UI/API `mailpit:8025/tcp` | UI/API на `127.0.0.1:18761`, `TUTORFLOW_DEV_MAILPIT_PORT` | UI/API на свободном порту `127.0.0.1` | Сервис отсутствует |

`./scripts/dev.sh up` печатает оба dev-адреса. Для переопределения, например, запустите `TUTORFLOW_DEV_PORT=18770 TUTORFLOW_DEV_MAILPIT_PORT=18771 ./scripts/dev.sh up`. Проверка сама выделяет порты и использует собственный проект и БД. Сетевая конфигурация prod публикует только Caddy. При использовании нестандартного HTTPS-порта укажите фактический HTTPS origin с портом. SMTP prod — исходящее соединение на `TUTORFLOW_SMTP_PORT` (по умолчанию `465`), SMSC — исходящий HTTPS `443`. Контейнеры миграции и очистки не публикуют порты, SMS inbox в dev — локальный каталог.

## Подготовка prod

Из корня проекта соберите образы командой `./scripts/dev.sh build-prod TAG`. Шаблон конфигурации находится в [prod.env.example](prod.env.example). Подготовьте вне Git файл окружения с секретами, отдельной БД, SMTP, SMSC и именем хоста. Указанный в env тег должен совпадать с собранными образами. Установите `TUTORFLOW_BROWSER_ORIGIN` в точный HTTPS origin, соответствующий домену. В URL БД кодируйте специальные символы пароля. На целевой машине образы нужных версий должны быть доступны локально.

```bash
docker compose --project-name tutorflow-prod --env-file /path/to/prod.env \
  -f deploy/compose.yaml -f deploy/compose.prod.yaml config --quiet
```

После разрешения на выкатку та же команда Compose с `up -d --wait --pull never` вместо `config --quiet` применяет миграции раньше старта API. Проверьте HTTPS, `GET /api/v1/health`, выдачу Secure cookie и прохождение регистрации через настоящие SMTP и SMSC. Caddy сохраняет сертификаты в отдельных томах. Служебный порт приложения находится за Caddy. API опирается на заголовки этого прокси для определения адреса клиента.

Сервис maintenance запускается после миграций и чистит истёкшие технические записи. Продолжение успешной очистки проверяется healthcheck. Mailpit и локальный каталог SMS присутствуют только в dev. Перед публичным запуском используйте [предрелизный список](../docs/pre-release.md).
