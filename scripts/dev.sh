#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

case "${1:-help}" in
  check)
    python3 scripts/check.py
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
  help|--help|-h)
    printf 'Usage: ./scripts/dev.sh [check|help]\n'
    ;;
  *)
    printf 'Unknown command: %s\n' "$1" >&2
    exit 2
    ;;
esac
