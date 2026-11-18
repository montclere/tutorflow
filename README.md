# TutorFlow

CRM и учебная платформа для репетиторов. Сейчас — каркас для совместной разработки: backend разложен по модулям и shared, продуктовые функции не реализованы. Описание: [spec](docs/spec.md).

- `backend/` — API и бизнес-логика.
- `frontend/` — интерфейс.
- `docs/` — требования, решения, задачи и workflow.
- `deploy/` — окружения и развёртывание.
- `scripts/` — общие команды.
- `.agents/skills/` — скиллы агентов, адаптированные из `forum-nstu-beta`.

Начать: [workflow](docs/workflow.md). Текущее состояние: [stages](docs/stages.md). Правила агента: [AGENTS.md](AGENTS.md).

Подготовка: `./scripts/dev.sh setup`. Проверки: `./scripts/dev.sh check`. Нужны uv, Bash и Python; команды и состав проверок — в [scripts](scripts/README.md).

Локальный запуск полного стека и проверка перед push или PR описаны в [scripts](scripts/README.md). Конфигурация production находится в [deploy](deploy/README.md).
