# students API

Маршруты относительно `/api/v1`. Формат запросов и ошибок — в [общем договоре](README.md); доступ — в [матрице](../adr/students.md).

## Приглашения

| Метод и путь | Вход | Успех |
| --- | --- | --- |
| POST /teacher/invitations | `{purpose}` | 201 `{invitation: InvitationSummary, invitation_token}`; секрет выдаётся один раз |
| GET /teacher/invitations | limit, cursor | 200 список собственных InvitationSummary |
| DELETE /teacher/invitations/{invitation_id} | — | 204 отзыв pending либо повтор своего отзыва; 409 invitation_already_accepted для принятой ссылки; 400 invitation_unavailable для истёкшей |
| POST /invitations/preview | `{invitation_token}` | 200 `{purpose, expires_at}` для доступной pending ссылки; допускается анонимный CSRF-контекст |
| POST /invitations/accept | `{invitation_token, student_card_name?}` | 201 InvitationAcceptance при создании, 200 при допустимом повторе |

`InvitationSummary`: `invitation_id, purpose, status, created_at, expires_at`. Список не показывает получателя или карточку. Preview не выдаёт профиль преподавателя, контакт или сведения о получателе, имя ребёнка, ID карточки и не меняет состояние. Назначение: `new_student_card_for_student` или `new_student_card_for_parent`. В запросе выпуска нет других полей. Чужая или отсутствующая ссылка в маршруте отзыва даёт 404. Отозванная преподавателем ссылка повторно отзывается с 204; принятая остаётся принятой, в том числе после истечения срока.

## Принятие и повтор

Требуется активная сессия с подтверждённым контактом. Предварительное включение кабинета ученика или родителя не требуется. Поле `student_card_name` обязательно только для родительского варианта и запрещено для ученического; размер и нормализация — в [data](../adr/privacy.md). Отдельных полей для аккаунта, роли и существующей карточки нет.

`InvitationAcceptance`: `{purpose, student_card_id}` для ученика; для родителя дополнительно `parent_access_id`. После успешного принятия detail берётся по маршруту своей роли.

- Сначала проверяются секрет, состояние, срок и актор. Неверная, просроченная или отозванная ссылка, собственная ссылка преподавателя, ссылка неактивного владельца, попытка другого аккаунта или утрата прав на результат дают `400 invitation_unavailable` без деталей.
- Для повтора от исходного аккаунта сервер проверяет актуальный доступ к исходному результату. До истечения срока тот же нормализованный запрос получает тот же набор ID; изменённое имя в запросе даёт `409 invitation_acceptance_conflict` только если результат ещё доступен этому аккаунту. После отзыва ID и причина отказа не возвращаются. Preview принятой ссылки всегда недоступен.
- При pending ученической ссылке уже связанная пара преподаватель/аккаунт ученика даёт `409 student_card_already_linked` без существующего `student_card_id`; новое приглашение остаётся непогашенным. Совпадение имени не является конфликтом. Две разные родительские ссылки могут дать две отдельные карточки одному аккаунту.
- `422 validation_failed` для полей, зависящих от назначения, применяется лишь после проверки доступности ссылки. Источник правил гонки и атомарности — [students](../adr/students.md).

## Карточки и родительский доступ

| Метод и путь | Вход | Успех |
| --- | --- | --- |
| GET /teacher/student-cards | limit, cursor, status | 200 список TeacherStudentCard; только свои |
| GET /teacher/student-cards/{student_card_id} | — | 200 TeacherStudentCard |
| PATCH /teacher/student-cards/{student_card_id} | `{student_card_name?, subject?, learning_goal?, private_note?, expected_version}` | 200 TeacherStudentCard; хотя бы одно изменяемое поле |
| POST /teacher/student-cards/{student_card_id}/archive | `{expected_version}` | 200 TeacherStudentCard |
| POST /teacher/student-cards/{student_card_id}/restore | `{expected_version}` | 200 TeacherStudentCard |
| GET /student/student-cards | limit, cursor | 200 список StudentCabinetCard; только связанные активные |
| GET /student/student-cards/{student_card_id} | — | 200 StudentCabinetCard |
| GET /parent/student-cards | limit, cursor | 200 список ParentCabinetCard; только действующие разрешения |
| GET /parent/student-cards/{student_card_id} | — | 200 ParentCabinetCard |
| GET /teacher/student-cards/{student_card_id}/parent-access | limit, cursor | 200 список ParentAccessSummary для своей карточки |
| DELETE /parent-access/{parent_access_id} | — | 204 отзыв владельцем карточки или отказ родителя от своего доступа; для того же владельца или родителя допустим безопасный повтор; другим 404 |

`TeacherStudentCard`: `student_card_id, student_card_name, student_account_id` (nullable), `subject, learning_goal, private_note, status, created_at, updated_at, version`.

`StudentCabinetCard`: `student_card_id, student_card_name, subject, learning_goal, teacher_display_name`. `ParentCabinetCard`: те же поля и собственный `parent_access_id`. `teacher_display_name` берётся из личного профиля преподавателя. Контакт возвращает только identity для владельца. Закрытую заметку видит только преподаватель карточки.

`ParentAccessSummary`: `parent_access_id, student_card_id, parent_display_name, status`. Преподаватель видит только разрешения к своим карточкам. Родитель не видит другие разрешения даже при знании ID. История и новые виды доступа появятся только в собственных контрактах будущих этапов.
