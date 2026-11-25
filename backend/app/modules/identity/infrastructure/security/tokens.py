"""Криптографические операции кодов подтверждения, сессий и CSRF."""

import hashlib
import hmac
import secrets
from uuid import UUID

from app.modules.identity.domain.policies import REGISTRATION_CODE_DIGITS


SESSION_TOKEN_BYTES = 32
MINIMUM_SECRET_BYTES = 32


class IdentitySecurity:
    def __init__(self, secret: bytes) -> None:
        if len(secret) < MINIMUM_SECRET_BYTES:
            raise ValueError("Недостаточная длина секрета Identity")

        self.secret = secret

    def digest(self, purpose: str, *parts: str) -> str:
        return hmac.digest(self.secret, "\0".join((purpose, *parts)).encode(), "sha256").hex()

    def registration_code(self, challenge_id: UUID) -> str:
        digest = int(self.digest("registration-delivery", str(challenge_id)), 16)

        return f"{digest % (10**REGISTRATION_CODE_DIGITS):0{REGISTRATION_CODE_DIGITS}d}"

    def registration_digest(self, challenge_id: UUID, code: str) -> str:
        return self.digest("registration", str(challenge_id), code)

    def new_session_token(self) -> str:
        return secrets.token_urlsafe(SESSION_TOKEN_BYTES)

    def session_digest(self, token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    def csrf_token(self, token: str) -> str:
        return self.digest("csrf", token)

    def matches_csrf(self, token: str, supplied: str) -> bool:
        return hmac.compare_digest(self.csrf_token(token).encode(), supplied.encode())
