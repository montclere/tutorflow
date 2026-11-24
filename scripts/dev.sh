#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
case "${1:-help}" in
    setup)
        uv sync --project backend --locked
        npm --prefix frontend ci
        npm --prefix tests/e2e ci
        npm --prefix tests/e2e exec -- playwright install chromium
        ;;
    check) exec python3 scripts/check.py all ;;
    help) printf 'Использование: ./scripts/dev.sh [setup|check]\n' ;;
    *) printf 'Неизвестная команда: %s\n' "$1" >&2; exit 2 ;;
esac
