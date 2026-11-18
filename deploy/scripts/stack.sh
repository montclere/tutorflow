#!/usr/bin/env bash

stack_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
stack_state="$stack_root/.local-stack"
stack_config="$stack_root/deploy"

compose_dev() {
  local files=(-f "$stack_config/compose.yaml" -f "$stack_config/compose.dev.yaml")
  if [[ "$stack_project" == tutorflow-check-* ]]; then
    files+=(-f "$stack_config/compose.check.yaml")
  fi
  docker compose --env-file /dev/null --project-name "$stack_project" "${files[@]}" "$@"
}

prepare_images() {
  docker image inspect postgres:16.13-alpine >/dev/null 2>&1 || docker pull postgres:16.13-alpine
  docker image inspect caddy:2.11.8-alpine >/dev/null 2>&1 || docker pull caddy:2.11.8-alpine
  docker image inspect axllent/mailpit:v1.33.1 >/dev/null 2>&1 || docker pull axllent/mailpit:v1.33.1
  docker build --label "tutorflow.lock=$(sha256sum "$stack_root/backend/uv.lock" | cut -d ' ' -f1)" \
    -t tutorflow-backend:dev "$stack_root/backend"
}

random_value() {
  python3 -c 'import secrets; print(secrets.token_hex(32))'
}

available_port() {
  python3 - <<'PY'
from socket import socket
with socket() as listener:
    listener.bind(("127.0.0.1", 0))
    print(listener.getsockname()[1])
PY
}

configure_dev_stack() {
  local name=$1 port=$2
  stack_project="$name"
  stack_dir="$stack_state/$name"
  mkdir -p "$stack_dir"
  chmod 700 "$stack_dir"
  mkdir -p "$stack_dir/inbox"
  chmod 700 "$stack_dir/inbox"
  if [[ ! -s "$stack_dir/db-password" || ! -s "$stack_dir/app-key" ]]; then
    (umask 077; random_value >"$stack_dir/db-password"; random_value >"$stack_dir/app-key")
  fi
  export TUTORFLOW_DB_NAME=tutorflow TUTORFLOW_DB_USER=tutorflow
  export TUTORFLOW_DB_PASSWORD="$(<"$stack_dir/db-password")"
  export TUTORFLOW_DATABASE_URL="postgresql+psycopg://tutorflow:$TUTORFLOW_DB_PASSWORD@db:5432/tutorflow"
  export TUTORFLOW_SECRET_KEY="$(<"$stack_dir/app-key")"
  export TUTORFLOW_WEB_PORT="$port"
  export TUTORFLOW_MAILPIT_PORT="${3:-${TUTORFLOW_DEV_MAILPIT_PORT:-18761}}"
  export TUTORFLOW_BROWSER_ORIGIN="http://127.0.0.1:$port"
  export TUTORFLOW_BACKEND_IMAGE=tutorflow-backend:dev TUTORFLOW_WEB_IMAGE=caddy:2.11.8-alpine
  export TUTORFLOW_UID="$(id -u)" TUTORFLOW_GID="$(id -g)" TUTORFLOW_INBOX="$stack_dir/inbox"
}

start_dev_stack() {
  local image_lock expected_lock
  image_lock="$(docker image inspect --format '{{index .Config.Labels "tutorflow.lock"}}' tutorflow-backend:dev)"
  expected_lock="$(sha256sum "$stack_root/backend/uv.lock" | cut -d ' ' -f1)"
  if [[ "$image_lock" != "$expected_lock" ]]; then
    printf 'Обновите локальный образ через ./scripts/dev.sh setup.\n' >&2
    return 1
  fi
  compose_dev up -d --wait --wait-timeout 65 --pull never
  for _ in {1..20}; do
    if curl --fail --silent "$TUTORFLOW_BROWSER_ORIGIN/api/v1/health" >/dev/null; then
      return
    fi
    sleep 1
  done
  printf 'Web не отвечает по адресу %s\n' "$TUTORFLOW_BROWSER_ORIGIN" >&2
  return 1
}

configure_check_stack() {
  configure_dev_stack "tutorflow-check-$$-$RANDOM" "$(available_port)" "$(available_port)"
  export TUTORFLOW_DB_PORT="$(available_port)"
  trap cleanup_check_stack EXIT
  start_dev_stack
  export TUTORFLOW_TEST_DATABASE_URL="postgresql+psycopg://tutorflow:$TUTORFLOW_DB_PASSWORD@127.0.0.1:$TUTORFLOW_DB_PORT/tutorflow"
  export TUTORFLOW_TEST_WEB_URL="$TUTORFLOW_BROWSER_ORIGIN"
  export TUTORFLOW_TEST_MAILPIT="http://127.0.0.1:$TUTORFLOW_MAILPIT_PORT"
  export TUTORFLOW_TEST_INBOX="$TUTORFLOW_INBOX"
}

cleanup_check_stack() {
  if compose_dev down -v --remove-orphans >/dev/null; then
    rm -r -- "$stack_dir"
  fi
}

build_production() {
  local tag=$1
  if [[ ! "$tag" =~ ^[a-zA-Z0-9_][a-zA-Z0-9._-]{0,79}$ || "$tag" == "latest" || "$tag" == "dev" ]]; then
    printf 'Укажите отдельный тег выпуска.\n' >&2
    return 2
  fi
  npm --prefix "$stack_root/frontend" run build
  docker build -t "tutorflow-backend:$tag" "$stack_root/backend"
  docker build -f "$stack_config/web.Dockerfile" -t "tutorflow-web:$tag" "$stack_root"
}
