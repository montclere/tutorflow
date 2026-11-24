#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."

# Проверка конфигурации Compose
POSTGRES_PASSWORD=compose-config-check docker compose -f compose.yaml config --quiet

# Синтаксис и PromQL правил оповещений
docker run --rm \
    -v "$(pwd)/monitoring:/rules:ro" \
    --entrypoint /bin/promtool \
    prom/prometheus:v3.16.0@sha256:e04987641b57704f408e31f6373ba4138ecf27cb4a165d24aabb6c38fddd0f06 \
    check rules /rules/alerts.yml
