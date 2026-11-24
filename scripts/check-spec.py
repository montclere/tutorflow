#!/usr/bin/env python3
"""Минимальная проверка согласованности BR/UC ссылок (не валидатор семантики)."""

import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
uc = (root / "docs/use-cases.md").read_text(encoding="utf-8")
br = (root / "docs/business-rules.md").read_text(encoding="utf-8")
uc_defs = re.findall(r"^## (UC-\d+)\b", uc, re.MULTILINE)
br_defs = re.findall(r"^- \*\*(BR-\d+)\b", br, re.MULTILINE)
issues = []
for kind, ids in [("UC", uc_defs), ("BR", br_defs)]:
    if len(ids) != len(set(ids)):
        issues.append(f"{kind}: duplicate identifiers")
    if not ids:
        issues.append(f"{kind}: no definitions")
for ref in set(re.findall(r"UC-\d+", br)) - set(uc_defs):
    issues.append(f"BR refers to missing {ref}")
for ref in set(re.findall(r"BR-\d+", uc)) - set(br_defs):
    issues.append(f"UC refers to missing {ref}")
print(f"Spec links: {len(uc_defs)} use cases, {len(br_defs)} business rules")
for problem in issues:
    print("ERROR:", problem)
sys.exit(1 if issues else 0)
