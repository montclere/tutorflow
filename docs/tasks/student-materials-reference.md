# Материалы ученика по референсу

Статус: готово к ревью. Исполнитель: текущий агент; ревьюер: владелец/второй участник.

Источник: Tutor_Student_Materials_Section_Agent_Package.zip; правила STUDENT-MATERIALS-UI-1/2 и STUDENT-3 в ADR web.

Границы: MaterialsPage, локальные student-materials компоненты/стили, проекция с тестами, только materials в learn.ru.ts, отдельный WebP. Не меняются MaterialIcon других страниц, хранилище, модели загрузки, backend, маршруты, шапка/меню/фон и соседние экраны. Общие файлы: docs/adr/web.md, docs/stages.md, pages/learn/learn.ru.ts.

Рабочая ветка style/student-materials-reference, .worktrees/student-materials-reference. Текущий демо-интерфейс отсутствует в dev: отдельная ветка от HEAD со снимком текущих незакоммиченных файлов. Перенос явного списка с проверкой SHA-256, чужие изменения сохраняются.

Приёмка: сверка с PNG desktop/tablet/mobile, широкая PDF и две компактные карточки, заголовок без подзаголовка, фильтры и поиск; все существующие типы; настоящие статусы/даты, рабочие URL/скачивание/отметка открытия, отсутствие файла без фиктивного действия; пустые данные/поиск; клавиатура, без горизонтального скролла; соседние страницы до/после; frontend lint/typecheck/test/build и общий check с честным результатом.

## Результат

Заголовок без подзаголовка, короткий лаймовый штрих, отдельные книги с карточкой, pill-фильтры и поиск, общий счётчик новых. Первая PDF показана широкой карточкой перед остальными; остальные материалы сохраняют порядок источника. Корпус иконок SVG из прежнего MaterialIcon, локальные размеры не влияют на другие страницы. Метаданные/комментарии, новизна и дата открытия получаются из текущего getStudentDetails. Нет выдуманных файлов, дат и статусов: в исходном демо PDF открыт 15.11, картинка 07.11, ссылка новая, счётчик 1. Два файла имеют только метаданные без URL — кнопки недоступны с пояснением; демонстрационное видео хранит прежнюю ссылку на главную YouTube, поэтому действие названо «Открыть», без обещания конкретного видео.

Открытие имеющегося URL идёт в новую вкладку; файлы дополнительно имеют компактное скачивание с именем. Обе операции вызывают прежний markMaterialOpened. День берётся из getSchedule().today (17.11.2026 в демо), не из системного UTC. Фильтр/поиск не меняют отметок. Синхронный store не имеет сетевых загрузок/ошибок — искусственные состояния не добавлены; SessionGate и API сохранены. По-прежнему демо-экран, не новый серверный кабинет.

## Проверки

- TDD: пять тестов проекции, четыре сначала падали на пустой реализации. Покрыты первая PDF, порядок без мутации, общий unread при фильтрации, совместный поиск/тип, комментарий/имя файла, регистр/пробелы/ё, дополнительные типы и пустые данные/нет совпадений.
- Frontend: lint, typecheck, 326 тестов в 54 файлах, demo и production build успешны; прежнее предупреждение о чанке >500 kB сохраняется.
- Chrome/Playwright: базовые фильтры; поиск и совмещение с типом; сброс/очистка с фокусом; отсутствие отметки просмотра при поиске; реальные исходные даты и недоступность файлов без URL. Ссылка открывается клавиатурой в новой вкладке по прежнему адресу, unread 1→0, openedAt обновляется и сохраняется после SPA-переходов. Внешний ответ YouTube заменён локальным HTML в автоматизации; доступность конкретного видео не проверялась и не обещается.
- 20 ширин 1920/1672/1600/1440/1399/1280/1279/1100/1024/1023/821/820/768/767/600/430/390/380/360/320: без горизонтального скролла и обрезанных действий, включая пустую поисковую выдачу. Визуальная сверка desktop/laptop/tablet/mobile/320.
- Отдельный временный стенд использует реальный addMaterials с тестовыми Blob-URL: PDF скачан с именем study.pdf и проверенным PDF-заголовком; PNG открыт в новой вкладке; документ скачан как notes.txt. Обновление unread и дат открытия подтверждено; doc/slides/other остаются доступны через фильтры; отсутствие адреса ссылки объяснено. 16 состояний empty/ready на 1672/1280/1024/821/820/768/390/320, длинные названия/комментарии переносятся. Исходники стенда удалены, фикстуры не входят в приложение и не заменяют материалы пользователя. Ошибок JS/ресурсов нет. Safari/WebKit не проверялся.
- 16 пар снимков соседних страниц до/после на 1600/390 совпали побайтно: лендинг, главная/задания/тренажёр/прогресс/экзамен ученика, главная и задания учителя. Фон, шапка, сайдбар и их исходники сохранены.
- `./scripts/dev.sh check` не завершён: прежние ссылки в docs/tasks/landing-ux.md и docs/adr/web.md на удалённый UX-REVIEW.md. Чужое удаление сохранено.

## Файлы и передача

`pages/learn/MaterialsPage.tsx`, только materials в `pages/learn/learn.ru.ts`; новые `pages/student-materials/StudentMaterialCard.tsx` и `student-materials.module.css`, `model/studentMaterials.ts` и `.test.ts`; два WebP, ADR web, stages, эта задача, пять снимков. Перед переносом сверяются исходные SHA-256, меняется только явный список. Commit/push/deploy не выполнялись. Передано владельцу на визуальное ревью.

Снимки: [desktop](../ui/student-materials-reference-desktop.png), [ноутбук](../ui/student-materials-reference-laptop.png), [планшет](../ui/student-materials-reference-tablet.png), [mobile](../ui/student-materials-reference-mobile.png), [320 px](../ui/student-materials-reference-compact.png).

## Ассет

Встроенный image_gen; прозрачный PNG, альфа сохранена при уменьшении/конвертации Pillow без перерисовки. `frontend/public/student-materials/books.webp` (1000×667, 55 978 байт) и `books-600.webp` (600×400, 28 022 байта). Пустой alt, адаптивный srcset. Изображение из архива не используется как подложка.

Точный промпт:

> Create one compact premium education SaaS decorative asset on a truly transparent background. Exactly two small stacked closed books: bottom lime green book with white pages and a small lavender ribbon bookmark, top thick soft lavender book. A single small rounded white note card is leaning diagonally against their right side, with four subtle raised pale lavender horizontal strokes (no letters) and a small lime green paperclip attached at the top. Soft matte clay 3D render, rounded edges, diffuse studio lighting, subtle grounding shadow, no glow. Pastel lilac, lime green and off-white palette. Wide landscape composition with entire books, bookmark and paperclip in frame and transparent margins. Friendly restrained calm premium style, no faces, mascots, extra objects, text, numbers, logo, UI, backdrop, gradients, background shapes, frame or watermark. Asset only, not a screenshot of a page.
