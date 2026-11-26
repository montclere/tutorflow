"""Ошибки предметных правил группового обучения."""

class GroupError(Exception):
    def __init__(self, code: str) -> None:
        self.code = code

        super().__init__(code)
