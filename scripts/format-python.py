"""Команда проверки и применения Python-оформления TutorFlow."""

import argparse
import subprocess
import tempfile
from pathlib import Path

from python_style import format_source, module_description_error, remove_internal_documentation


ROOT = Path(__file__).resolve().parents[1]
RUFF = ["uv", "run", "--project", str(ROOT / "backend"), "--locked", "ruff"]
CONFIG = str(ROOT / "backend/pyproject.toml")


def python_files():
    return sorted(
        path
        for directory in ("backend", "scripts")
        for path in (ROOT / directory).rglob("*.py")
        if not any(
            part.startswith(".") or part == "__pycache__" for part in path.relative_to(ROOT).parts
        )
    )


def run_ruff(arguments):
    result = subprocess.run(
        [*RUFF, *arguments],
        capture_output=True,
        text=True,
    )

    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)


def canonical_sources(files):
    with tempfile.TemporaryDirectory(prefix="tutorflow-python-style-") as temporary:
        temporary_root = Path(temporary)
        copies = {}

        for path in files:
            target = temporary_root / path.relative_to(ROOT)

            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")

            copies[path] = target

        run_ruff(["check", "--config", CONFIG, "--select", "I", "--fix", str(temporary_root)])
        run_ruff(["format", "--config", CONFIG, str(temporary_root)])

        for copy in copies.values():
            copy.write_text(
                remove_internal_documentation(copy.read_text(encoding="utf-8")), encoding="utf-8"
            )

        run_ruff(["format", "--config", CONFIG, str(temporary_root)])

        return {
            original: format_source(copy.read_text(encoding="utf-8"))
            for original, copy in copies.items()
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)

    parser.add_argument("mode", choices=("check", "write"))

    args = parser.parse_args()
    files = python_files()
    invalid = []

    for path in files:
        source = path.read_text(encoding="utf-8")
        description_error = module_description_error(source)

        if description_error:
            invalid.append(f"{path.relative_to(ROOT)}: {description_error}")

    if invalid:
        print("\n".join(invalid))

        return 1

    formatted = canonical_sources(files)
    changed = [path for path in files if path.read_text(encoding="utf-8") != formatted[path]]

    if args.mode == "write":
        for path in changed:
            path.write_text(formatted[path], encoding="utf-8")

        print(f"Python-оформление: обновлено {len(changed)} файлов")

        return 0

    for path in changed:
        print(f"{path.relative_to(ROOT)}: требуется форматирование")

    print(f"Python-оформление: проверено {len(files)} файлов, требуется обновить {len(changed)}")

    return bool(changed)


if __name__ == "__main__":
    raise SystemExit(main())
