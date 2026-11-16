"""Проверка каркаса, локальных ссылок и синтаксиса shell без зависимостей."""

import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {
    ".git", ".venv", ".worktrees", "node_modules", "dist", "build",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
}


def main():
    errors = []
    for folder in ("backend", "frontend", "docs", "deploy", "scripts", ".agents"):
        for name in ("AGENTS.md", "README.md"):
            if not (ROOT / folder / name).is_file():
                errors.append(f"Отсутствует {folder}/{name}")

    paths = []
    for directory, subdirectories, filenames in os.walk(ROOT):
        subdirectories[:] = [name for name in subdirectories if name not in EXCLUDED]
        paths.extend(Path(directory) / name for name in filenames)

    for module in ("backend", "frontend", "deploy"):
        module_root = ROOT / module
        implementation = [
            path for path in paths
            if module_root in path.parents
            and path.suffix != ".md"
            and path.name not in {".env.example", ".gitkeep"}
        ]
        if implementation and not (module_root / "scripts/check.sh").is_file():
            errors.append(
                f"{module}: появился код или конфигурация; добавь {module}/scripts/check.sh"
            )

    for path in paths:
        if path.suffix == ".md":
            content = path.read_text(encoding="utf-8")
            content = re.sub(r"```.*?```", "", content, flags=re.DOTALL)
            for target in re.findall(r"\[[^\]]*\]\(([^\s)]+)\)", content):
                target = target.strip("<>")
                parsed = urlsplit(target)
                if parsed.scheme or parsed.netloc or not parsed.path:
                    continue
                destination = path.parent / unquote(parsed.path)
                if not destination.exists():
                    errors.append(f"{path.relative_to(ROOT)}: нет цели {target}")

        if path.suffix == ".sh":
            result = subprocess.run(
                ["bash", "-n", str(path)], capture_output=True, text=True,
            )
            if result.returncode:
                errors.append(result.stderr.strip())

    skills = sorted((ROOT / ".agents/skills").glob("*/SKILL.md"))
    if not skills:
        errors.append("Отсутствуют скиллы в .agents/skills")
    for path in skills:
        content = path.read_text(encoding="utf-8")
        frontmatter = re.match(r"\A---\n(.*?)\n---\n", content, re.DOTALL)
        if not frontmatter:
            errors.append(f"{path.relative_to(ROOT)}: нет frontmatter")
            continue
        fields = frontmatter.group(1)
        if not re.search(rf"^name: {re.escape(path.parent.name)}$", fields, re.MULTILINE):
            errors.append(f"{path.relative_to(ROOT)}: неверное имя скилла")
        if not re.search(r"^description: .+", fields, re.MULTILINE):
            errors.append(f"{path.relative_to(ROOT)}: нет описания скилла")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print("OK: каркас, локальные ссылки Markdown, скиллы и синтаксис shell")
    return 0


if __name__ == "__main__":
    sys.exit(main())
