"""Запускает проверки TutorFlow из любой папки и сохраняет вывод в логах."""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from tempfile import NamedTemporaryFile

from specification import RULE_PATTERN, business_rule_ids, find_requirement


ROOT = Path(__file__).resolve().parents[1]
LOG_DIR = ROOT / ".artifacts/logs"
DEPENDABOT_USER_ID = 49699333


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


def sections(body, headings):
    clean = re.sub(r"<!--.*?-->", "", body or "", flags=re.DOTALL)
    result = {}

    for heading in headings:
        match = re.search(
            rf"^#{{2,3}} {re.escape(heading)}[ \t]*\n(.*?)(?=^#{{1,3}} |\Z)",
            clean,
            re.MULTILINE | re.DOTALL,
        )

        if not match or match[1].strip() in ("", "_No response_"):
            raise ValueError(f"Заполните раздел «{heading}»")

        result[heading] = match[1].strip()

    return result


def validate_issue(issue):
    parts = sections(issue.get("body"), ("Результат", "Критерии приёмки"))

    if not re.search(r"^- \S", parts["Критерии приёмки"], re.MULTILINE):
        raise ValueError("Критерии приёмки должны быть списком проверяемых результатов")

    title = issue["title"]
    identifier = re.match(r"^\[((?:UC|BR)-\d{3})\] ", title)

    if not identifier:
        if not re.search(r"[А-ЯЁа-яё]", title) or re.match(r"^\[(?:UC|BR)-", title):
            raise ValueError("Укажите корректный UC/BR-ID или русское название технической задачи")

        return True

    _, content = find_requirement(ROOT, identifier[1])

    if identifier[1].startswith("UC-"):
        name = content.splitlines()[0].split(" — ", 1)[1]

        if title != f"[{identifier[1]}] {name}":
            raise ValueError("Название UC должно соответствовать документу сценария")
    else:
        rule = RULE_PATTERN.fullmatch(content)
        parent = issue.get("parent")

        if not rule or not parent:
            raise ValueError("BR должен иметь родительский UC через Sub-issues")

        validate_issue(parent)

        if not any(
            parent["title"].startswith(f"[UC-{uc.removeprefix('UC-')}]")
            for uc in rule[4].split("/")
        ):
            raise ValueError("Родительский UC не соответствует бизнес-правилу")

        if not title.startswith(f"[{identifier[1]}] {rule[3].split('/')[0]} — "):
            raise ValueError("Название BR должно содержать область правила")

    return True


def dependabot_pr(pull, repository):
    return (
        pull.get("user", {}).get("login") == "dependabot[bot]"
        and pull.get("user", {}).get("id") == DEPENDABOT_USER_ID
        and pull.get("user", {}).get("type") == "Bot"
        and pull.get("head", {}).get("repo", {}).get("full_name") == repository
        and pull.get("head", {}).get("ref", "").startswith("dependabot/")
    )


def validate_pull_request(pull, issue, repository):
    if pull["base"]["ref"] != "dev":
        raise ValueError("Рабочий PR должен быть направлен в dev")

    if dependabot_pr(pull, repository):
        if not pull.get("title", "").strip() or not pull.get("body", "").strip():
            raise ValueError("Dependabot: заполните заголовок и описание обновления")

        return True

    validate_issue(issue)

    if issue.get("parent"):
        raise ValueError(
            "Основная задача PR должна быть родительским UC или самостоятельной задачей"
        )

    check_branch_name(pull["head"]["ref"], pull_request=pull["number"])

    parts = sections(pull.get("body"), ("Задача", "Результат", "Проверки"))
    links = re.findall(r"https://github\.com/([^\s)]+/[^\s)]+)/issues/([1-9]\d*)", parts["Задача"])

    if links != [(repository, str(issue["number"]))]:
        raise ValueError("В разделе Задача нужна одна ссылка на основной Issue этого репозитория")

    expected_title = re.sub(r"^\[(UC-\d{3})\] ", r"\1: ", issue["title"])

    if pull["title"] != expected_title:
        raise ValueError(f"Ожидается заголовок PR: {expected_title}")

    if not re.search(r"^- \[[ xX]\] \S", parts["Проверки"], re.MULTILINE):
        raise ValueError("Проверки должны быть чеклистом")

    if not pull.get("draft") and re.search(r"^- \[ \]", parts["Проверки"], re.MULTILINE):
        raise ValueError("Незавершённые проверки требуют черновика PR")

    if not re.search(r"^- \S", parts["Результат"], re.MULTILINE):
        raise ValueError("Перечислите конкретные изменения в разделе Результат")

    branch = pull["head"]["ref"]
    uc = re.match(r"^\[(UC-\d{3})\]", issue["title"])

    if branch not in git_policy()["legacy_branches"]:
        expected = uc[1].lower() if uc else f"issue-{issue['number']}"

        if not branch.endswith(f"/{expected}"):
            raise ValueError("Ветка должна соответствовать основной задаче PR")

    return True


def github_json(endpoint):
    return json.loads(subprocess.check_output(["gh", "api", endpoint], text=True))


def github_issue(repository, number):
    issue = github_json(f"repos/{repository}/issues/{number}")

    if "pull_request" in issue:
        raise ValueError(f"Issue #{number} является PR")

    if re.match(r"^\[BR-", issue["title"]):
        issue["parent"] = github_json(f"repos/{repository}/issues/{number}/parent")

    return issue


def check_github_pr(repository, number, *, expected_head=None):
    pull = github_json(f"repos/{repository}/pulls/{number}")

    if expected_head is not None and pull["head"]["sha"] != expected_head:
        raise ValueError("Head PR изменился; требуется проверка актуального коммита")

    if dependabot_pr(pull, repository):
        return validate_pull_request(pull, {}, repository)

    parts = sections(pull.get("body"), ("Задача",))
    references = re.findall(r"/issues/([1-9]\d*)", parts["Задача"])

    if len(references) != 1:
        raise ValueError("В PR нужна ровно одна основная задача")

    primary = github_issue(repository, int(references[0]))

    validate_pull_request(pull, primary, repository)

    checked_commits = 0

    for page in range(1, 101):
        commits = github_json(f"repos/{repository}/pulls/{number}/commits?per_page=100&page={page}")

        for commit in commits:
            checked_commits += 1
            message = commit["commit"]["message"].strip()

            validate_commit_message(message)

            for reference in set(re.findall(r"Issue #([1-9]\d*)", message)):
                task = github_issue(repository, int(reference))

                validate_issue(task)

                if (
                    task["number"] != primary["number"]
                    and task.get("parent", {}).get("number") != primary["number"]
                ):
                    raise ValueError(f"Issue #{reference} не входит в основной UC PR")

        if len(commits) < 100:
            break
    else:
        raise ValueError("Слишком большой PR для проверки контракта")

    if checked_commits != pull.get("commits", checked_commits):
        raise ValueError("GitHub вернул неполный список коммитов PR")

    return True


def publish_contract_status(repository, sha, state):
    payload = {
        "state": state,
        "context": "relationships",
        "description": {
            "pending": "Проверяются актуальные связи Issues и PR",
            "success": "Issues, PR, связи и коммиты проверены",
            "failure": "Нарушен контракт: см. workflow GitHub contracts",
        }[state],
        "target_url": f"https://github.com/{repository}/actions/workflows/contracts.yml",
    }

    subprocess.run(
        ["gh", "api", f"repos/{repository}/statuses/{sha}", "--method", "POST", "--input", "-"],
        input=json.dumps(payload),
        text=True,
        check=True,
    )


def check_github_event(repository, event_path, *, publish=False):
    event = json.loads(event_path.read_text())
    failures = []

    if event.get("issue"):
        try:
            validate_issue(github_issue(repository, event["issue"]["number"]))
        except ValueError as exc:
            failures.append(f"Issue #{event['issue']['number']}: {exc}")

    pulls = []
    audit_number = event.get("inputs", {}).get("pull_request", "")

    if audit_number and not re.fullmatch(r"[1-9]\d*", str(audit_number)):
        raise ValueError("Для аудита укажите положительный номер PR")

    if audit_number:
        pulls = [github_json(f"repos/{repository}/pulls/{audit_number}")]
    elif event.get("pull_request"):
        pulls = [github_json(f"repos/{repository}/pulls/{event['number']}")]
    else:
        for page in range(1, 101):
            batch = github_json(f"repos/{repository}/pulls?state=open&per_page=100&page={page}")

            pulls.extend(batch)

            if len(batch) < 100:
                break

    for pull in pulls:
        if pull["state"] != "open" and not audit_number:
            continue

        error = None

        if publish:
            publish_contract_status(repository, pull["head"]["sha"], "pending")

        try:
            check_github_pr(repository, pull["number"], expected_head=pull["head"]["sha"])
        except (ValueError, subprocess.CalledProcessError) as exc:
            error = str(exc)

            failures.append(f"PR #{pull['number']}: {error}")

        current = github_json(f"repos/{repository}/pulls/{pull['number']}")

        if current["head"]["sha"] != pull["head"]["sha"]:
            raise ValueError("Head PR изменился во время проверки; результат не опубликован")

        if publish:
            publish_contract_status(
                repository, pull["head"]["sha"], "failure" if error else "success"
            )

    if failures:
        raise ValueError("\n".join(failures))

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

    github = modes.add_parser(
        "github", help="Проверить актуальный контракт Issue или PR через GitHub API."
    )

    github.add_argument("kind", choices=("issue", "pr"))
    github.add_argument("number", type=int)
    github.add_argument("--repository", required=True)
    github.add_argument("--head", help="Ожидаемый SHA, чтобы не принять устаревшую проверку")

    events = modes.add_parser(
        "github-event",
        help="Проверить событие и связи PR; публикация из доверенного workflow.",
    )

    events.add_argument("path", type=Path)
    events.add_argument("--repository", required=True)
    events.add_argument("--publish", action="store_true")

    modes.add_parser("locate", help="Найти источник UC/BR по ID.").add_argument("ids", nargs="+")

    modes.add_parser("rule", help="Выполнить проверки выбранных BR.").add_argument("ids", nargs="+")
    modes.add_parser(
        "changed", help="Проверить изменённые области относительно Git ref."
    ).add_argument("--base", default="HEAD")
    modes.add_parser("commit-message", help="Проверить формат сообщения коммита.").add_argument(
        "path", type=Path
    )

    args = parser.parse_args()

    if args.mode == "github-event":
        return check_github_event(args.repository, args.path, publish=args.publish)

    if args.mode == "github":
        if args.kind == "issue":
            return validate_issue(github_issue(args.repository, args.number))

        return check_github_pr(args.repository, args.number, expected_head=args.head)

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
