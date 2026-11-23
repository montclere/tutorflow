# Публичный лендинг с фенеком

Исполнитель: текущий агент. Ревьюер: владелец проекта. Статус: готово к ревью.

Ветка: `style/landing-fennec`, отдельный worktree. Основа — снимок текущего лендинга из `feat/main-reference`: актуальный frontend ещё не интегрирован в `dev`, поэтому переход на `origin/dev` потерял бы существующий интерфейс. Чужие незавершённые правки сохранены.

Источник: `TutorFlow_Fennec_Landing_Complete_Package.zip`, инструкции и `TutorFlow_Fennec_Landing_Reference.png`. Правила: LANDING-12, LANDING-11, LANDING-4…6, LANDING-9. Область: оформление публичного лендинга, фенек, заголовок, иллюстрации возможностей, компактная ИИ-полоса и тарифы. Общие файлы: `docs/adr/web.md`, `docs/stages.md`, только блок `[data-landing-theme]` в `frontend/src/styles/tokens.css`. Кабинет, auth, API, маршруты, аналитика, SEO и юридические страницы вне задачи.

Критерии готовности:

- Композиция сверена с референсом на 1199 px, адаптация — на планшете и телефоне без обрезанного текста и горизонтальной прокрутки.
- Самостоятельный прозрачный WebP фенека; карточки используют отдельные SVG, а не фрагменты скриншота.
- Действия возможностей, тарифов, регистрации, входа и демо сохранены; клавиатурная навигация и reduced motion проверены.
- Цены и пробный период остаются из `siteConfig`; файлы кабинета и общих компонентов совпадают с исходным снимком.
- Выполнены проверки frontend и общая команда; реальные результаты и ограничения записаны перед передачей.

## Проверки и передача

- Обновлены заголовок, маскот, палитра, пропорции первого экрана и трёх карточек, компактная ИИ-полоса и тарифы. Сохранены обработчики, маршруты, аналитика, SEO и юридические ссылки. Цена 690 ₽ и 14 дней совпадают с референсом и по-прежнему берутся из `siteConfig`.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` — успешно; 292 теста в 46 файлах. Сохраняется исходное предупреждение сборки о JS-чанке больше 500 kB.
- Playwright / локальный Google Chrome, production-сборка: 1440, 1199, 1024, 768, 767, 700, 430, 390, 375, 320 px. Проверены границы заголовка, кнопок, шапки и тарифов, отсутствие горизонтальной прокрутки. На 320–375 px основные CTA идут друг под другом.
- Проверены четыре диалога возможностей, оба тарифа, фокус внутри диалога и возврат после Escape, форма регистрации, кнопка входа и `/#login`, честный fallback демо в production, FAQ, мобильное меню и диалоги, reduced motion. Ошибок JavaScript и загрузки ресурсов нет. Серверные формы не отправлялись; API не менялся. Safari/WebKit не проверялся.
- Сравнение SHA-256 подтвердило неизменность 337 файлов кабинета, авторизации, маршрутов, общего UI и конфигурации. Все токены вне `[data-landing-theme]` совпадают с исходным снимком. Новых зависимостей нет.
- `./scripts/dev.sh check` останавливается на существующих ссылках в `docs/tasks/landing-ux.md` и `docs/adr/web.md` на удалённый `UX-REVIEW.md`. Общая интеграционная проверка не выполнена; чужое удаление сохранено.
- Снимки: [desktop](../ui/landing-fennec-desktop.png), [полная страница](../ui/landing-fennec-desktop-full.png), [mobile](../ui/landing-fennec-mobile.png), [mobile целиком](../ui/landing-fennec-mobile-full.png), [диалог](../ui/landing-fennec-dialog.png).

Результат перенесён в основной рабочий каталог после сверки исходных хешей. Требуются визуальное ревью владельца и общая проверка после решения исходной проблемы документации. Commit/push/deploy не выполнялись.

## Графика

Встроенный `image_gen` создал самостоятельный прозрачный PNG по визуальному референсу из архива; затем `cwebp` подготовил `frontend/public/landing/assets/fennec/hero.webp` (1200 × 910, около 132 КБ) и `hero-600.webp` (600 × 455, около 43 КБ). Используется `srcset`, главный маскот загружается с высоким приоритетом. Фон рисуется CSS отдельно. Исходный PNG сохранён в стандартном каталоге генератора; приложение использует только файлы внутри проекта. Иллюстрации карточек — SVG из архива с дополненными градиентами, тенями, объёмом часов, карандаша и стопкой монет. Это векторные приближения объёмных деталей, а не оригинальные 3D-рендеры из макета; фрагменты скриншотов не подменяют интерфейс.

Итоговый запрос встроенному генератору:

```text
Use case: stylized-concept. Asset type: transparent hero illustration for TutorFlow public landing page. Input image: the supplied Fennec_Hero_Detail_Reference.png is a visual reference, not an edit target. Recreate this composition as a standalone transparent high-quality 3D-rendered mascot cutout, without its backdrop. A cute cream/sand fennec FOX with extraordinarily large upright triangular ears with pink interiors, closed smiling eyes with dark soft eyelids, tiny muzzle, small dark nose, fluffy cream tail curling up on the right, wearing bright lime-green over-ear headphones. One paw rests on cheek, seated behind an open lavender laptop bearing a small white rounded TF sticker. At the right a stack of two books, lime below periwinkle, and a simple white pencil cup with dark and lime pens. Same friendly premium fluffy fur and softly rounded product-render styling as reference. Three-quarter front view, laptop lower left, books lower right, whole character and ears fully inside frame. Soft studio lighting, very subtle contact shadow only; transparent background, no colored plane, no blob, no decorative rays, no surrounding UI, no watermark. Preserve exact subject identity as fennec, avoid cat or raccoon appearance.
```
