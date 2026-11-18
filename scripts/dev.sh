#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

case "${1:-help}" in
  setup)
    uv sync --project backend --locked
    npm --prefix frontend ci
    (cd frontend && npm exec -- playwright install chromium)
    source deploy/scripts/stack.sh
    prepare_images
    ;;
  check)
    python3 scripts/check.py
    if [[ -f deploy/scripts/stack.sh ]]; then
      source deploy/scripts/stack.sh
      npm --prefix frontend run build
      configure_check_stack
      export TUTORFLOW_CHECK_PROJECT="$stack_project"
    fi
    for module in backend frontend deploy; do
      module_check="$module/scripts/check.sh"
      if [[ -f "$module_check" ]]; then
        printf 'CHECK %s\n' "$module"
        bash "$module_check"
      else
        printf 'SKIP %s: проверки приложения пока не подключены\n' "$module"
      fi
    done
    ;;
  up)
    source deploy/scripts/stack.sh
    configure_dev_stack tutorflow-dev "${TUTORFLOW_DEV_PORT:-18760}"
    npm --prefix frontend run build
    start_dev_stack
    printf 'TutorFlow: %s\nMailpit: http://127.0.0.1:%s\nТестовые SMS: %s\n' \
      "$TUTORFLOW_BROWSER_ORIGIN" "$TUTORFLOW_MAILPIT_PORT" "$TUTORFLOW_INBOX"
    ;;
  down)
    source deploy/scripts/stack.sh
    configure_dev_stack tutorflow-dev "${TUTORFLOW_DEV_PORT:-18760}"
    compose_dev down
    ;;
  inbox)
    inbox_path="$repository_root/.local-stack/tutorflow-dev/inbox"
    [[ -d "$inbox_path" ]] || { printf 'Сначала запусти ./scripts/dev.sh up.\n' >&2; exit 1; }
    find "$inbox_path" -maxdepth 1 -type f -name '*.txt' -printf '%T@ %p\n' \
      | sort -nr | cut -d ' ' -f2- | while IFS= read -r file; do cat -- "$file"; done
    ;;
  build-prod)
    source deploy/scripts/stack.sh
    build_production "${2:-}"
    ;;
  help|--help|-h)
    printf 'Usage: ./scripts/dev.sh [setup|check|help]\n       ./scripts/dev.sh up|down|inbox|build-prod TAG\n'
    ;;
  *)
    printf 'Unknown command: %s\n' "$1" >&2
    exit 2
    ;;
esac
