# Тренажёр ученика по референсу

Статус: готово к ревью. Исполнитель: текущий агент; ревьюер: владелец/второй участник.

Источник: Tutor_Student_Trainer_Agent_Package.zip. Правила: STUDENT-5, STUDENT-TRAINER-UI-1/2 в ADR web.

Границы: только TrainerPage, локальные компоненты/стили, тексты trainer, модель рекомендаций и прозрачный ассет. Шапка, меню, backend, маршруты, соседние страницы и данные сохранены.

Рабочая ветка: style/student-trainer-reference, .worktrees/student-trainer-reference. dev не содержит текущую демо-версию: отдельная ветка от текущего HEAD с копией незакоммиченных изменений, перенос только явного списка файлов с проверкой исходных SHA-256. Чужие изменения сохраняются.

Общие файлы: docs/adr/web.md, docs/stages.md, pages/learn/learn.ru.ts (только trainer). До кода зафиксированы границы и правила.

Приёмка: визуальная сверка desktop/tablet/mobile; без горизонтального скролла; старт/проверка/пропуск/10 задач/выход; все режимы, недоступные номера, пустые ошибки, рекомендации и все тренировки; обновление метрик; клавиатура; снимки соседних страниц и оболочки без изменений. Frontend lint/typecheck/test/build и общий check с честной фиксацией результата.

## Результат и проверка

Старый пустой экран заменён hero, метриками, режимами и тремя рекомендациями (сейчас №15/16/7 по текущим данным). У каждого номера остаются прежние задачи и автопроверка. «Все тренировки» раскрывает полный выбор и переводит фокус в него; карточка запускает выбранный номер. Недоступный номер и пустые ошибки блокируют старт с пояснением. Расчёты practice/progress, начальное значение недельного счётчика и API не менялись. Тренажёр остаётся демо-экраном; новые серверные операции не добавлены. «Вариант целиком» открывает прежний ExamPage, его существующие ограничения сохранены. Текущие данные синхронны: искусственные загрузчики и новые сетевые ошибки не добавлены.

- TDD: четыре теста модели; три сначала падали на пустой реализации, затем все зелёные. Проверены сортировка по доле, граница трёх, фильтрация недоступных/ненумерованных тем, отсутствие мутации, пустые данные и темы без ответов.
- Frontend: lint, typecheck, 315 тестов в 52 файлах, demo и production build успешны. Прежнее предупреждение о чанке >500 kB сохраняется.
- Chrome/Playwright: пустые ошибки; неверный ответ и блокировка повторного ввода; повтор ошибки и исчезновение после правильного ответа; обновление счётчика; 10 пропусков, итог 0/10, повтор и выход; рекомендация №16 с клавиатуры и правильный ответ с множественным выбором; параметры URL, недоступный №27, фокус после «Все тренировки», переход на экзамен. JS/ресурсных ошибок нет.
- 1920/1672/1600/1440/1399/1280/1279/1100/1024/821/820/768/600/430/390/380/360/320 px: стартовый экран, номера и активная тренировка без горизонтального скролла. Визуально проверены desktop/laptop/tablet/mobile/320, весь ассет виден, текст и кнопки не пересекаются.
- 14 пар снимков соседних страниц на 1600/390: лендинг, главная/задания/материалы/прогресс/экзамен ученика, главная учителя. Финальное сравнение побайтно совпало; при настройке снимков учтена полная загрузка lazy-изображений и проверено различие сглаживания Chrome (28 пикселей с дельтой >2 на 1,64 млн, максимум 21) без изменений геометрии. Шапка, сайдбар и их исходники сохранены.
- `./scripts/dev.sh check` не завершён: ссылки в docs/tasks/landing-ux.md и docs/adr/web.md ведут на ранее удалённый UX-REVIEW.md. Исходное удаление сохранено.

Изменены: `pages/TrainerPage.tsx`, `pages/learn/learn.ru.ts` (только trainer), новые `pages/trainer/trainer.module.css`, `model/trainer.ts` и `trainer.test.ts`; два WebP, ADR web, stages, эта задача и пять снимков. Перед переносом проверяются исходные SHA-256; исходники остальных экранов не меняются. Commit/push/deploy не выполнялись.

Снимки: [desktop](../ui/student-trainer-reference-desktop.png), [ноутбук](../ui/student-trainer-reference-laptop.png), [планшет](../ui/student-trainer-reference-tablet.png), [mobile](../ui/student-trainer-reference-mobile.png), [320 px](../ui/student-trainer-reference-compact.png).

## Иллюстрация

Встроенный image_gen, прозрачный PNG с сохранённой альфой; конвертация и уменьшение Pillow без перерисовки. Файлы: `frontend/public/student-trainer/target.webp` (1200×675, 81 132 байта) и `target-600.webp` (600×338, 31 602 байта). Изображение декоративное, пустой alt; адаптивный srcset. PNG-референс интерфейса не использован как подложка.

Точный промпт генерации:

> Create a single polished 3D clay illustration for a Russian student practice dashboard, transparent background. A thick round lavender and white archery target, tilted slightly in perspective facing camera, resting next to and partly in front of exactly two stacked rounded books (bottom violet, top pale periwinkle blue, white page blocks). A single arrow with a pale shaft and warm yellow fletching penetrates the center of the target from the upper right. Small lime yellow bookmark on one book, three small lime decorative emphasis strokes beside the target. Soft diffuse studio lighting, smooth matte rounded materials, soft subtle grounding shadow, clean premium playful education visual. Wide landscape composition, entire books, arrow and target visible within generous transparent margins. Target right, books left, compact cohesive cluster. No writing, letters, digits, logos, UI, background or frame. Output with real transparent alpha. Palette lavender, lilac, pale blue, white, warm yellow, small lime accent. This is a decorative web hero asset only, no interface screenshot.
