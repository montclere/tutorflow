# shared

Общее ядро, независимое от конкретных модулей.

- `domain/` — общие ошибки и типы значений.
- `application/ports/` — порты общих зависимостей.
- `application/contracts/` — договоры между модулями; сборка реализаций в `app/composition.py`.
- `infrastructure/` — общие адаптеры БД и журналирования.
- `presentation/api/` — общие HTTP-ошибки и определение пользователя.
- Shared не импортирует modules. Потребители и реализация портов описаны в [ADR Students](../../../docs/adr/students.md).
