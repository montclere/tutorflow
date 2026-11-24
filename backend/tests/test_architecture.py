import runpy
import unittest
from pathlib import Path

architecture = runpy.run_path(
    str(Path(__file__).resolve().parents[1] / "scripts/check-architecture.py")
)


class ArchitectureTest(unittest.TestCase):
    def test_rejects_absolute_and_relative_internal_imports(self):
        source = (
            "import app.modules.identity.domain\n"
            "from ..identity import repository\n"
            "from app.modules.identity.public import AccountId\n"
            "from .domain import Card\n"
        )
        violations = list(
            architecture["violations"](source, Path("students/service.py"))
        )
        self.assertEqual(
            violations,
            [
                (1, "app.modules.identity.domain"),
                (2, "app.modules.identity.repository"),
            ],
        )
