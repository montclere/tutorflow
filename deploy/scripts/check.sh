#!/usr/bin/env bash
set -euo pipefail

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$root/deploy/scripts/stack.sh"

: "${TUTORFLOW_TEST_WEB_URL:?Сначала запусти ./scripts/dev.sh check}"
stack_project="${TUTORFLOW_CHECK_PROJECT:?Используй общий скрипт проверки}"
compose_dev config --quiet
compose_dev exec -T web caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
curl --fail --silent "$TUTORFLOW_TEST_WEB_URL/api/v1/health"

export TUTORFLOW_DOMAIN=tutorflow.invalid
export TUTORFLOW_SMSC_API_KEY=only-config-check
export TUTORFLOW_SMSC_SENDER=TutorFlow
export TUTORFLOW_SMTP_HOST=smtp.invalid
export TUTORFLOW_SMTP_SENDER=tutorflow@example.invalid
export TUTORFLOW_BROWSER_ORIGIN=https://tutorflow.invalid
prod=(docker compose --env-file /dev/null --project-name tutorflow-prod-check
  -f "$root/deploy/compose.yaml" -f "$root/deploy/compose.prod.yaml")
"${prod[@]}" config --quiet
mapfile -t services < <("${prod[@]}" config --services | sort)
if [[ "${services[*]}" != "api db maintenance migrate web" ]]; then
  printf 'Неожиданный набор production-сервисов.\n' >&2
  exit 1
fi
printf '\nOK: Compose dev/prod, Caddy, HTTP healthcheck и prod без Mailpit\n'
