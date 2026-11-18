---
name: docs-update
description: "Use when changing behavior, making a decision, closing a stage or adding a rule or procedure. Says which document gets which information."
---

# docs-update

Пути к файлам указаны от корня репозитория.

Когда: изменено поведение, принято решение, закрыта задача или добавлена процедура.

- Идея и границы продукта → `docs/spec.md`, по поручению владельца.
- Правило, причина и открытый вопрос → ADR модуля в `docs/adr/`. Сохраняй постоянный ID и статус реализации.
- Статус → `docs/stages.md`; критерии запуска → `docs/pre-release.md`.
- Договор backend/frontend → `docs/api/`.
- Исполнитель, границы, критерии и передача → задача в Issue или `docs/tasks/`.
- Процесс работы вдвоём → `docs/workflow.md`; правила агента → локальный AGENTS.md.
- Техническое правило → `docs/rules/`; процедура скилла целиком → `.agents/skills/<имя>/SKILL.md`.
- Команда запуска → README соответствующей папки и справка команды.

Порядок: правило, причина, тест, код, статус. Один факт — одно место; в остальных ссылка.
