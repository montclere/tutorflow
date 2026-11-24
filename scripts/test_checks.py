import unittest
from unittest.mock import patch

import check


class RuleCheckTest(unittest.TestCase):
    def test_missing_mapping_is_an_error(self):
        with (
            patch.object(check, "load_json", return_value={"rules": {}}),
            self.assertRaisesRegex(ValueError, "BR-005"),
        ):
            check.target(["BR-005"], {})

    def test_each_mapping_is_checked_with_its_own_marker(self):
        node = "tests/test_example.py::test_example"
        rule_map = {"rules": {"BR-001": [node], "BR-005": [node]}}
        with (
            patch.object(check, "load_json", return_value=rule_map),
            patch.object(check, "run", side_effect=[True, False]) as run,
        ):
            self.assertFalse(
                check.target(["BR-001", "BR-005"], {"targeted": ["pytest"]})
            )
        self.assertEqual(
            [call.args[0] for call in run.call_args_list],
            [["pytest", "-m", "br_001", node], ["pytest", "-m", "br_005", node]],
        )
