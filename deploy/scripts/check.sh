#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."

# Проверка конфигурации Compose
POSTGRES_PASSWORD=compose-config-check docker compose -f compose.yaml config --quiet
