"""Проверки изоляции модулей и направления зависимостей слоёв."""

import ast
import sys
from importlib.util import resolve_name
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[1] / "app"
LAYERS = {
    "domain": {"domain"},
    "application": {"domain", "application"},
    "infrastructure": {"domain", "application", "infrastructure"},
    "presentation": {"domain", "application", "infrastructure", "presentation"},
}


def imported_names(source: str, package: str) -> list[str]:
    names = []
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            names.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            module = "." * node.level + (node.module or "")
            if node.level:
                module = resolve_name(module, package)
            names.append(module)
            names.extend(f"{module}.{alias.name}" for alias in node.names)
    return names


def violations(source: str, module: str) -> list[str]:
    parts = module.split(".")
    errors = []
    for imported in imported_names(source, module.rsplit(".", 1)[0]):
        target = imported.split(".")
        if parts[:2] == ["app", "shared"] and target[:2] == ["app", "modules"]:
            errors.append(f"shared импортирует модуль: {imported}")
        if parts[:2] == ["app", "modules"] and target[:2] == ["app", "modules"]:
            if len(target) > 2 and target[2] != parts[2]:
                errors.append(f"прямой импорт соседнего модуля: {imported}")

        layer_index = 3 if parts[:2] == ["app", "modules"] else 2
        layer = parts[layer_index] if len(parts) > layer_index else ""
        if layer not in LAYERS:
            continue
        if target[0] != "app":
            if layer in {"domain", "application"} and target[0] not in sys.stdlib_module_names:
                errors.append(f"внешняя зависимость в {layer}: {imported}")
            continue

        if target[:2] == ["app", "shared"]:
            target_layer = target[2] if len(target) > 2 else ""
        elif target[:3] == parts[:3] and parts[:2] == ["app", "modules"]:
            target_layer = target[3] if len(target) > 3 else ""
        else:
            target_layer = ""
        if target_layer not in LAYERS[layer]:
            errors.append(f"недопустимое направление зависимости из {layer}: {imported}")
    return errors


def test_application_imports_respect_architecture():
    errors = []
    for path in sorted(APP.rglob("*.py")):
        module = ".".join(path.relative_to(APP.parent).with_suffix("").parts)
        errors.extend(
            f"{path.relative_to(APP)}: {error}" for error in violations(path.read_text(), module)
        )
    assert not errors, "\n".join(errors)


@pytest.mark.parametrize(
    ("module", "source"),
    [
        ("app.modules.students.domain.student", "import sqlalchemy"),
        ("app.modules.students.application.students", "import fastapi"),
        ("app.modules.students.domain.student", "from ..infrastructure import models"),
        ("app.modules.students.application.students", "import app.config"),
        ("app.modules.students.presentation.api.router", "import app.modules.billing.router"),
        ("app.shared.infrastructure.db.engine", "from app import modules"),
        ("app.shared.domain.errors", "from app.shared.infrastructure import db"),
    ],
)
def test_architecture_rejects_forbidden_imports(module: str, source: str):
    assert violations(source, module)


@pytest.mark.parametrize(
    ("module", "source"),
    [
        ("app.modules.students.domain.student", "from dataclasses import dataclass"),
        ("app.modules.students.application.students", "from ..domain.student import Student"),
        (
            "app.modules.students.application.students",
            "from app.shared.application.contracts import accounts",
        ),
        (
            "app.modules.students.infrastructure.persistence.models",
            "from app.modules.students.domain.student import Student",
        ),
        ("app.composition", "import app.modules.students.infrastructure.persistence.models"),
    ],
)
def test_architecture_accepts_dependencies_toward_domain(module: str, source: str):
    assert not violations(source, module)
