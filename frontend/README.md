# frontend

Лендинг и регистрация преподавателя. Стек и причины выбора — [INF-2](../docs/decisions.md), правила — [AGENTS.md](AGENTS.md), API — [контракт](../docs/frontend-api.md).

## Запуск

```bash
cd frontend
npm ci
cp .env.example .env.local   # VITE_AUTH_MOCK=1 включает заглушку API
npm run dev
```

Проверки: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; всё сразу — `scripts/check.sh`.

## Переменные окружения

- `VITE_AUTH_MOCK=1` — заглушка API регистрации. Работает только в `npm run dev`, в сборку не попадает.
- `VITE_DEMO_URL` — адрес демо-кабинета. Пока пусто, кнопка «Смотреть демо» скрыта.

## Заглушка API

- Telegram и Google сразу «входят» с именем «Анна» / «Анна Кузнецова».
- Подходит любой код из 6 цифр, кроме `000000` — он неверный; после 5 неверных попыток нужен новый код.
- Почта, начинающаяся с `registered@`, — уже зарегистрированный пользователь: после кода откроется `/teacher`.

## Где что лежит

- `src/content/landing.ru.ts` — все тексты; `src/config/site.ts` — название, цены, пробный период.
- `src/styles/tokens.css` — цвета, шрифты, кегли, радиусы, тени.
- `src/features/signup/model` — логика мастера без разметки, с тестами.
- `src/features/auth/api` — единственная точка обращения к API регистрации.
- `public/3d/{coin,coins-stack,calendar,plane,alarm}.webp` — 3D-картинки. Пока файла нет, рисуется SVG-заглушка; после добавления картинки перезапустите `npm run dev`.
