#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

# Зависимости ставит ./scripts/dev.sh setup (npm ci и Chromium для Playwright).
npm run lint
npm run typecheck
npm test
npm run build

# Браузерные сценарии идут только на тестовом стеке ./scripts/dev.sh check: он задаёт адреса ниже.
: "${TUTORFLOW_TEST_WEB_URL:?Браузерные сценарии запускает ./scripts/dev.sh check}"
: "${TUTORFLOW_TEST_MAILPIT:?Браузерные сценарии запускает ./scripts/dev.sh check}"
: "${TUTORFLOW_TEST_INBOX:?Браузерные сценарии запускает ./scripts/dev.sh check}"
npm run e2e
