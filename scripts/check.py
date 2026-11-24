#!/usr/bin/env python3
"""Запускает проверки TutorFlow из любой папки и сохраняет вывод в логах."""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from tempfile import NamedTemporaryFile

ROOT = Path(__file__).resolve().parents[1]
LOG_DIR = ROOT / ".artifacts/logs"


def run(command, label):
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(
        prefix=f"{label}-", suffix=".log", dir=LOG_DIR, delete=False
    ) as log:
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
    print(
        "\n".join(path.read_text(encoding="utf-8", errors="replace").splitlines()[-35:])
    )
    return False


def spec():
    return run([sys.executable, "scripts/check-spec.py"], "spec")


def architecture():
    return run(
        [sys.executable, "backend/scripts/check-architecture.py"], "architecture"
    )


def load_json(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def target(ids, config):
    doc = (ROOT / "docs/business-rules.md").read_text(encoding="utf-8")
    known = set(re.findall(r"^- \*\*(BR-\d+)\b", doc, re.MULTILINE))
    rules = load_json("backend/tests/rule-map.json")["rules"]
    for identifier in ids:
        if identifier not in known:
            raise ValueError(f"Неизвестный BR-ID: {identifier}")
        nodes = rules.get(identifier)
        if (
            not isinstance(nodes, list)
            or not nodes
            or not all(
                isinstance(node, str) and re.fullmatch(r"tests/[^\s:]+\.py::.+", node)
                for node in nodes
            )
        ):
            raise ValueError(
                f"{identifier}: отсутствуют корректные pytest node ID в backend/tests/rule-map.json"
            )
    results = []
    for identifier in ids:
        marker = identifier.lower().replace("-", "_")
        for index, node in enumerate(rules[identifier], 1):
            command = [*config["targeted"], "-m", marker, node]
            results.append(run(command, f"rule-{identifier}-{index}"))
    return all(results)


def changed_areas(base, areas):
    paths = set()
    for command in (
        ["diff", "--name-only", "--no-renames", "-z", base, "--"],
        ["ls-files", "--others", "--exclude-standard", "-z"],
    ):
        output = subprocess.check_output(["git", *command], cwd=ROOT)
        paths.update(
            path for path in output.decode(errors="surrogateescape").split("\0") if path
        )
    if any(not path.startswith(tuple(name + "/" for name in areas)) for path in paths):
        return areas
    return [
        name for name in areas if any(path.startswith(name + "/") for path in paths)
    ]


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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_subparsers(dest="mode", required=True)
    for name in ("spec", "architecture", "pr", "all", "ci"):
        modes.add_parser(name)
    modes.add_parser("rule").add_argument("ids", nargs="+")
    modes.add_parser("changed").add_argument("--base", default="HEAD")
    args = parser.parse_args()

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
    checks = (spec(), architecture(), configured_checks(config, areas, stage))
    return all(checks)


if __name__ == "__main__":
    try:
        sys.exit(0 if main() else 1)
    except (KeyError, OSError, ValueError, subprocess.CalledProcessError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(2)
