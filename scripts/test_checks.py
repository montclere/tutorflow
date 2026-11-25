"""Регрессии команд проверок проекта."""

import unittest
from unittest.mock import patch

import check


class GitHubContractTest(unittest.TestCase):
    def setUp(self):
        self.repository = "tutor-flow-org/tutorflow"
        self.issue = {
            "number": 12,
            "title": "Настроить процесс",
            "body": (
                "## Результат\n\nПроцесс настроен.\n\n## Критерии приёмки\n\n- Проверки проходят."
            ),
        }
        self.pull = {
            "number": 13,
            "title": self.issue["title"],
            "head": {"ref": "configure/tooling/issue-12", "sha": "a" * 40},
            "base": {"ref": "dev"},
            "body": (
                f"## Задача\n\n[Issue #12](https://github.com/{self.repository}/issues/12)\n\n"
                "## Результат\n\nПроцесс настроен.\n\n- Добавлены проверки.\n\n"
                "## Проверки\n\n- [x] Авторское ревью проведено."
            ),
        }

    def test_valid_task_and_pr(self):
        self.assertTrue(check.validate_issue(self.issue))
        self.assertTrue(check.validate_pull_request(self.pull, self.issue, self.repository))

    def test_missing_fields_placeholders_and_wrong_requirement(self):
        for issue in (
            self.issue | {"body": ""},
            self.issue
            | {"body": "## Результат\n_No response_\n## Критерии приёмки\n<!-- TODO -->"},
            self.issue | {"title": "[UC-999] Отсутствует"},
        ):
            with self.subTest(issue=issue), self.assertRaises(ValueError):
                check.validate_issue(issue)

    def test_wrong_issue_url_title_branch_base_and_unfinished_checks(self):
        for pull in (
            self.pull | {"title": "Произвольное название"},
            self.pull | {"body": self.pull["body"].replace("/issues/12", "/issues/11")},
            self.pull | {"body": self.pull["body"].replace(self.repository, "other/repo")},
            self.pull | {"head": {"ref": "configure/tooling/issue-15"}},
            self.pull | {"base": {"ref": "main"}},
            self.pull | {"body": self.pull["body"].replace("[x]", "[ ]")},
        ):
            with self.subTest(pull=pull), self.assertRaises(ValueError):
                check.validate_pull_request(pull, self.issue, self.repository)

    def test_br_requires_native_parent_and_matching_uc(self):
        rule = self.issue | {"title": "[BR-001] identity — Вход"}

        with self.assertRaisesRegex(ValueError, "Sub-issues"):
            check.validate_issue(rule)

        parent = self.issue | {"title": "[UC-001] Преподаватель начинает работу"}

        self.assertTrue(check.validate_issue(rule | {"parent": parent}))

        with self.assertRaises(ValueError):
            check.validate_issue(
                rule | {"parent": parent | {"title": "[UC-002] Ошибочный родитель"}}
            )

    def test_bot_route_requires_real_identity_and_same_repository(self):
        bot = self.pull | {
            "title": "Bump dependencies",
            "user": {"login": "dependabot[bot]", "id": 49699333, "type": "Bot"},
            "head": {"ref": "dependabot/uv/backend/all", "repo": {"full_name": self.repository}},
        }

        self.assertTrue(check.validate_pull_request(bot, {}, self.repository))

        for pull in (
            bot | {"user": bot["user"] | {"id": 123}},
            bot | {"user": bot["user"] | {"type": "User"}},
            bot | {"head": bot["head"] | {"repo": {"full_name": "fork/repo"}}},
        ):
            with self.subTest(pull=pull):
                self.assertFalse(check.dependabot_pr(pull, self.repository))

    def test_new_head_rejects_stale_result(self):
        with (
            patch.object(check, "github_json", return_value=self.pull),
            self.assertRaisesRegex(ValueError, "Head PR"),
        ):
            check.check_github_pr(self.repository, 13, expected_head="b" * 40)

    def test_commit_cannot_reference_unrelated_issue(self):
        commit = {"commit": {"message": "configure(tooling): настройка (Issue #15)"}}

        with (
            patch.object(check, "github_json", side_effect=[self.pull, [commit]]),
            patch.object(
                check, "github_issue", side_effect=[self.issue, self.issue | {"number": 15}]
            ),
            self.assertRaisesRegex(ValueError, "не входит"),
        ):
            check.check_github_pr(self.repository, 13)


class RuleCheckTest(unittest.TestCase):
    def test_missing_mapping_is_an_error(self):
        with (
            patch.object(check, "load_json", return_value={"rules": {}}),
            self.assertRaisesRegex(ValueError, "BR-005"),
        ):
            check.target(["BR-005"], {})

    def test_each_mapping_is_checked_with_its_own_marker(self):
        node = "tests/test_example.py::test_example"
        rule_map = {"rules": {"BR-001": {"pytest": [node]}, "BR-005": {"pytest": [node]}}}

        with (
            patch.object(check, "load_json", return_value=rule_map),
            patch.object(check, "run", side_effect=[True, False]) as run,
        ):
            self.assertFalse(
                check.target(["BR-001", "BR-005"], {"targeted": {"pytest": ["pytest"]}})
            )

        self.assertEqual(
            [call.args[0] for call in run.call_args_list],
            [["pytest", "-m", "br_001", node], ["pytest", "-m", "br_005", node]],
        )

    def test_browser_rule_builds_frontend_and_runs_only_the_tagged_scenario(self):
        rule_map = {"rules": {"BR-003": {"playwright": ["workspace.spec.ts"]}}}

        with (
            patch.object(check, "load_json", return_value=rule_map),
            patch.object(check, "run", return_value=True) as run,
        ):
            self.assertTrue(check.target(["BR-003"], {"targeted": {"playwright": ["pw"]}}))

        self.assertEqual(
            [call.args[0] for call in run.call_args_list],
            [
                ["npm", "--prefix", "frontend", "run", "build"],
                ["pw", "--grep", r"@BR-003(?:\s|$)", "workspace.spec.ts"],
            ],
        )


class SpecificationLayoutTest(unittest.TestCase):
    def test_rules_and_cases_are_loaded_from_all_modules(self):
        import tempfile
        from pathlib import Path

        from specification import CASE_DOCUMENTS, business_rule_ids, read_documents


        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            identity = root / "docs/modules/identity/business-rules.md"
            scheduling = root / "docs/modules/scheduling/business-rules.md"
            case = root / "docs/use-cases/uc-001-start.md"
            template = root / "docs/templates/business-rules.md"

            for path in (identity, scheduling, case, template):
                path.parent.mkdir(parents=True, exist_ok=True)

            identity.write_text("# Identity\n\n- BR-001 [C] [identity] UC-001: Вход.\n")
            scheduling.write_text("# Scheduling\n\n- BR-004 [C] [scheduling] UC-001: Блок.\n")
            case.write_text("# UC-001 — Начать\n\n- Цель: начать работу.\n")
            template.write_text("- BR-999 [C] [пример] UC-001: Шаблон.\n")
            self.assertEqual(business_rule_ids(root), {"BR-001", "BR-004"})
            self.assertIn("Цель: начать работу.", read_documents(root, CASE_DOCUMENTS))

    def test_planned_rules_are_searchable_without_creating_backend_modules(self):
        import runpy
        import tempfile
        from pathlib import Path

        from specification import business_rule_ids, find_requirement


        validator = runpy.run_path(str(Path(__file__).with_name("check-spec.py")))

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            document = root / "docs/planned-business-rules.md"

            document.parent.mkdir(parents=True)
            document.write_text(
                "# Будущие требования\n\n- BR-005 [C] [students] UC-002: Карточка.\n"
            )

            self.assertEqual(business_rule_ids(root), {"BR-005"})
            self.assertEqual(find_requirement(root, "BR-005")[0], document.relative_to(root))

            issues = []

            validator["check_document_locations"](root, issues)
            self.assertEqual(issues, [])

    def test_module_documents_require_an_existing_backend_module(self):
        import runpy
        import tempfile
        from pathlib import Path


        validator = runpy.run_path(str(Path(__file__).with_name("check-spec.py")))

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            document = root / "docs/modules/students/business-rules.md"

            document.parent.mkdir(parents=True)
            document.write_text("- BR-005 [C] [students] UC-002: Карточка.\n")

            issues = []

            validator["check_document_locations"](root, issues)

            self.assertTrue(any("students" in issue and "backend" in issue for issue in issues))

    def test_github_renderer_reads_moved_documents(self):
        import runpy
        from pathlib import Path


        renderer = runpy.run_path(str(Path(__file__).with_name("render-github.py")))
        case = renderer["issue"]("uc", {"id": "UC-001", "acceptance": ["Кабинет доступен."]})
        rule = renderer["issue"](
            "br", {"id": "BR-001", "title": "Вход", "acceptance": ["Контакт подтверждён."]}
        )

        self.assertIn("Преподаватель начинает работу", case["title"])
        self.assertIn("Кабинет доступен.", case["body"])
        self.assertIn("Преподаватель подтверждает email", rule["body"])
        self.assertEqual(rule["title"], "[BR-001] identity — Вход")

    def test_validator_rejects_duplicate_ids(self):
        import runpy
        from pathlib import Path


        validator = runpy.run_path(str(Path(__file__).with_name("check-spec.py")))
        issues = []
        rules = validator["check_business_rules"](
            "- BR-001 [C] [identity] UC-999: Вход.\n- BR-001 [C] [identity] UC-001: Повтор.\n",
            issues,
        )

        self.assertIn("Повторный ID: BR-001", issues)
        self.assertEqual(set(rules), {"BR-001"})

    def test_validator_reports_missing_rules_in_a_scenario(self):
        import runpy
        from pathlib import Path


        validator = runpy.run_path(str(Path(__file__).with_name("check-spec.py")))
        validate = validator["main"]
        case = (
            "# UC-001 — Начало\n"
            "- Актор: преподаватель.\n"
            "- Цель: начать.\n"
            "- Основной поток: войти.\n"
            "- Варианты: отказ.\n"
            "- Результат: кабинет.\n"
            "- Требования: BR-999.\n"
            "- Гипотеза ценности: начало работы.\n"
            "- Статус: С.\n"
        )

        with (
            patch.dict(
                validate.__globals__,
                read_documents=lambda root, pattern: (
                    case if "use-cases" in pattern else "- BR-001 [C] [identity] UC-001: Вход.\n"
                ),
            ),
            patch("builtins.print") as output,
        ):
            self.assertTrue(validate())

        self.assertIn(
            "UC-001: ссылка на отсутствующий BR-999",
            " ".join(str(call.args) for call in output.call_args_list),
        )


class RequirementLookupTest(unittest.TestCase):
    def test_lookup_returns_only_selected_rule(self):
        from specification import ROOT, find_requirement


        path, content = find_requirement(ROOT, "BR-001")

        self.assertEqual(path.parent.name, "identity")
        self.assertTrue(content.startswith("- BR-001 "))
        self.assertNotIn("BR-075", content)

    def test_missing_or_duplicate_requirement_is_an_error(self):
        import tempfile
        from pathlib import Path

        from specification import find_requirement


        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            document = root / "docs/modules/identity/business-rules.md"

            document.parent.mkdir(parents=True)
            document.write_text(
                "- BR-001 [C] [identity] UC-001: Вход.\n- BR-001 [C] [identity] UC-001: Повтор.\n"
            )

            for identifier in ("BR-001", "BR-999", "../data"):
                with self.assertRaises(ValueError):
                    find_requirement(root, identifier)


class CommitMessageTest(unittest.TestCase):
    def test_accepts_english_action_and_scope_with_russian_description(self):
        import tempfile
        from pathlib import Path


        messages = (
            "add(identity): регистрация и вход (Issue #5, Issue #6)",
            "configure(tooling): правила работы (Issue #4)",
            "Merge PR #11: кабинет преподавателя\n\nhttps://github.com/montclere/tutorflow/pull/11",
        )

        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "message"

            for message in messages:
                with self.subTest(message=message):
                    path.write_text(message)
                    self.assertTrue(check.check_commit_message(path))

    def test_rejects_russian_action_or_scope_and_missing_explicit_references(self):
        import tempfile
        from pathlib import Path


        messages = (
            "Добавить(аккаунты): регистрация (Issue #5)",
            "Добавить(accounts): регистрация (Issue #5)",
            "add(аккаунты): регистрация (Issue #5)",
            "add(identity): registration (Issue #5)",
            "add(identity): регистрация (#5)",
            "add(identity): регистрация",
        )

        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "message"

            for message in messages:
                with self.subTest(message=message), self.assertRaises(ValueError):
                    path.write_text(message)
                    check.check_commit_message(path)


class GitPolicyTest(unittest.TestCase):
    def test_rejects_unknown_actions_areas_and_merge_link_mismatch(self):
        import tempfile
        from pathlib import Path


        messages = (
            "invent(identity): регистрация (Issue #6)",
            "add(random): регистрация (Issue #6)",
            "add(identity): регистрация (PR #11)",
            "Merge PR #11: кабинет\n\nhttps://github.com/montclere/tutorflow/pull/12",
            "Merge PR #11: кабинет",
        )

        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "message"

            for message in messages:
                with self.subTest(message=message), self.assertRaises(ValueError):
                    path.write_text(message)
                    check.check_commit_message(path)

    def test_accepts_deterministic_branch_names(self):
        for name in ("add/uc-001", "fix/identity/issue-15", "configure/tooling/issue-12"):
            with self.subTest(name=name):
                self.assertTrue(check.check_branch_name(name))

    def test_rejects_random_branch_names_and_unknown_vocabulary(self):
        for name in (
            "codex/task",
            "add/uc-000",
            "fix/identity/issue-0",
            "invent/uc-001",
            "fix/random/issue-15",
            "add/uc-001-description",
        ):
            with self.subTest(name=name), self.assertRaises(ValueError):
                check.check_branch_name(name)

    def test_legacy_branch_is_allowed_only_for_its_existing_pr(self):
        name = "implement/uc-001-teacher-workspace"

        policy = check.git_policy() | {"legacy_branches": {name: 11}}

        with patch.object(check, "git_policy", return_value=policy):
            self.assertTrue(check.check_branch_name(name, pull_request=11))

        for number in (None, 11, 12):
            with self.subTest(number=number), self.assertRaises(ValueError):
                check.check_branch_name(name, pull_request=number)

    def test_renderer_generates_branch_and_merge_message(self):
        import runpy
        from pathlib import Path


        renderer = runpy.run_path(str(Path(__file__).with_name("render-github.py")))

        self.assertEqual(
            renderer["branch_name"]({"action": "add", "uc": "UC-001"}), {"branch": "add/uc-001"}
        )
        self.assertEqual(
            renderer["branch_name"]({"action": "fix", "area": "identity", "issue": 15}),
            {"branch": "fix/identity/issue-15"},
        )
        self.assertEqual(
            renderer["merge_message"](
                {
                    "number": 11,
                    "title": "UC-001: Преподаватель начинает работу",
                    "url": "https://github.com/montclere/tutorflow/pull/11",
                }
            ),
            {
                "title": "Merge PR #11: Преподаватель начинает работу",
                "body": "https://github.com/montclere/tutorflow/pull/11",
            },
        )

    def test_uc_pr_title_comes_from_the_scenario(self):
        import runpy
        from pathlib import Path


        renderer = runpy.run_path(str(Path(__file__).with_name("render-github.py")))
        render = renderer["pull_request"]
        primary = {
            "number": 4,
            "body": "## Результат\n\nКабинет.\n\n## Критерии приёмки\n\n- Вход проверен.",
            "title": "[UC-001] Преподаватель начинает работу",
            "url": "https://github.com/montclere/tutorflow/issues/4",
        }
        data = {"uc": "UC-001", "changes": ["Добавлен кабинет."]}

        with patch.dict(render.__globals__, primary_issue=lambda *args: primary):
            result = render(
                data, "montclere/tutorflow", {"title": "Случайное старое название", "subjects": []}
            )

            self.assertEqual(result["title"], "UC-001: Преподаватель начинает работу")

            with self.assertRaises(ValueError):
                render(data | {"title": "Случайное название"}, "montclere/tutorflow", {})

    def test_commit_range_checks_merge_body_and_rejects_empty_range(self):
        values = ["a" * 40, "b" * 40, "c" * 40]
        message = "Merge PR #11: кабинет\n\nhttps://github.com/montclere/tutorflow/pull/11"

        with patch.object(check.subprocess, "check_output", side_effect=values + [message]):
            self.assertTrue(check.check_commit_range("base", "head"))

        with (
            patch.object(
                check.subprocess,
                "check_output",
                side_effect=values + [message.replace("/pull/11", "/pull/12")],
            ),
            self.assertRaises(ValueError),
        ):
            check.check_commit_range("base", "head")

        with (
            patch.object(check.subprocess, "check_output", side_effect=values[:2] + [""]),
            self.assertRaises(ValueError),
        ):
            check.check_commit_range("base", "head")
