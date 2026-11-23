# Задания ученика по референсу

Статус: готово к ревью. Исполнитель: текущий агент; ревьюер: владелец/второй участник.

Источник: Tutor_Student_Tasks_Agent_Package.zip. Правила: STUDENT-TASKS-UI-1/2 и прежние TASKS-8/9, STUDENT-4 в ADR web.

Границы: HomeworkPage/StudentAssignments, локальные компоненты и стили student-tasks, проекция выдач с тестами, локальные тексты student в tasks.ru.ts, оптимизированный ассет. Не меняются библиотека, права, плеер, печать, backend, маршруты, глобальные токены, шапка/сайдбар и другие разделы. Общие файлы: docs/adr/web.md, docs/stages.md, tasks/tasks.ru.ts (только student).

Ветка: style/student-tasks-reference, .worktrees/student-tasks-reference. Текущий демо-интерфейс отсутствует в dev: рабочая ветка от HEAD со снимком текущих незакоммиченных файлов, перенос только явного списка после проверки SHA-256. Чужие изменения сохраняются.

Приёмка: сверка с PNG desktop/tablet/mobile; три динамические метрики, ведущие карточки и очередь; реальные статусы без выдуманных черновиков/рекомендаций; решение и печать; попытки, сроки, возврат/комментарии, пустой/завершённый список; клавиатура и отсутствие горизонтального скролла; снимки соседних страниц до/после; lint/typecheck/test/build и общий check с честной фиксацией результата.

## Результат

Новая композиция по PNG: заголовок, компактная сводка, две карточки, полная очередь. Прозрачный чек-лист вынесен в адаптивный ассет, на планшете/телефоне скрыт. Существующие выдачи не заменялись данными изображения: в текущем демо активных 2, не начато 2, ближайший срок 21.11; работа со сроком 21.11 идёт перед тестом со сроком 22.11. Обе работы пока не начаты, фиктивный «В процессе» не добавлен. Очередь повторяет ведущие позиции для единого обзора всех статусов, без дублирования печати и информации о попытках. Нижняя рекомендация скрыта: соответствующей готовой логики нет.

Страница использует прежние library/canStart/attemptScore/TaskPlayer/PrintDialog и существующий день демо из getSchedule. Синхронное хранилище не имеет сетевых состояний загрузки/ошибки; новые запросы и искусственные загрузчики не добавлены. SessionGate, рабочий LearnerApp и API сохранены; это редизайн текущего демо-экрана. Поля ответов, ограничения попыток, таймеры, оценивание и раскрытие ответов плеера не менялись. Без задач внутри работы запуск/печать недоступны с пояснением. После закрытия печати фокус возвращается на кнопку страницы ученика; общий PrintDialog не менялся.

## Проверки

- TDD: шесть тестов проекции, пять сначала падали на пустой реализации. Покрыты собственные выдачи/существующие работы, порядок/лимит двух карточек без мутации, просрочка до/в день срока, возврат с попыткой, ограничения повтора, пустые источники.
- Frontend: lint, typecheck, 321 тест в 53 файлах, demo и production build. Прежнее предупреждение о JS-чанке >500 kB сохраняется.
- Chrome: три реальные метрики, отсутствие выдуманного статуса, запуск теста клавиатурой, проверка ответов, результат и обновление метрик, повтор из очереди, Escape; отправка домашней работы с предупреждением о незаполненных ответах, статус «На проверке» и недоступный повтор. Ошибок JS/ресурсов нет.
- Печать: существующий диалог, только «Для ученика» и «Бланк ответов», отмена с возвратом фокуса; реальное создание PrintJob/листа из пяти задач без ключей и вызов window.print. В автоматизации сам системный диалог заменён счётчиком; afterprint удаляет лист. Сохранение PDF через системное окно вручную не проверялось.
- 20 ширин 1920/1672/1600/1440/1399/1280/1279/1100/1024/1023/821/820/768/767/600/430/390/380/360/320: страница, печать и плеер без горизонтального скролла; >=1280 две колонки, <768 одна. Визуально сверены desktop/laptop/tablet/mobile/320, названия/действия переносятся, иллюстрация не закрывает управление.
- Дополнительно 15 браузерных проверок на изолированном временном стенде: пустой список, всё сдано с результатами/комментариями и без новой попытки, возврат с просрочкой и повтором, работа без задач, ожидание проверки без результата; 1280/390/320 px. Данные менялись только в отдельной браузерной фикстуре. Временные исходники стенда удалены, в приложение не входят. Safari/WebKit не проверялся.
- 16 пар снимков до/после на 1600/390 совпали побайтно: лендинг, главная/тренажёр/материалы/прогресс/экзамен ученика, главная и задания учителя. Исходники шапки/сайдбара/плеера/библиотеки/печати и остальных страниц сверены с начальным SHA-256 при переносе.
- `./scripts/dev.sh check` не завершён: прежние ссылки в docs/tasks/landing-ux.md и docs/adr/web.md ведут на удалённый UX-REVIEW.md. Чужое удаление сохранено.

## Файлы и передача

`pages/HomeworkPage.tsx`, `pages/tasks/StudentAssignments.tsx`, только student в `tasks/tasks.ru.ts`; новые `model/studentAssignments.ts`/`.test.ts`, `pages/student-tasks/AssignmentCard.tsx`, `AssignmentParts.tsx`, `AssignmentQueue.tsx`, `student-tasks.module.css`; два WebP, ADR web, stages, эта задача и пять снимков. Результат перенесён в исходный каталог по явному списку с проверкой SHA-256. Commit/push/deploy не выполнялись. Передано владельцу на визуальное ревью.

Снимки: [desktop](../ui/student-tasks-reference-desktop.png), [ноутбук](../ui/student-tasks-reference-laptop.png), [планшет](../ui/student-tasks-reference-tablet.png), [mobile](../ui/student-tasks-reference-mobile.png), [320 px](../ui/student-tasks-reference-compact.png).

## Ассет

Встроенный image_gen, прозрачный PNG с сохранением альфа-канала; уменьшение/конвертация Pillow без перерисовки. `frontend/public/student-tasks/checklist.webp` (1000×667, 54 456 байт), `checklist-600.webp` (600×400, 27 862 байта). Пустой alt, адаптивный srcset, PNG интерфейса не используется как подложка.

Точный промпт:

> Create one static premium education dashboard decorative illustration, real transparent background with alpha. A small white checklist clipboard with thick rounded lilac purple rim and violet top clip, standing upright with a slight perspective tilt. On its paper are exactly two lime round check badges with dark navy tick marks, and simple raised lavender horizontal strokes indicating text, no actual letters. Two short closed books are stacked on its left at the bottom: lime book above periwinkle purple book, white page blocks. Three small lime emphasis strokes to the upper left. Smooth matte clay 3D materials, soft studio lighting and very subtle grounding shadow. Friendly polished restrained education SaaS style, pastel lavender and white, lime accent. Wide landscape arrangement, full clipboard and books contained in the image with transparent margins. No words, numbers, logos, actual UI, picture frame, background shapes, extra objects, or watermark. Asset only, no website screenshot.
