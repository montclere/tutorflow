# scripts

Команды рассчитаны на Linux с Docker Compose v2, Node.js 22+, npm, Python 3, uv и curl. Выполняйте из корня проекта.

| Команда | Результат |
| --- | --- |
| `./scripts/dev.sh setup` | Ставит зафиксированные зависимости, Chromium для Playwright и локальные образы. Нужна сеть |
| `./scripts/dev.sh up` | Собирает интерфейс и запускает dev на [http://127.0.0.1:18760](http://127.0.0.1:18760) |
| `./scripts/dev.sh inbox` | Читает тестовые SMS из закрытого локального приёмника, начиная с последних сообщений |
| `./scripts/dev.sh check` | Запускает проверки модуля на отдельном тестовом стеке и удаляет созданное им тестовое окружение |
| `./scripts/dev.sh down` | Останавливает dev с сохранением его БД |
| `./scripts/dev.sh build-prod TAG` | Собирает образы backend и web с заданным тегом |

Dev использует проект Compose `tutorflow-dev`, том PostgreSQL и каталог `.local-stack/tutorflow-dev`. Порт можно задать через `TUTORFLOW_DEV_PORT`. Для входа открывайте именно адрес, который печатает `up`. После изменения TypeScript или CSS повторите `up` для сборки. После правок backend используйте `down` и `up`. Если изменились зависимости, повторите `setup`. Письма открываются в [Mailpit](http://127.0.0.1:18761), телефонные коды показывает `./scripts/dev.sh inbox`. Порт Mailpit задаётся через `TUTORFLOW_DEV_MAILPIT_PORT`. В dev используются вымышленные контакты, например `teacher@example.org` и `+79990000042`.

`check` требует успешного `setup`, выполняется локально без внешней сети и не использует данные запущенного dev. Для него создаются собственный проект Compose, случайные loopback-порты, БД, Mailpit и SMS-приёмник. Backend запускает Ruff, Pyright и pytest с реальным PostgreSQL. Frontend проверяет синтаксис скриптов и типы, собирает ES-модули и запускает Chromium. Deploy валидирует Compose обоих режимов, конфиг Caddy и живой HTTP healthcheck. Результат общего прогона записывайте в PR по [workflow](../docs/workflow.md).
