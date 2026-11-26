"""Криптографические случайные токены приглашений и их дайджесты."""

import hashlib
import hmac
import secrets

from app.modules.students.application.contracts import INVITATION_TOKEN_LENGTH
from app.modules.students.domain.exceptions import StudentError


INVITATION_MINIMUM_SECRET_BYTES = 32
INVITATION_TOKEN_BYTES = 32


class SecureInvitationTokens:
    def __init__(self, secret: bytes, *, purpose: bytes = b"students-invitation\0") -> None:
        if len(secret) < INVITATION_MINIMUM_SECRET_BYTES:
            raise ValueError("Недостаточная длина секрета приглашений")

        self.secret = secret
        self.purpose = purpose

    def new_token(self) -> str:
        return secrets.token_urlsafe(INVITATION_TOKEN_BYTES)

    def digest(self, token: str) -> str:
        if len(token) != INVITATION_TOKEN_LENGTH or not all(
            c.isascii() and (c.isalnum() or c in "-_") for c in token
        ):
            raise StudentError("invitation_invalid")

        return hmac.new(self.secret, self.purpose + token.encode(), hashlib.sha256).hexdigest()
