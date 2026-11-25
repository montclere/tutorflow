"""Проверки криптографических границ Identity."""

from uuid import uuid4

import pytest

from app.modules.identity.infrastructure.security.tokens import IdentitySecurity


pytestmark = pytest.mark.br_001


def test_security_separates_token_purposes_and_keys():
    security = IdentitySecurity(b"a" * 32)
    other = IdentitySecurity(b"b" * 32)
    challenge = uuid4()
    code = security.registration_code(challenge)

    assert len(code) == 8
    assert code.isdigit()
    assert security.registration_code(challenge) == code
    assert other.registration_digest(challenge, code) != security.registration_digest(
        challenge, code
    )
    assert security.csrf_token(code) != security.registration_digest(challenge, code)
    assert security.matches_csrf(code, security.csrf_token(code))
    assert not security.matches_csrf(code, other.csrf_token(code))
    assert not security.matches_csrf(code, "")


def test_new_sessions_have_independent_tokens_and_store_digests():
    security = IdentitySecurity(b"a" * 32)
    first, second = security.new_session_token(), security.new_session_token()

    assert first != second
    assert security.session_digest(first) != first
    assert security.session_digest(first) != security.session_digest(second)


def test_cancelled_password_request_keeps_its_slot_until_worker_finishes(monkeypatch):
    import asyncio
    from threading import Event
    from types import SimpleNamespace

    from app.modules.identity.domain.exceptions import IdentityError
    from app.modules.identity.infrastructure.security.passwords import ArgonPasswords
    from app.modules.identity.infrastructure.security.settings import PasswordHashingSettings


    started = Event()
    release = Event()


    def blocking_hash(password):
        started.set()
        release.wait(timeout=5)

        return "digest"


    async def run():
        passwords = ArgonPasswords(
            PasswordHashingSettings(max_concurrent=1, wait_timeout_seconds=0.02)
        )

        monkeypatch.setattr(
            passwords,
            "hasher",
            SimpleNamespace(hash=blocking_hash, verify=lambda digest, password: True),
        )

        request = asyncio.create_task(passwords.hash("first"))

        try:
            assert await asyncio.to_thread(started.wait, 1)
            request.cancel()

            with pytest.raises(asyncio.CancelledError):
                await request

            with pytest.raises(IdentityError, match="identity_busy"):
                await passwords.hash("second")

            with pytest.raises(IdentityError, match="identity_busy"):
                await passwords.verify("digest", "second")
        finally:
            release.set()

        assert await passwords.hash("third") == "digest"


    asyncio.run(run())


def test_token_security_rejects_a_short_secret_without_disclosing_it():
    with pytest.raises(ValueError) as error:
        IdentitySecurity(b"private-short-secret")

    assert "private-short-secret" not in str(error.value)
