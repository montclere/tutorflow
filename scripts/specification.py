"""Поиск распределённых документов требований TutorFlow."""

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODULE_RULE_DOCUMENTS = "docs/modules/*/business-rules.md"
RULE_DOCUMENTS = (MODULE_RULE_DOCUMENTS, "docs/planned-business-rules.md")
CASE_DOCUMENTS = "docs/use-cases/*.md"
RULE_PATTERN = re.compile(
    r"^- (BR-\d{3}) \[([CD])\] \[([a-z0-9_/-]+)\] "
    r"(UC-\d{3}(?:/(?:UC-)?\d{3})*): (\S.*)$",
    re.MULTILINE,
)


def document_paths(root, patterns):
    patterns = (patterns,) if isinstance(patterns, str) else patterns

    return sorted({path for pattern in patterns for path in root.glob(pattern)})


def read_documents(root, pattern):
    paths = document_paths(root, pattern)

    if not paths:
        raise ValueError(f"Не найдены документы {pattern}")

    return "\n\n".join(path.read_text(encoding="utf-8") for path in paths)


def business_rule_ids(root=ROOT):
    return {match[1] for match in RULE_PATTERN.finditer(read_documents(root, RULE_DOCUMENTS))}


def find_requirement(root, identifier):
    if re.fullmatch(r"UC-\d{3}", identifier):
        pattern = CASE_DOCUMENTS
        expression = re.compile(rf"^# {identifier} — .+$", re.MULTILINE)
    elif re.fullmatch(r"BR-\d{3}", identifier):
        pattern = RULE_DOCUMENTS
        expression = re.compile(rf"^- {identifier} \[.+$", re.MULTILINE)
    else:
        raise ValueError(f"Некорректный ID требования: {identifier}")

    matches = []

    for path in document_paths(root, pattern):
        document = path.read_text(encoding="utf-8")

        for match in expression.finditer(document):
            content = document.strip() if identifier.startswith("UC-") else match[0]

            matches.append((path.relative_to(root), content))

    if len(matches) != 1:
        raise ValueError(f"{identifier}: ожидается один источник, найдено {len(matches)}")

    return matches[0]
