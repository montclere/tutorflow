# Frontend

- Бери сценарии из `docs/use-cases.md`, правила из `docs/business-rules.md`, HTTP-контракт из OpenAPI backend.
- Держи сетевые вызовы в одном месте по мере появления страниц. Показывай подтверждённый результат и обрабатывай загрузку, пустое состояние и отказ сервера.
- Проверяй клавиатуру и узкий экран. Компонентные тесты размещай рядом с кодом, сквозные сценарии — в `tests/e2e/`.
- Из корня запускай `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck` и `npm --prefix frontend run test:run`.
