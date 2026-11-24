"""Проверяет границы модулей, направление зависимостей и docstring."""

import ast
import sys
from importlib.util import resolve_name
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "backend/app"
MODULES = APP / "modules"
SHARED = APP / "shared"
BLOCKING_IMPORTS = {
    "sqlalchemy.create_engine",
    "sqlalchemy.orm.Session",
    "sqlalchemy.orm.sessionmaker",
    "smtplib",
    "http.client",
    "requests",
}


def imports(node, package):
    if isinstance(node, ast.Import):
        return [item.name for item in node.names]

    if isinstance(node, ast.ImportFrom):
        module = node.module or ""

        if node.level:
            module = resolve_name("." * node.level + module, package)

        return [f"{module}.{item.name}" for item in node.names]

    return []


def is_forbidden(name, owner, layer):
    if any(name == blocked or name.startswith(f"{blocked}.") for blocked in BLOCKING_IMPORTS):
        return True

    parts = name.split(".")
    module_import = parts[:2] == ["app", "modules"] and len(parts) >= 3
    local_module = module_import and parts[2] == owner
    target = parts[3:4]

    if module_import and not local_module and target != ["public"]:
        return True

    if layer == "domain":
        return parts[0] not in sys.stdlib_module_names and not (
            local_module and target == ["domain"]
        )

    if layer in ("application", "public"):
        if parts[0] not in sys.stdlib_module_names and parts[0] != "app":
            return True

        allowed_layers = (["domain"], ["public"])

        if layer == "application":
            allowed_layers += (["application"],)

        if local_module and target not in allowed_layers:
            return True

        if parts[0] == "app" and not module_import:
            return True

    if layer in ("presentation", "infrastructure") and parts[0] == "app" and not module_import:
        return parts[:3] != ["app", "shared", layer]

    if layer == "infrastructure" and local_module and target == ["presentation"]:
        return True

    return layer == "presentation" and local_module and target == ["infrastructure"]


def violations(source, path, *, area="modules"):
    owner = path.parts[0]
    layer = path.parts[1].removesuffix(".py") if len(path.parts) > 1 else ""
    package = ".".join(("app", area, *path.parts[:-1]))

    for node in ast.walk(ast.parse(source, filename=str(path))):
        for name in imports(node, package):
            if area == "shared":
                parts = name.split(".")

                if parts[0] == "app" and parts[:3] != ["app", "shared", owner]:
                    yield node.lineno, name
            elif is_forbidden(name, owner, layer):
                yield node.lineno, name


def blocking_handlers(source):
    for node in ast.walk(ast.parse(source)):
        if not isinstance(node, ast.FunctionDef):
            continue

        for decorator in node.decorator_list:
            if (
                isinstance(decorator, ast.Call)
                and isinstance(decorator.func, ast.Attribute)
                and decorator.func.attr
                in {"get", "post", "put", "patch", "delete", "head", "options"}
                and isinstance(decorator.func.value, ast.Name)
                and decorator.func.value.id in {"router", "app", "application"}
            ):
                yield node.lineno, node.name


def main():
    files = sorted(APP.rglob("*.py"))
    errors = []

    for file in files:
        label = file.relative_to(ROOT)
        source = file.read_text(encoding="utf-8")

        for line, name in blocking_handlers(source):
            errors.append(f"{label}:{line}: HTTP-обработчик {name} должен быть async")

        if not ast.get_docstring(ast.parse(source, filename=str(file))):
            errors.append(f"{label}: нужен модульный docstring")

        if file.is_relative_to(MODULES):
            for line, name in violations(source, file.relative_to(MODULES)):
                errors.append(f"{label}:{line}: недопустимый импорт {name}")

        if file.is_relative_to(SHARED):
            for line, name in violations(source, file.relative_to(SHARED), area="shared"):
                errors.append(f"{label}:{line}: недопустимый импорт {name}")

    if errors:
        print("\n".join(errors))
    else:
        print(f"Проверка архитектуры: {len(files)} файлов приложения")

    return bool(errors)


if __name__ == "__main__":
    sys.exit(main())
