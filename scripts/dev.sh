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
    check)
        shift
        if [ "$#" -eq 0 ]; then
            set -- all
        fi
        exec python3 scripts/check.py "$@"
        ;;
    github)
        shift
        exec python3 scripts/render-github.py "$@"
        ;;
    format) exec sh scripts/format.sh --write "${2:-all}" ;;
    format-check)
        scope="${2:-all}"
        sh scripts/format.sh --check "$scope"
        if [ "$scope" != code ]; then
            exec python3 scripts/check.py spec
        fi
        ;;
    help|--help|-h)
        cat <<'HELP'
Утилиты TutorFlow
Назначение — установка окружения, проверки, форматирование и генерация материалов GitHub.

Режимы
  setup                       Установить зависимости и Chromium.
  check                       Выполнить полный набор проверок.
  check pr                    Выполнить проверки перед PR.
  check rule BR-ID...         Проверить выбранные бизнес-правила.
  check locate UC-ID|BR-ID... Найти требования и вывести только связанные фрагменты.
  check spec                  Проверить структуру и связи требований.
  check architecture          Проверить границы модулей.
  check git-policy            Допустимые действия и области Git.
  check branch-name NAME      Проверить имя рабочей ветки.
  check commit-range --base R Проверить сообщения новых коммитов.
  check changed --base REF    Проверить затронутые области.
  format [all|code|docs]       Применить форматирование.
  format-check [all|code|docs] Проверить форматирование, для документов также связи.
  github uc|br|pr FILE.json    Сформировать заголовок и описание без публикации.
  github branch FILE.json      Сформировать имя ветки.
  github merge FILE.json       Сформировать сообщение merge-коммита.
  check --help                Параметры механизма проверок.
  github --help               Входные поля генератора GitHub.

Запуск из репозитория — ./scripts/dev.sh РЕЖИМ.
Результат — итог проверки или сгенерированный текст. Ошибка возвращает ненулевой код.
Проверки сохраняют подробный вывод в .artifacts/logs.
HELP
        ;;
    *) printf 'Неизвестная команда: %s\n' "$1" >&2; exit 2 ;;
esac
