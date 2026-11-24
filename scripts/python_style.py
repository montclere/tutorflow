"""Синтаксические правила оформления Python TutorFlow."""

import ast
import io
import tokenize
from itertools import pairwise


DEFINITIONS = (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)
IMPORTS = (ast.Import, ast.ImportFrom)
ASSIGNMENTS = (ast.Assign, ast.AnnAssign, ast.AugAssign)
TRANSFERS = (ast.Return, ast.Raise, ast.Break, ast.Continue)
BLOCKS = (
    ast.If,
    ast.For,
    ast.AsyncFor,
    ast.While,
    ast.With,
    ast.AsyncWith,
    ast.Try,
    ast.TryStar,
    ast.Match,
)
CLAUSES = {"elif", "else", "except", "finally"}
LOGICAL_GAP = 1
DEFINITION_GAP = 2
IMPORT_GAP = 2


def documentation_statement(node):
    return (
        isinstance(node, ast.Expr)
        and isinstance(node.value, ast.Constant)
        and isinstance(node.value.value, str)
    )


def first_line(node):
    decorators = getattr(node, "decorator_list", [])

    return min([node.lineno, *(decorator.lineno for decorator in decorators)])


def module_description_error(source):
    tree = ast.parse(source)

    if not tree.body or not documentation_statement(tree.body[0]):
        return "нужен модульный докстринг с назначением файла"

    description = tree.body[0]

    if description.lineno != 1 or description.end_lineno != 1:
        return "модульный докстринг должен занимать первую строку"

    if not description.value.value.strip():
        return "модульный докстринг должен описывать назначение файла"

    return None


def remove_internal_documentation(source):
    tree = ast.parse(source)
    lines = source.splitlines(keepends=True)
    edits = []

    for node in ast.walk(tree):
        if isinstance(node, DEFINITIONS) and node.body and documentation_statement(node.body[0]):
            description = node.body[0]
            replacement = "pass" if len(node.body) == 1 else ""
            start_column = len(
                lines[description.lineno - 1].encode()[: description.col_offset].decode()
            )
            end_column = len(
                lines[description.end_lineno - 1].encode()[: description.end_col_offset].decode()
            )

            edits.append(
                (
                    description.lineno,
                    start_column,
                    description.end_lineno,
                    end_column,
                    replacement,
                )
            )

    for token in tokenize.generate_tokens(io.StringIO(source).readline):
        if token.type == tokenize.COMMENT:
            edits.append((*token.start, *token.end, ""))

    for start_line, start_column, end_line, end_column, replacement in sorted(edits, reverse=True):
        prefix = lines[start_line - 1][:start_column]
        suffix = lines[end_line - 1][end_column:]
        lines[start_line - 1 : end_line] = [prefix + replacement + suffix]

    return "".join(lines)


def required_gap(previous, current, parent):
    if documentation_statement(previous) and isinstance(parent, ast.Module):
        return LOGICAL_GAP

    if isinstance(parent, ast.ClassDef) and (
        isinstance(previous, DEFINITIONS) or isinstance(current, DEFINITIONS)
    ):
        return LOGICAL_GAP

    if isinstance(previous, IMPORTS):
        return None if isinstance(current, IMPORTS) else IMPORT_GAP

    if isinstance(previous, DEFINITIONS) or isinstance(current, DEFINITIONS):
        return LOGICAL_GAP if isinstance(parent, ast.ClassDef) else DEFINITION_GAP

    if isinstance(previous, (*BLOCKS, *TRANSFERS)) or isinstance(current, (*BLOCKS, *TRANSFERS)):
        return LOGICAL_GAP

    if isinstance(previous, ASSIGNMENTS) != isinstance(current, ASSIGNMENTS):
        return LOGICAL_GAP

    return None


def format_source(source):
    source = remove_internal_documentation(source)
    tree = ast.parse(source)
    lines = source.splitlines(keepends=True)
    gaps = {}

    for parent in ast.walk(tree):
        if isinstance(parent, ast.Match):
            for branch in parent.cases[1:]:
                gaps[branch.pattern.lineno] = 0

        for _, field in ast.iter_fields(parent):
            if not isinstance(field, list):
                continue

            statements = [node for node in field if isinstance(node, ast.stmt)]

            if (
                statements
                and not isinstance(parent, ast.Module)
                and statements[0].col_offset > getattr(parent, "col_offset", -1)
                and first_line(statements[0]) > getattr(parent, "lineno", 0)
            ):
                gaps[first_line(statements[0])] = 0

            for previous, current in pairwise(statements):
                gap = required_gap(previous, current, parent)

                if gap is not None:
                    gaps[first_line(current)] = gap

    for token in tokenize.generate_tokens(io.StringIO(source).readline):
        if (
            token.type == tokenize.NAME
            and token.string in CLAUSES
            and not lines[token.start[0] - 1][: token.start[1]].strip()
        ):
            gaps[token.start[0]] = 0

    for line_number, count in sorted(gaps.items(), reverse=True):
        position = line_number - 1
        start = position

        while start > 0 and not lines[start - 1].strip():
            start -= 1

        if start > 0:
            lines[start:position] = ["\n"] * count

    result = "".join(lines).lstrip("\n").rstrip() + "\n"

    if ast.dump(ast.parse(result), include_attributes=False) != ast.dump(
        ast.parse(remove_internal_documentation(source)), include_attributes=False
    ):
        raise ValueError("Оформление изменило синтаксическое дерево")

    return result
