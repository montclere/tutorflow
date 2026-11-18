# Занятия и расписание — API

Пути указаны относительно `/api/v1`. Права, состояния и семантика серий определены в [ADR занятий](../adr/lessons.md). Действуют общие [правила JSON, сессии, CSRF и ошибок](README.md). Занятия доступны в кабинетах преподавателя, ученика и родителя согласно правам на карточку.

## Чтение календаря

| Метод и путь | Вход | Успех |
| --- | --- | --- |
| GET /teacher/lessons | `from, to, view?, student_card_id?, limit?, cursor?` | 200 страница `TeacherLesson` |
| GET /teacher/lessons/{lesson_id} | — | 200 `TeacherLesson` |
| GET /teacher/lessons/{lesson_id}/history | `limit?, cursor?` | 200 страница `LessonChange` |
| GET /student/lessons | `from, to, view?, student_card_id?, limit?, cursor?` | 200 страница `CabinetLesson` по привязкам ученика |
| GET /student/lessons/{lesson_id} | — | 200 `CabinetLesson` |
| GET /parent/lessons | `from, to, view?, student_card_id?, limit?, cursor?` | 200 страница `CabinetLesson` по действующим родительским разрешениям |
| GET /parent/lessons/{lesson_id} | — | 200 `CabinetLesson` |
| GET /{cabinet}/lessons/{lesson_id}/activity | `limit?, cursor?` | 200 страница `LessonActivity` по LES-56 |

Окно календаря передаётся как два UTC-момента с `from < to`, максимум — 62 суток. Параметр `view` принимает `calendar` (по умолчанию) или `history` по LES-37. Выборка по пересечению с `[from, to)`, порядок `starts_at ASC, lesson_id ASC`. Курсор привязан к актору, маршруту кабинета, представлению, окну и фильтру. Права проверяются заново на каждой странице. При запросе по явно указанной недоступной карточке сервер отвечает 404. Без фильтра страница содержит только доступные записи, включая пустой список. Изменяемое расписание не имеет снимка между страницами. После изменения фронтенд заново загружает открытое окно. История правок отсортирована по времени и ID события от новых к старым. Курсор этой истории привязан к актору и ID занятия.

- `CabinetLesson` содержит `lesson_id, student_card_id, starts_at, ends_at, duration_minutes, status, title, description, preparation, outcome_reason, version`. `outcome_reason` содержит причину текущей отмены или пропуска, если она указана. В прочих состояниях значение равно `null`. Текстовая метка «Нужна отметка» используется только в учительском календаре. Учебные кабинеты показывают «Отметки пока нет» после окончания запланированного занятия.
- `TeacherLesson` дополнительно содержит `private_note, series_id, series_position, is_series_exception, uses_series_content, updated_at`. Для разового занятия `series_id` и `series_position` равны `null`, а `is_series_exception` и `uses_series_content` равны `false`. `uses_series_content` показывает зависимость содержания от шаблона, независимо от ручного переноса.
- `LessonChange` содержит `version, event, occurred_at, actor_account_id, before, after`. Снимки событий времени или статуса содержат только интервал и статус. Изменения текста описываются списком имён полей `changed_fields`. Решения по запросам фиксируются типом события. В событиях отмены и отметки пропуска необязательный `reason` содержит причину, действовавшую после этой правки. У события создания разового урока `before` равен `null`, версия равна 1. Подготовка записи урока серии техническим процессом событие не создаёт.
- `LessonActivity` содержит `event, occurred_at, actor_role` и разрешённые данные события: изменённые общие поля, интервалы либо ссылку на запрос или предупреждение. Записи идут от новых к старым. `{cabinet}` — один из трёх кабинетов. Закрытые поля и их правки отсутствуют в семейной выдаче.
- `status` имеет значения `scheduled, completed, no_show, cancelled` из ADR. Время окончания вычисляет сервер. Действие записи проведённого урока принимает фактический интервал по LES-43. Имена для подписей доступны из действующих маршрутов [карточек](students.md), личный часовой пояс из [профиля](identity.md).

Списки и детали возвращают те же поля для рассчитанной даты серии и созданного урока. `lesson_id` и версия доступны до создания записи и сохраняются при её подготовке процессом обслуживания. Текущий ETag на детали преподавателя действует и для рассчитанной даты. Деталь и история уже удалённой позиции возвращают 404. История доступной рассчитанной даты до первого действия возвращает пустую страницу. Разные кабинеты получают один и тот же ID через действующий доступ к карточке.

## Команды для одного занятия

| Метод и путь | JSON | Успех |
| --- | --- | --- |
| POST /teacher/lessons | `{student_card_id, starts_at, duration_minutes, title, description?, preparation?, private_note?, client_request_id}` | 201 `TeacherLesson` и `Location` на занятие. 200 при допустимом повторе |
| POST /teacher/lessons/record-completed | Поля создания одного занятия. Передаётся фактическое время | 201 `TeacherLesson` в состоянии `completed` и `Location`. 200 при допустимом повторе |
| PATCH /teacher/lessons/{lesson_id} | `{title?, description?, preparation?, private_note?, expected_version}` | 200 `TeacherLesson` |
| DELETE /teacher/lessons/{lesson_id} | заголовок `If-Match` с актуальным ETag | 204 после удаления |
| POST /teacher/lessons/{lesson_id}/cancel | `{expected_version, reason?}` | 200 `TeacherLesson` |
| POST /teacher/lessons/{lesson_id}/attendance | `{status, expected_version, reason?}` | 200 `TeacherLesson` со статусом `completed` или `no_show`. `reason` допускается только для `no_show` |
| POST /teacher/lessons/{lesson_id}/restore | `{expected_version}` | 200 `TeacherLesson` с прежним интервалом по LES-41 |
| POST /teacher/lessons/{lesson_id}/attendance/reset | `{expected_version}` | 200 `TeacherLesson` в состоянии `scheduled` по LES-42 |

`student_card_id` берётся из списка карточек преподавателя. Для разового занятия и серии сервер проверяет, что у активной карточки есть действующий подключённый профиль ученика. Чужая или отсутствующая карточка даёт 404. Своя активная карточка без подключённого профиля даёт 409 `lesson_student_not_linked`. `client_request_id` — UUID одной попытки создания по LES-17. Неизвестные поля, в том числе владелец и роль, запрещены. Время вводится в интерфейсе в зоне профиля и передаётся как RFC 3339 UTC с точностью до минуты, например `2026-11-23T10:00:00Z`. Карточка занятия неизменяема. PATCH меняет только содержание по LES-48 и требует хотя бы одно поле. Значение `null` очищает необязательный текст. Детальный ответ преподавателя выдаёт сильный ETag версии для удаления. Без заголовка применяется 428 `precondition_required`, при несовпадении версии 412 `precondition_failed`. Повтор запроса после удаления возвращает 404. Удаление одной даты серии не затрагивает остальные. Для даты без записи сервер исключает позицию из плана без создания урока. Другие изменяющие команды могут создать урок по LES-50. Серийная запись использует эти же команды для области «Только это занятие».

## Запросы переноса

Здесь `{cabinet}` — один из трёх существующих кабинетов. Право решить запрос определяется по стороне, получившей предложение, согласно LES-34.

| Метод и путь | Вход | Успех |
| --- | --- | --- |
| POST /{cabinet}/lessons/{lesson_id}/reschedule-requests | `{proposed_starts_at, duration_minutes?, reason?, expected_version}` | 201 `RescheduleRequest` с `Location` на запрос. 200 при допустимом повторе |
| GET /{cabinet}/lessons/{lesson_id}/reschedule-requests | `limit?, cursor?` | 200 страница запросов, затрагивающих занятие |
| GET /{cabinet}/reschedule-requests/{request_id} | — | 200 `RescheduleRequest` |
| POST /{cabinet}/reschedule-requests/{request_id}/withdraw | `{expected_version}` запроса | 200 `RescheduleRequest` |
| POST /{cabinet}/reschedule-requests/{request_id}/resolve | `{decision, expected_version}` запроса | 200 `RescheduleRequest` с итогом решения |

`duration_minutes` может указать преподаватель. Семейный запрос наследует длительность урока. `RescheduleRequest` содержит `request_id, scope, requester_role, occurrences, reason, status, created_at, version`. `scope` — `one` или `following`. Каждый элемент `occurrences` содержит `lesson_id, starts_at, ends_at, proposed_starts_at, proposed_ends_at` с исходным и предложенным интервалом. Для запроса одного занятия в списке один элемент. Разные кабинеты читают одну запись по тому же `request_id`. Списки и получение запроса применяют доступ к его карточке. Состояния — `pending`, `accepted`, `declined`, `withdrawn`, `expired`, `superseded`. `expired` отображается как «Без ответа» и не меняет расписание. Решение — `accept` или `decline`. Участники видят `reason` в исходном предложении и после решения. Команда решения принимает только выбор и версию.

Для ещё открытого предложения с теми же нормализованными параметрами и автором повтор возвращает 200. Другое предложение, которое затрагивает любой урок из открытого запроса, даёт 409 `lesson_reschedule_pending`. Отзывает только автор. Списки сортируются по `created_at DESC, request_id DESC`. После решения клиент обновляет расписание.

## Команды для серии

| Метод и путь | JSON | Успех |
| --- | --- | --- |
| POST /teacher/lesson-series/preview | `{student_card_id, first_local_start, timezone, count, duration_minutes, ambiguous_time?}` | 200 `SeriesPlan` без записи |
| POST /teacher/lesson-series | Поля предпросмотра, `title, description?, preparation?, private_note?, client_request_id` | 201 `TeacherSeries` и `Location` на серию. 200 при допустимом повторе |
| GET /teacher/lesson-series/{series_id} | — | 200 `TeacherSeries` |
| POST /teacher/lesson-series/{series_id}/reschedule/preview | `{from_lesson_id, first_local_start, duration_minutes, ambiguous_time?, expected_version}` | 200 `SeriesPlan` без записи |
| POST /teacher/lesson-series/{series_id}/reschedule-requests | Поля плана и `reason?`. Создаётся предложение по позициям | 201 `RescheduleRequest` и `Location` на запрос. 200 при допустимом повторе |
| PATCH /teacher/lesson-series/{series_id}/content | `{title?, description?, preparation?, private_note?, expected_version}` серии | 200 `TeacherSeries` с обновлённым шаблоном по LES-54 |
| POST /teacher/lesson-series/{series_id}/cancel | `{scope, from_lesson_id?, expected_version, reason?}` | 200 `TeacherSeries` |

- `first_local_start` — локальная дата и время до минуты без смещения, например `2026-11-23T17:00`. `timezone` — имя зоны IANA. `ambiguous_time` принимает `earlier` или `later` и применяется ко всем неоднозначным датам этого плана. Для «Это и следующие» зона берётся из серии, `from_lesson_id` должен принадлежать ей, а `expected_version` относится к версии серии.
- `TeacherSeries` содержит `series_id, student_card_id, timezone, version, content_template, lessons`. `content_template` содержит общие поля содержания для редактора преподавателя. `lessons` — `TeacherLesson[]` в порядке `series_position`. Начальная версия серии — 1. Массив включает созданные уроки и рассчитанные даты. Исключённые позиции пропущены. Перед серийными действиями преподаватель загружает актуальную серию, чтобы показать область изменений.
- `SeriesPlan` содержит `occurrences` с `series_position, lesson_id?, local_start, starts_at, ends_at, utc_offset_minutes, conflicts` и `preserved_lesson_ids` для переноса. `conflicts` — логический признак конфликта этого интервала. ID блокирующего занятия, имена и карточки план не содержит. Предпросмотр с конфликтом остаётся 200. Сохранение пересчитывает план и при конфликте даёт 409. После изменения прав или версии предпросмотр и сохранение применяют те же проверки, что и другие команды.

Для отмены серии `scope=following` требует `from_lesson_id` по LES-24. При `scope=all_future` поле `from_lesson_id` отсутствует, действуют правила LES-55. Семейные маршруты не принимают команды изменения шаблона.

## Предупреждения о неявке

В маршрутах чтения `{cabinet}` может быть любым из трёх кабинетов, в маршрутах записи — только `student` или `parent`. Предупреждение не является запросом на автоматическую отмену.

| Метод и путь | Вход | Успех |
| --- | --- | --- |
| POST /{cabinet}/lessons/{lesson_id}/absence-notices | `{reason?, expected_version}` урока | 201 `AbsenceNotice` и `Location`. 200 при допустимом повторе |
| GET /{cabinet}/lessons/{lesson_id}/absence-notices | `limit?, cursor?` | 200 страница предупреждений по уроку |
| GET /{cabinet}/absence-notices/{notice_id} | — | 200 `AbsenceNotice` |
| POST /{cabinet}/absence-notices/{notice_id}/withdraw | `{expected_version}` предупреждения | 200 `AbsenceNotice` со статусом `withdrawn` |

`AbsenceNotice` содержит `notice_id, lesson_id, requester_role, reason, status, created_at, version`. Состояния — `open`, `closed`, `withdrawn`. Повтор от того же автора с той же причиной возвращает открытое предупреждение с 200. Другая отправка при открытом предупреждении даёт 409 `lesson_absence_notice_pending`. Отзывает только автор. Чтение и запись повторно проверяют связь с карточкой.

## Уведомления

В кабинете показываются обычные уведомления о назначении, отмене, восстановлении, удалении, результате занятия и решении по запросу переноса. Назначение не создаёт команды для ученика. О предупреждении узнаёт преподаватель, а решение по расписанию он выполняет обычными действиями урока. У предложения переноса ссылка открывает запрос. Уведомление об удалении содержит только вид события и время. Условия выдачи и устранения дублей определены в LES-39/40. Для чтения используется `GET /{cabinet}/lesson-notifications` с `limit, cursor`. Для отметки прочтения используется `POST /{cabinet}/student-cards/{card_id}/lesson-notifications/{notification_id}/read`, ответ 204. Список содержит `notification_id, student_card_id, event, occurred_at, lesson_id, related_id, read, actionable`. Предложение без ответа остаётся в истории, а `actionable` становится ложным.

## Ошибки и обработка календарём

| HTTP и code | Когда |
| --- | --- |
| `403 authentication_required`, `csrf_failed` или `teacher_cabinet_required` | Отсутствует сессия, CSRF или включённый учительский кабинет для учительского маршрута. |
| `404 resource_not_found` | Объект недоступен, отсутствует или принадлежит другому контексту. |
| `412 precondition_failed`, `428 precondition_required` | Версия ETag для удаления изменилась или заголовок отсутствует. |
| `409 lesson_student_not_linked` | В активной карточке преподавателя нет подключённого профиля ученика. |
| `409 lesson_absence_notice_pending` | По этому уроку уже есть открытое предупреждение о неявке. |
| `409 lesson_reschedule_pending` | У урока уже есть другое открытое предложение переноса. |
| `409 version_conflict` | Версия занятия, серии или карточки устарела. |
| `409 lesson_time_conflict` | План пересекает занятое время. Для единичного запроса достаточно кода. В предпросмотре серии конфликтующие интервалы отмечены по позициям. |
| `409 lesson_state_conflict` | Действие неприменимо к текущему состоянию или времени занятия, либо выбрана неподходящая запись для области серии. |
| `409 lesson_create_conflict` | Ключ создания уже использован с другим нормализованным запросом либо защищён маркером недавно удалённой записи по LES-38. |
| `409 student_card_has_open_lessons` | Архив карточки при наличии занятия в состоянии `scheduled`. Будет добавлено в действующий [маршрут архива](students.md) при реализации. |
| `422 validation_failed` | Формат даты, зона, длительность, горизонт, число занятий или окно календаря недопустимы. Дополнительное поле `local_time_issue` для серии содержит `series_position, local_date, code` с причиной `nonexistent` или `ambiguous` на первой проблемной дате из запроса. |

Обязательные заголовки и общий формат берутся из [контракта API](README.md). Расширения ошибок перечисляются в OpenAPI операций. При 409 календарь удерживает ввод формы, обновляет актуальную запись и предлагает подтвердить новое действие. При конфликте восстановления старый урок остаётся отменённым. Интерфейс предлагает черновик нового занятия по LES-41. Клиент автоматически не переотправляет изменяющую команду. При потере ответа на создание можно явным повтором отправить тот же ключ и те же данные. При переносе серии календарь показывает число затронутых и сохранённых записей и использует серверный предпросмотр по LES-20. Для отмены серии интерфейс показывает область по текущей версии и выбранному объёму. Сервер заново определяет её по LES-24 или LES-55 на момент записи.
