# frontend-api

Общий контракт backend и frontend.

- Перед параллельной реализацией согласовать маршрут, метод, авторизацию, запрос, ответ и ошибки.
- Указывать ID правила, типы, обязательность полей, пределы и примеры без персональных данных.
- Тестовые ответы должны соответствовать контракту; их использование не означает готовность backend.
- Несовместимое изменение согласовать с обоими исполнителями до слияния.

## Регистрация преподавателя

Статус: интерфейс клиента зафиксирован, HTTP-маршруты не согласованы, backend отсутствует. Типы — `frontend/src/features/auth/api/types.ts`; клиент обращается только к этому модулю.

| Функция | Результат | Ошибки (`AuthErrorCode`) | Правило |
|---|---|---|---|
| `startTelegramAuth()` | `{ user, isNew }` | `cancelled`, `signatureInvalid` | SIGNUP-2 |
| `startGoogleAuth()` | `{ user, isNew }` | `cancelled` | SIGNUP-2 |
| `requestEmailCode(email)` | — | `invalidEmail`, `tooManyRequests` | SIGNUP-3, SIGNUP-9 |
| `verifyEmailCode(email, code)` | `{ user, isNew }` | `invalidCode`, `codeExpired`, `attemptsExceeded` | SIGNUP-4, SIGNUP-9 |
| `acceptConsent(version)` | — | — | SIGNUP-8 |
| `completeProfile({ name, subjects, studentsRange, timezone })` | — | `validation` | SIGNUP-6, SIGNUP-10 |

- `user`: `{ id: string, name: string }`; `name` — имя из Telegram или Google, для входа по почте может быть пустым.
- `isNew = false` — пользователь уже зарегистрирован, клиент сразу открывает `/teacher` (SIGNUP-7).
- `subjects` — непустой список из `math`, `english`, `russian`, `physics`, `chemistry`, `other` в порядке показа; демо-данные строятся по первому.
- `studentsRange` — `upTo5`, `from6To15`, `from16To30`, `over30` или `null`.
- `timezone` — идентификатор IANA из браузера, например `Asia/Novosibirsk`; пустая строка, если браузер его не дал.
- Клиент вызывает `acceptConsent` сразу после первого успешного входа, до показа следующего шага; версия документа — `siteConfig.consentVersion`.
- Любая другая ошибка сервера приходит клиенту как `unavailable` или `unknown`; технические детали остаются в журналах сервера.

Что нужно от backend:

- Проверка подписи Telegram Login и обмен кода Google OAuth на сервере; сессия после входа.
- Коды по почте: срок жизни 10 минут, до 5 попыток, отправка не чаще раза в 60 секунд на адрес.
- Хранение согласия: пользователь, версия документа, время.
- Сохранение профиля и создание демо-учеников с уроками на неделю по первому предмету.
- Маршрут кабинета преподавателя `/teacher`.
