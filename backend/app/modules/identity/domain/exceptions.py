"""Доменные ошибки Identity."""

class IdentityError(Exception):
    def __init__(self, code: str):
        self.code = code
