# TutorFlow

Каркас для совместной разработки двумя людьми с агентами. Приложение и стек пока не реализованы.

- `backend/` — API и бизнес-логика.
- `frontend/` — интерфейс.
- `docs/` — требования, решения, задачи и workflow.
- `deploy/` — окружения и развёртывание.
- `scripts/` — общие команды.
- `.agents/skills/` — скиллы агентов, адаптированные из `forum-nstu-beta`.

Начать: [workflow](docs/workflow.md). Текущее состояние: [stages](docs/stages.md). Правила агента: [AGENTS.md](AGENTS.md).

Проверка каркаса: `./scripts/dev.sh check` (Python 3 и Bash). Проверки приложения подключаются при выборе стека.
