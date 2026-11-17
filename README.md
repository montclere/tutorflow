# TutorFlow

Каркас для совместной разработки двумя людьми с агентами. Есть страница регистрации преподавателя (frontend); backend пока не реализован.

- `backend/` — API и бизнес-логика.
- `frontend/` — интерфейс.
- `docs/` — требования, решения, задачи и workflow.
- `deploy/` — окружения и развёртывание.
- `scripts/` — общие команды.
- `.agents/skills/` — скиллы агентов, адаптированные из `forum-nstu-beta`.

Начать: [workflow](docs/workflow.md). Текущее состояние: [stages](docs/stages.md). Правила агента: [AGENTS.md](AGENTS.md).

Проверки: `./scripts/dev.sh check` (Python 3, Bash, Node.js 22.13+ или 24+).
