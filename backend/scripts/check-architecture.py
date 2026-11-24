#!/usr/bin/env python3
"""Проверяет статические импорты между доменными модулями приложения."""

import ast
import sys
from importlib.util import resolve_name
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULES = ROOT / "backend/app/modules"


def imports(node, package):
    if isinstance(node, ast.Import):
        return [item.name for item in node.names]
    if isinstance(node, ast.ImportFrom):
        module = node.module or ""
        if node.level:
            module = resolve_name("." * node.level + module, package)
        return [f"{module}.{item.name}" for item in node.names]
    return []


def violations(source, path):
    owner = path.parts[0]
    package = ".".join(("app", "modules", *path.parts[:-1]))
    for node in ast.walk(ast.parse(source, filename=str(path))):
        for name in imports(node, package):
            parts = name.split(".")
            if parts[:2] != ["app", "modules"] or len(parts) < 3:
                continue
            if parts[2] != owner and parts[3:4] != ["public"]:
                yield node.lineno, name


def main():
    files = [path for path in MODULES.glob("*/**/*.py") if path.is_file()]
    errors = []
    for file in sorted(files):
        for line, name in violations(
            file.read_text(encoding="utf-8"), file.relative_to(MODULES)
        ):
            errors.append(f"{file.relative_to(ROOT)}:{line}: внутренний импорт {name}")
    if errors:
        print("\n".join(errors))
    else:
        print(f"Проверка архитектуры: {len(files)} файлов доменных модулей")
    return bool(errors)


if __name__ == "__main__":
    sys.exit(main())
