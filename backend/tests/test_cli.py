"""Проверки вызова CLI из другой папки и передачи ошибок модульных проверок."""

import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


def test_cli_help_works_outside_repository(tmp_path: Path):
    result = subprocess.run(
        ["bash", str(ROOT / "scripts/dev.sh"), "help"],
        cwd=tmp_path,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0
    assert "setup|check|help" in result.stdout


def test_cli_rejects_unknown_command(tmp_path: Path):
    result = subprocess.run(
        ["bash", str(ROOT / "scripts/dev.sh"), "unknown"],
        cwd=tmp_path,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 2
    assert "Unknown command: unknown" in result.stderr


@pytest.mark.parametrize("exit_code", [0, 23])
def test_cli_runs_module_from_repository_root_and_propagates_failure(
    tmp_path: Path, exit_code: int
):
    repository = tmp_path / "repo"
    (repository / "scripts").mkdir(parents=True)
    (repository / "backend/scripts").mkdir(parents=True)
    shutil.copyfile(ROOT / "scripts/dev.sh", repository / "scripts/dev.sh")
    (repository / "scripts/check.py").write_text("")
    (repository / "backend/scripts/check.sh").write_text(
        f"pwd > check-directory.txt\nexit {exit_code}\n"
    )
    result = subprocess.run(
        ["bash", str(repository / "scripts/dev.sh"), "check"],
        cwd=tmp_path,
        capture_output=True,
        text=True,
    )
    assert result.returncode == exit_code
    assert (repository / "check-directory.txt").read_text().strip() == str(repository)
