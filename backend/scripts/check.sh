#!/usr/bin/env bash
set -euo pipefail

backend_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$backend_root"

if [[ ! -d .venv ]]; then
  printf 'Сначала выполните ./scripts/dev.sh setup из корня репозитория.\n' >&2
  exit 1
fi

uv run --no-sync ruff check . ../scripts
uv run --no-sync ruff format --check . ../scripts
uv run --no-sync pyright
uv run --no-sync pytest
