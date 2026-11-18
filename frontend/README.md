# frontend

Интерфейс TutorFlow на React и Vite: лендинг, регистрация и вход, кабинет репетитора. API вызывается с того же origin через Caddy, секрет приглашения переносится во фрагменте адреса. Стек и причины — [INF-7](../docs/adr/platform.md#inf-7--стек-веб-интерфейса), правила — [ADR интерфейса](../docs/adr/web.md) и [AGENTS.md](AGENTS.md), API — [контракт](../docs/api/README.md).

## Запуск

- Со всем стеком (backend, БД, Caddy) — `./scripts/dev.sh up` из корня, см. [scripts](../scripts/README.md).
- Только интерфейс на тестовых данных:

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Проверки: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Браузерные сценарии Playwright запускает `./scripts/dev.sh check` на тестовом стеке.

## Где что лежит

- `src/content/*.ru.ts` — тексты; `src/config/site.ts` — название, цены, пробный период; `.env.example` — переменные окружения.
- `src/styles/tokens.css` — цвета, шрифты, кегли, радиусы, тени.
- `src/cabinet` — кабинет: `model` — логика с тестами, `data` — источник данных, `pages` — экраны.
- `src/features/signup` — мастер регистрации; `src/features/auth/api` — обращения к API входа.
- `public/3d/*.webp` — 3D-картинки лендинга; пока файла нет, рисуется SVG-заглушка.
- `tests/*.spec.mjs` — браузерные сценарии Playwright.
