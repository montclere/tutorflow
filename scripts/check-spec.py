"""Проверяет шаблоны UC и BR, уникальность ID и ссылки между документами."""

import re
import sys
from pathlib import Path

from specification import (
    CASE_DOCUMENTS,
    MODULE_RULE_DOCUMENTS,
    RULE_DOCUMENTS,
    RULE_PATTERN,
    read_documents,
)


ROOT = Path(__file__).resolve().parents[1]
UC_HEADING = re.compile(r"(UC-\d{3}) — \S.*")
UC_FIELD = re.compile(r"^- ([^:]+):\s+(\S.*)", re.MULTILINE)
UC_FIELDS = {
    "Цель",
    "Основной поток",
    "Варианты",
    "Результат",
    "Требования",
    "Гипотеза ценности",
    "Статус",
}
BR_LINE = RULE_PATTERN
BR_RANGE = re.compile(r"(BR-\d{3})\s*[–—-]\s*(BR-\d{3})")


def check_use_cases(document, issues):
    sections = re.split(r"^# (.+)$", document, flags=re.MULTILINE)
    definitions = {}

    for heading, body in zip(sections[1::2], sections[2::2], strict=True):
        if not heading.startswith("UC-"):
            continue

        match = UC_HEADING.fullmatch(heading)

        if not match:
            issues.append(f"Некорректный заголовок UC: {heading}")

            continue

        identifier = match[1]

        if identifier in definitions:
            issues.append(f"Повторный ID: {identifier}")

        fields = dict(UC_FIELD.findall(body))
        missing = UC_FIELDS - fields.keys()

        if not {"Актор", "Акторы"} & fields.keys():
            missing.add("Актор / Акторы")

        if missing:
            issues.append(f"{identifier}: отсутствуют поля {', '.join(sorted(missing))}")

        requirements = fields.get("Требования", "")
        refs = set(re.findall(r"\bBR-\d{3}\b", requirements))

        if not refs:
            issues.append(f"{identifier}: в требованиях нет ссылок на BR")

        for first, last in BR_RANGE.findall(requirements):
            start, end = int(first[3:]), int(last[3:])

            if start > end:
                issues.append(f"{identifier}: обратный диапазон {first}–{last}")

            refs.update(f"BR-{number:03d}" for number in range(start, end + 1))

        definitions[identifier] = refs

    return definitions


def check_business_rules(document, issues):
    definitions = {}

    for number, line in enumerate(document.splitlines(), 1):
        if not re.match(r"^\s*[-+*]\s+\*{0,2}BR-", line):
            continue

        match = BR_LINE.fullmatch(line)

        if not match:
            issues.append(f"Бизнес-правила, строка {number}: некорректный формат BR")

            continue

        identifier, _, _, references, _ = match.groups()

        if identifier in definitions:
            issues.append(f"Повторный ID: {identifier}")

        definitions[identifier] = {f"UC-{ref.removeprefix('UC-')}" for ref in references.split("/")}

    return definitions


def check_document_locations(root, issues):
    for path in root.glob(CASE_DOCUMENTS):
        identifiers = re.findall(
            r"^# (UC-\d{3}) — ", path.read_text(encoding="utf-8"), re.MULTILINE
        )

        if len(identifiers) != 1 or not path.name.startswith(f"{identifiers[0].lower()}-"):
            issues.append(f"{path.relative_to(root)}: имя файла должно соответствовать одному UC")

    for path in root.glob(MODULE_RULE_DOCUMENTS):
        if not (root / "backend/app/modules" / path.parent.name).is_dir():
            issues.append(f"{path.relative_to(root)}: модуль отсутствует в backend")

        for rule in RULE_PATTERN.finditer(path.read_text(encoding="utf-8")):
            if rule[3].split("/")[0] != path.parent.name:
                issues.append(f"{path.relative_to(root)}: {rule[1]} принадлежит другому модулю")


def main():
    issues = []

    check_document_locations(ROOT, issues)

    cases_doc = read_documents(ROOT, CASE_DOCUMENTS)
    rules_doc = read_documents(ROOT, RULE_DOCUMENTS)
    cases = check_use_cases(cases_doc, issues)
    rules = check_business_rules(rules_doc, issues)
    documents = [(cases, rules, "UC", cases_doc, "BR"), (rules, cases, "BR", rules_doc, "UC")]

    for definitions, targets, kind, document, target_kind in documents:
        if not definitions:
            issues.append(f"Не найдены определения {kind}")

        for identifier, refs in definitions.items():
            for ref in sorted(refs - targets.keys()):
                issues.append(f"{identifier}: ссылка на отсутствующий {ref}")

        declared_refs = set().union(*definitions.values())
        other_refs = set(re.findall(rf"\b{target_kind}-\d{{3}}\b", document)) - declared_refs

        for ref in sorted(other_refs - targets.keys()):
            issues.append(f"Документ {kind}: ссылка на отсутствующий {ref}")

    print(f"Спецификация: {len(cases)} UC, {len(rules)} BR")

    for problem in issues:
        print("ERROR:", problem)

    return bool(issues)


if __name__ == "__main__":
    sys.exit(main())
