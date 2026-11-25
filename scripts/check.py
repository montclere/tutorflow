"""Запускает проверки TutorFlow из любой папки и сохраняет вывод в логах."""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from tempfile import NamedTemporaryFile

from specification import business_rule_ids, find_requirement


ROOT = Path(__file__).resolve().parents[1]
LOG_DIR = ROOT / ".artifacts/logs"


def run(command, label):
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    with NamedTemporaryFile(prefix=f"{label}-", suffix=".log", dir=LOG_DIR, delete=False) as log:
        path = Path(log.name)

        print(f"RUN {label}: {' '.join(command)}", flush=True)

        try:
            result = subprocess.run(
                command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, check=False
            )
        except OSError as exc:
            print(f"ERROR {label}: {exc}", file=sys.stderr)

            return False

    if result.returncode == 0:
        print(f"PASS {label}; log={path.relative_to(ROOT)}")

        return True

    print(f"FAIL {label} (exit={result.returncode}); log={path.relative_to(ROOT)}")
    print("\n".join(path.read_text(encoding="utf-8", errors="replace").splitlines()[-35:]))

    return False


def spec():
    return run([sys.executable, "scripts/check-spec.py"], "spec")


def architecture():
    return run([sys.executable, "backend/scripts/check-architecture.py"], "architecture")


def load_json(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def target(ids, config):
    known = business_rule_ids(ROOT)
    rules = load_json("tests/rule-map.json")["rules"]
    commands = []
    browser_check = False

    for identifier in ids:
        if identifier not in known:
            raise ValueError(f"Неизвестный BR-ID: {identifier}")

        group = rules.get(identifier)

        if not isinstance(group, dict) or not group:
            raise ValueError(f"{identifier}: отсутствуют проверки в tests/rule-map.json")

        for runner, selectors in group.items():
            match runner:
                case "pytest":
                    pattern = r"tests/[^\s:]+\.py::.+"
                    filter_args = ["-m", identifier.lower().replace("-", "_")]
                case "playwright":
                    browser_check = True
                    pattern = r"[a-zA-Z0-9/_-]+\.spec\.ts"
                    filter_args = ["--grep", rf"@{identifier}(?:\s|$)"]
                case _:
                    raise ValueError(f"{identifier}: неизвестный раннер {runner}")

            if (
                not isinstance(selectors, list)
                or not selectors
                or not all(
                    isinstance(value, str) and re.fullmatch(pattern, value) for value in selectors
                )
            ):
                raise ValueError(f"{identifier}: некорректные селекторы {runner}")

            commands.extend(
                (
                    [*config["targeted"][runner], *filter_args, selector],
                    f"rule-{identifier}-{runner}-{index}",
                )
                for index, selector in enumerate(selectors, 1)
            )

    if browser_check:
        if not run(["npm", "--prefix", "frontend", "run", "build"], "rule-browser-build"):
            return False

    return all([run(command, label) for command, label in commands])


def changed_areas(base, areas):
    paths = set()

    for command in (
        ["diff", "--name-only", "--no-renames", "-z", base, "--"],
        ["ls-files", "--others", "--exclude-standard", "-z"],
    ):
        output = subprocess.check_output(["git", *command], cwd=ROOT)

        paths.update(path for path in output.decode(errors="surrogateescape").split("\0") if path)

    if any(not path.startswith(tuple(name + "/" for name in areas)) for path in paths):
        return areas

    return [name for name in areas if any(path.startswith(name + "/") for path in paths)]


def configured_checks(config, areas, stage):
    results = []

    for area in areas:
        commands = config[area][stage]

        if not commands:
            raise ValueError(f"Не заданы проверки {area}/{stage} в scripts/checks.json")

        for index, command in enumerate(commands, 1):
            if (
                not isinstance(command, list)
                or not command
                or not all(isinstance(arg, str) and arg for arg in command)
            ):
                raise ValueError(f"Некорректная команда {area}/{stage}")

            results.append(run(command, f"{area}-{stage}-{index}"))

    return all(results)


def git_policy():
    return load_json("scripts/checks.json")["git"]


def validate_commit_message(message):
    policy = git_policy()
    actions = "|".join(re.escape(value) for value in policy["actions"])
    areas = "|".join(re.escape(value) for value in policy["areas"])
    ordinary = re.fullmatch(
        rf"(?:{actions})\((?:{areas})\): ([^\n]+) "
        r"\(Issue #[1-9]\d*(?:, Issue #[1-9]\d*)*\)",
        message,
    )

    if ordinary and re.search(r"[А-ЯЁа-яё]", ordinary[1]):
        return True

    merge = re.fullmatch(
        r"Merge PR #([1-9]\d*): ([^\n]+)\n\n"
        r"https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/\1",
        message,
    )

    if merge and re.search(r"[А-ЯЁа-яё]", merge[2]):
        return True

    raise ValueError(
        "Формат коммита: action(area): русское описание (Issue #номер). "
        "Действие и область выбираются из check git-policy. "
        "Merge-коммит: Merge PR #номер: русское описание, пустая строка и URL этого PR."
    )


def check_commit_message(path):
    lines = [
        line
        for line in path.read_text(encoding="utf-8").strip().splitlines()
        if not line.startswith("#")
    ]

    return validate_commit_message("\n".join(lines).strip())


def check_commit_range(base, head):
    revisions = []

    for reference in (base, head):
        revisions.append(
            subprocess.check_output(
                ["git", "rev-parse", "--verify", "--end-of-options", f"{reference}^{{commit}}"],
                cwd=ROOT,
                text=True,
            ).strip()
        )

    commits = subprocess.check_output(
        ["git", "rev-list", "--reverse", f"{revisions[0]}..{revisions[1]}", "--"],
        cwd=ROOT,
        text=True,
    ).splitlines()

    if not commits:
        raise ValueError("Диапазон не содержит новых коммитов")

    for commit in commits:
        message = subprocess.check_output(
            ["git", "show", "-s", "--format=%B", commit], cwd=ROOT, text=True
        ).strip()

        validate_commit_message(message)

    return True


def check_branch_name(name, *, pull_request=None):
    policy = git_policy()

    if pull_request is not None and policy["legacy_branches"].get(name) == pull_request:
        return True

    actions = "|".join(re.escape(value) for value in policy["actions"])
    areas = "|".join(re.escape(value) for value in policy["areas"])
    pattern = rf"(?:{actions})/(?:uc-(?!000)[0-9]{{3}}|(?:{areas})/issue-[1-9]\d*)"

    if not re.fullmatch(pattern, name):
        raise ValueError(
            "Имя ветки: action/uc-NNN или action/area/issue-N. "
            "Действие и область выбираются из check git-policy."
        )

    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_subparsers(dest="mode", required=True)

    descriptions = {
        "spec": "Структура документов и ссылки UC/BR.",
        "architecture": "Границы модулей и направление зависимостей.",
        "pr": "Статические и контрактные проверки перед PR.",
        "all": "Полная проверка проекта с браузерными сценариями.",
        "ci": "Полная проверка в CI.",
    }

    for name, description in descriptions.items():
        modes.add_parser(name, help=description, description=description)

    modes.add_parser("git-policy", help="Допустимые действия и области Git.")

    branch = modes.add_parser("branch-name", help="Проверить имя рабочей ветки.")

    branch.add_argument("name")
    branch.add_argument("--pull-request", type=int, help="Номер PR для переходного исключения")

    commits = modes.add_parser("commit-range", help="Проверить сообщения всех коммитов PR.")

    commits.add_argument("--base", required=True)
    commits.add_argument("--head", default="HEAD")

    modes.add_parser("locate", help="Найти источник UC/BR по ID.").add_argument("ids", nargs="+")

    modes.add_parser("rule", help="Выполнить проверки выбранных BR.").add_argument("ids", nargs="+")
    modes.add_parser(
        "changed", help="Проверить изменённые области относительно Git ref."
    ).add_argument("--base", default="HEAD")
    modes.add_parser("commit-message", help="Проверить формат сообщения коммита.").add_argument(
        "path", type=Path
    )

    args = parser.parse_args()

    if args.mode == "git-policy":
        for group, values in git_policy().items():
            print(group)

            for name, description in values.items():
                print(f"  {name}: {description}")

        return True

    if args.mode == "commit-range":
        return check_commit_range(args.base, args.head)

    if args.mode == "branch-name":
        return check_branch_name(args.name, pull_request=args.pull_request)

    if args.mode == "locate":
        for identifier in args.ids:
            path, content = find_requirement(ROOT, identifier)

            print(f"{path}\n\n{content}\n")

        return True

    if args.mode == "commit-message":
        return check_commit_message(args.path)

    if args.mode == "spec":
        return spec()

    if args.mode == "architecture":
        return architecture()

    config = load_json("scripts/checks.json")

    if args.mode == "rule":
        return target(args.ids, config)

    areas = ["backend", "frontend", "deploy", "tests"]

    if args.mode == "changed":
        areas = changed_areas(args.base, areas)

    stage = "all" if args.mode in ("ci", "all") else "pr"
    checks = (
        spec(),
        architecture(),
        run(["sh", "scripts/format.sh", "--check", "all"], "format"),
        configured_checks(config, areas, stage),
    )

    return all(checks)


if __name__ == "__main__":
    try:
        sys.exit(0 if main() else 1)
    except (KeyError, OSError, ValueError, subprocess.CalledProcessError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(2)
