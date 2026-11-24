"""Собирает заголовок и описание GitHub Issue или PR. Выводит JSON без публикации."""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

from check import check_branch_name, validate_commit_message
from specification import CASE_DOCUMENTS, RULE_PATTERN, find_requirement, read_documents


ROOT = Path(__file__).resolve().parents[1]
ISSUE_REF = re.compile(r"\bIssue #([1-9]\d*)\b")


def command(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def gh_json(*args):
    return json.loads(command("gh", *args))


def line(value, name):
    if not isinstance(value, str) or not value.strip() or "\n" in value or "\r" in value:
        raise ValueError(f"{name}: укажите одну непустую строку")

    return value.strip()


def lines(data, name, *, required=False):
    values = data.get(name, [])

    if not isinstance(values, list) or (required and not values):
        raise ValueError(
            f"{name}: укажите список" + (" с хотя бы одним пунктом" if required else "")
        )

    return [line(value, name) for value in values]


def section(title, content):
    return f"## {title}\n\n{content}"


def bullet_list(values, marker="-"):
    return "\n".join(f"{marker} {value}" for value in values)


def use_case(identifier):
    if not re.fullmatch(r"UC-[0-9]{3}", identifier):
        raise ValueError(f"Некорректный UC-ID: {identifier}")

    document = read_documents(ROOT, CASE_DOCUMENTS)
    match = re.search(rf"^# {identifier} — (.+)$", document, re.MULTILINE)

    if not match:
        raise ValueError(f"Не найден пользовательский сценарий {identifier}")

    end = document.find("\n# ", match.end())
    body = document[match.end() :] if end == -1 else document[match.end() : end]
    goal = re.search(r"^- Цель: (.+)$", body, re.MULTILINE)

    if not goal:
        raise ValueError(f"В {identifier} отсутствует цель")

    return match[1], goal[1]


def issue(kind, data):
    identifier = line(data.get("id"), "id")

    if kind == "uc":
        title, default_outcome = use_case(identifier)
    else:
        if not re.fullmatch(r"BR-[0-9]{3}", identifier):
            raise ValueError(f"Некорректный BR-ID: {identifier}")

        _, document = find_requirement(ROOT, identifier)
        rule = RULE_PATTERN.fullmatch(document)

        if not rule:
            raise ValueError(f"Не найдено бизнес-правило {identifier}")

        owner = rule[3].split("/")[0]
        title = f"{owner} — {line(data.get('title'), 'title')}"
        default_outcome = rule[5]

    blocks = [
        section("Результат", line(data.get("outcome", default_outcome), "outcome")),
        section("Критерии приёмки", bullet_list(lines(data, "acceptance", required=True))),
    ]

    for key, heading in [("dependencies", "Зависимости"), ("scope", "Границы")]:
        if values := lines(data, key):
            blocks.append(section(heading, bullet_list(values)))

    return {"title": f"[{identifier}] {title}", "body": "\n\n".join(blocks)}


def pr_context(repository, number, base, head):
    if number is None:
        subjects = command("git", "log", "--reverse", "--format=%s", f"{base}..{head}").splitlines()

        return {
            "issues": list(
                dict.fromkeys(int(i) for subject in subjects for i in ISSUE_REF.findall(subject))
            ),
            "subjects": subjects,
        }

    owner, repo = repository.split("/", 1)
    query = """
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          title
          closingIssuesReferences(first: 100) {
            nodes { number title url parent { number title url } }
          }
        }
      }
    }
    """
    payload = gh_json(
        "api",
        "graphql",
        "-f",
        f"query={query}",
        "-f",
        f"owner={owner}",
        "-f",
        f"repo={repo}",
        "-F",
        f"number={number}",
    )["data"]["repository"]["pullRequest"]

    if payload is None:
        raise ValueError(f"Не найден PR #{number}")

    return {
        "title": payload["title"],
        "tasks": payload["closingIssuesReferences"]["nodes"],
        "issues": [item["number"] for item in payload["closingIssuesReferences"]["nodes"]],
        "subjects": [],
    }


def primary_issue(data, repository, context):
    if "issue" in data:
        number = data["issue"]

        if type(number) is not int or number <= 0:
            raise ValueError("issue: укажите номер родительского или самостоятельного Issue")

        return gh_json(
            "issue", "view", str(number), "--repo", repository, "--json", "number,title,url"
        )

    numbers = data.get("issues", context["issues"])

    if (
        not isinstance(numbers, list)
        or not numbers
        or any(type(number) is not int or number <= 0 for number in numbers)
    ):
        raise ValueError(
            "Укажите родительский Issue в поле issue или свяжите задачи через Development"
        )

    tasks = context.get("tasks", [])

    if set(numbers) != {task["number"] for task in tasks}:
        owner, repo = repository.split("/", 1)
        fields = " ".join(
            f"task{number}: issue(number: {number}) "
            "{ number title url parent { number title url } }"
            for number in sorted(set(numbers))
        )
        query = (
            "query($owner: String!, $repo: String!) "
            f"{{ repository(owner: $owner, name: $repo) {{ {fields} }} }}"
        )
        payload = gh_json(
            "api", "graphql", "-f", f"query={query}", "-f", f"owner={owner}", "-f", f"repo={repo}"
        )
        tasks = list(payload["data"]["repository"].values())

        if any(task is None for task in tasks):
            raise ValueError("Не найдены связанные Issues")

    roots = (task["parent"] or task for task in tasks)
    parents = {root["number"]: root for root in roots}

    if len(parents) != 1:
        raise ValueError("Нужен один Issue на поток. Укажите его номер в поле issue")

    return next(iter(parents.values()))


def pull_request(data, repository, context):
    primary = primary_issue(data, repository, context)
    issue_title = re.sub(r"^\[(UC-[0-9]{3})\]\s*", r"\1 — ", primary["title"])
    issue_title = issue_title.replace("[", r"\[").replace("]", r"\]")
    issue_link = f"[Issue #{primary['number']} — {issue_title}]({primary['url']})"

    uc = data.get("uc")

    if uc is not None:
        identifier = line(uc, "uc")
        name, goal = use_case(identifier)

        if not primary["title"].startswith(f"[{identifier}]"):
            raise ValueError(f"Issue #{primary['number']} должен описывать сценарий {identifier}")

        title = f"{identifier}: {name}"

        if "title" in data and line(data["title"], "title") != title:
            raise ValueError("Заголовок PR для UC берётся из описания сценария")
    else:
        goal = None
        title = line(data.get("title", context.get("title")), "title")

    result = line(data.get("outcome", goal), "outcome")
    changes = lines(data, "changes") or [
        re.sub(r" \(Issue #[1-9]\d*(?:, Issue #[1-9]\d*)*\)$", "", subject)
        for subject in context["subjects"]
    ]

    if not changes:
        raise ValueError("changes: укажите, что изменилось в PR")

    checks = data.get("checks", {})

    if not isinstance(checks, dict):
        raise ValueError("checks: укажите объект с отметками проверок")

    extra = data.get("extra_checks", {})

    if not isinstance(extra, dict) or any(
        type(done) is not bool for done in (checks | extra).values()
    ):
        raise ValueError("Проверки отмечаются значениями true или false")

    checklist = {"Критерии задач проверены.": checks.get("criteria", False)}

    if uc is not None:
        checklist["Сквозной сценарий проверен."] = checks.get("scenario", False)

    checklist["Авторское ревью проведено."] = checks.get("review", False)

    checklist.update({line(key, "extra_checks"): value for key, value in extra.items()})

    blocks = [
        section("Задача", issue_link),
        section("Результат", result + "\n\n" + bullet_list(changes)),
        section(
            "Проверки",
            "\n".join(
                f"- [{'x' if checked else ' '}] {name}" for name, checked in checklist.items()
            ),
        ),
    ]

    return {"title": title, "body": "\n\n".join(blocks)}


def branch_name(data):
    action = line(data.get("action"), "action")

    if "uc" in data:
        if "area" in data or "issue" in data:
            raise ValueError("Для UC укажите только action и uc")

        identifier = line(data["uc"], "uc")

        if not re.fullmatch(r"UC-(?!000)[0-9]{3}", identifier):
            raise ValueError("Некорректный UC-ID")

        name = f"{action}/{identifier.lower()}"
    else:
        area = line(data.get("area"), "area")
        number = data.get("issue")

        if type(number) is not int or number <= 0:
            raise ValueError("issue: укажите положительный номер Issue")

        name = f"{action}/{area}/issue-{number}"

    check_branch_name(name)

    return {"branch": name}


def merge_message(data):
    number = data["number"]

    if type(number) is not int or number <= 0:
        raise ValueError("number: укажите положительный номер PR")

    description = re.sub(r"^UC-[0-9]{3}\s*[:—]\s*", "", line(data["title"], "title"))
    title = f"Merge PR #{number}: {description}"
    body = line(data["url"], "url")

    validate_commit_message(f"{title}\n\n{body}")

    return {"title": title, "body": body}


def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Ветка: action и uc; для других задач action, area и issue.\n"
            "Merge: number; заголовок и ссылка читаются из GitHub.\n"
            "UC: id, acceptance; необязательно outcome, scope.\n"
            "BR: id, title, acceptance; необязательно outcome, dependencies, scope.\n"
            "PR: uc или title, outcome, changes, checks, extra_checks.\n"
            "Родительский Issue определяется по задачам из коммитов или Development.\n"
            "Для явного выбора передайте номер в поле issue.\n"
            "checks принимает criteria, scenario и review с true/false.\n"
            "extra_checks принимает объект «подпись проверки → true/false»."
        ),
    )

    parser.add_argument("kind", choices=("uc", "br", "pr", "branch", "merge"))
    parser.add_argument("input", help="JSON-файл с полями или - для stdin")
    parser.add_argument("--repository", help="Репозиторий GitHub для PR")
    parser.add_argument("--pull-request", type=int, help="Номер существующего PR")
    parser.add_argument("--base", default="origin/dev")
    parser.add_argument("--head", default="HEAD")

    args = parser.parse_args()

    data = json.load(sys.stdin) if args.input == "-" else json.loads(Path(args.input).read_text())

    if not isinstance(data, dict):
        raise ValueError("Ожидается JSON-объект")

    if args.kind == "branch":
        output = branch_name(data)
    elif args.kind == "merge":
        repository = (
            args.repository or gh_json("repo", "view", "--json", "nameWithOwner")["nameWithOwner"]
        )
        number = data.get("number")

        if type(number) is not int or number <= 0:
            raise ValueError("number: укажите положительный номер PR")

        metadata = gh_json(
            "pr", "view", str(number), "--repo", repository, "--json", "number,title,url"
        )
        output = merge_message(metadata)
    elif args.kind == "pr":
        repository = (
            args.repository or gh_json("repo", "view", "--json", "nameWithOwner")["nameWithOwner"]
        )
        context = pr_context(repository, args.pull_request, args.base, args.head)
        output = pull_request(data, repository, context)
    else:
        output = issue(args.kind, data)

    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (KeyError, OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(2)
