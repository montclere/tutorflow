#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."

mode="$1"
scope="$2"

case "$mode" in
    --check|--write) ;;
    *) printf 'Неизвестный режим форматирования: %s\n' "$mode" >&2; exit 2 ;;
esac
case "$scope" in
    all|code|docs) ;;
    *) printf 'Допустимые области: all, code, docs\n' >&2; exit 2 ;;
esac

format_code() {
    python3 scripts/format-python.py "${mode#--}"
    npm --prefix frontend run --silent format:files -- "$mode" \
        'src/**/*.{ts,tsx,js,jsx,css}' 'eslint.config.js' 'vite.config.ts' 'index.html' \
        '../tests/e2e/**/*.{ts,tsx,js,mjs}'
}

format_docs() {
    npm --prefix frontend run --silent format:files -- "$mode" --ignore-path ../.gitignore \
        '../**/*.md' '../.agents/**/*.md' '../.github/**/*.md'
}

if [ "$scope" != docs ]; then
    format_code
fi
if [ "$scope" != code ]; then
    format_docs
fi
