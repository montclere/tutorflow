# TutorFlow

- Рабочее пространство для независимых преподавателей, учеников и приглашённых взрослых. [О продукте](docs/product.md)
- Сценарии работы преподавателя, ученика и взрослого. [Сценарии](docs/use-cases.md)
- Правила поведения приложения. [Бизнес-правила](docs/business-rules.md)
- Текущее состояние и ближайшие задачи. [Этапы](docs/stages.md)

## Локальный запуск

Нужны Python из [backend/.python-version](backend/.python-version), Node.js 24, uv и Docker Compose.

- Установка зависимостей и Chromium — `./scripts/dev.sh setup`.
- API — `uv run --directory backend --locked uvicorn app.main:app --reload`.
- Фронтенд — `npm --prefix frontend run dev`.
- Полная проверка — `./scripts/dev.sh check`. Быстрая проверка перед PR — `python3 scripts/check.py pr`.
