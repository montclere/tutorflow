#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
: "${TUTORFLOW_TEST_WEB_URL:?Сначала запусти ./scripts/dev.sh check}"
: "${TUTORFLOW_TEST_MAILPIT:?Сначала запусти ./scripts/dev.sh check}"
: "${TUTORFLOW_TEST_INBOX:?Сначала запусти ./scripts/dev.sh check}"
node --check scripts/build.mjs
node --check playwright.config.mjs
node --check tests/invitations.spec.mjs
npm run typecheck
npm run build
npm test
