"""Регрессии синтаксического форматтера Python."""

import ast
import unittest

from python_style import format_source, module_description_error


class PythonStyleTest(unittest.TestCase):
    def test_separates_blocks_assignments_and_returns(self):
        source = (
            '"""Пример."""\n'
            "def run():\n"
            "    first = 1\n"
            "    second = 2\n"
            "    if first:\n"
            "        second += 1\n"
            "    with resource():\n"
            "        consume(second)\n"
            "    return second\n"
        )
        expected = (
            '"""Пример."""\n\n'
            "def run():\n"
            "    first = 1\n"
            "    second = 2\n\n"
            "    if first:\n"
            "        second += 1\n\n"
            "    with resource():\n"
            "        consume(second)\n\n"
            "    return second\n"
        )

        self.assertEqual(format_source(source), expected)

    def test_imports_and_decorated_definitions_have_two_blank_lines(self):
        source = (
            '"""Пример."""\n\nimport os\nLIMIT = 1\n'
            "@decorate\ndef run():\n    return LIMIT\nclass Example:\n    pass\n"
        )
        formatted = format_source(source)

        self.assertIn("import os\n\n\nLIMIT", formatted)
        self.assertIn("LIMIT = 1\n\n\n@decorate", formatted)
        self.assertIn("return LIMIT\n\n\nclass", formatted)
        self.assertEqual(format_source(formatted), formatted)

    def test_preserves_strings_and_removes_only_documentation(self):
        source = (
            '"""Пример."""\n\n'
            "class Example:\n"
            '    """Докстринг класса."""\n'
            "    def run(self):\n"
            '        """Докстринг метода."""\n'
            '        value = "# не комментарий"  # комментарий\n'
            '        query = """select\n\nvalue"""\n'
            "        return value, query\n"
        )
        formatted = format_source(source)

        self.assertIn('"# не комментарий"', formatted)
        self.assertIn('"""select\n\nvalue"""', formatted)
        self.assertNotIn("Докстринг класса", formatted)
        self.assertNotIn("# комментарий", formatted)
        self.assertEqual(format_source(formatted), formatted)

    def test_docstring_only_class_keeps_valid_body(self):
        formatted = format_source('"""Пример."""\nclass Marker:\n    """Описание."""\n')

        self.assertIn("    pass", formatted)
        ast.parse(formatted)

    def test_module_description_must_be_on_first_line(self):
        for source in ("import os\n", '\n"""Пример."""\n', '"""Две\nстроки."""\n'):
            self.assertIsNotNone(module_description_error(source))

        self.assertIsNone(module_description_error('"""Назначение файла."""\n'))

    def test_preserves_control_flow_and_joins_related_clauses(self):
        source = (
            '"""Пример."""\n'
            "def run(value):\n"
            "    try:\n"
            "        if value:\n"
            "            return value\n"
            "        else:\n"
            "            return None\n"
            "    except ValueError:\n"
            "        raise\n"
            "    finally:\n"
            "        finish()\n"
        )
        formatted = format_source(source)

        self.assertEqual(ast.dump(ast.parse(source)), ast.dump(ast.parse(formatted)))
        self.assertIn("return value\n        else:", formatted)
        self.assertEqual(format_source(formatted), formatted)

    def test_unicode_documentation_does_not_change_indentation(self):
        source = '"""Пример."""\nclass Example:\n    """Описание."""\n    value = 1\n'

        self.assertIn("\n    value = 1\n", format_source(source))

    def test_method_spacing_and_empty_start_are_distinct(self):
        source = (
            '"""Пример."""\n\n\nclass Example:\n'
            "    def first(self):\n        return 1\n"
            "    def second(self):\n        return 2\n"
        )
        formatted = format_source(source)

        self.assertTrue(formatted.startswith('"""Пример."""\n\nclass Example:'))
        self.assertIn("return 1\n\n    def second", formatted)

    def test_complete_pipeline_is_idempotent_and_preserves_behavior(self):
        import runpy
        import tempfile
        from pathlib import Path
        from unittest.mock import patch


        pipeline = runpy.run_path(str(Path(__file__).with_name("format-python.py")))
        canonical_sources = pipeline["canonical_sources"]

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "sample.py"

            source.write_text(
                '"""Пример."""\nimport os\nLIMIT=1\n'
                'class Example:\n    """Описание."""\n'
                '    def run(self):\n        """Описание."""\n'
                '        value = "# строка" # комментарий\n        return value\n'
            )

            with patch.dict(canonical_sources.__globals__, ROOT=root):
                formatted = canonical_sources([source])[source]

                source.write_text(formatted)
                self.assertEqual(canonical_sources([source])[source], formatted)

            namespace = {}

            exec(compile(formatted, str(source), "exec"), namespace)
            self.assertEqual(namespace["Example"]().run(), "# строка")

    def test_match_branches_remain_one_block_and_case_variable_is_preserved(self):
        source = (
            '"""Пример."""\n'
            "def run(value):\n"
            "    case = value\n"
            "    match case:\n"
            "        case 1:\n"
            "            return True\n"
            "        case _:\n"
            "            return False\n"
        )
        formatted = format_source(source)

        self.assertIn("return True\n        case _:", formatted)
        self.assertEqual(ast.dump(ast.parse(source)), ast.dump(ast.parse(formatted)))

    def test_decorated_class_methods_have_exactly_one_empty_line(self):
        source = (
            '"""Пример."""\n'
            "class Example:\n"
            "    def first(self):\n        return 1\n\n\n"
            "    @staticmethod\n    async def second():\n        return 2\n"
        )
        formatted = format_source(source)

        self.assertIn("return 1\n\n    @staticmethod", formatted)
        self.assertNotIn("return 1\n\n\n", formatted)

    def test_protocol_methods_have_one_empty_line(self):
        source = (
            '"""Пример."""\n'
            "class Contract:\n"
            "    async def first(self) -> None: ...\n"
            "    async def second(self) -> None: ...\n"
        )
        formatted = format_source(source)

        self.assertIn("None: ...\n\n    async def second", formatted)
        self.assertEqual(format_source(formatted), formatted)
