"""Проверяет сценарий Identity через порты без HTTP и PostgreSQL."""

from contextlib import asynccontextmanager
from datetime import UTC, datetime
from unittest.mock import Mock

import pytest

from app.modules.identity.application.contracts import ContactInput
from app.modules.identity.application.ports import (
    CodeDelivery,
    IdentityRepository,
    Passwords,
    RegistrationDelivery,
)
from app.modules.identity.application.services.rate_limits import RateLimitService
from app.modules.identity.application.services.registration import RegistrationService
from app.modules.identity.application.services.sessions import SessionService
from app.modules.identity.domain.policies import IdentityPolicy
from app.modules.identity.domain.values import Contact, ContactKind, Role
from app.modules.identity.infrastructure.security.tokens import IdentitySecurity
from app.modules.identity.infrastructure.validation.contacts import ValidatedContacts


class MemoryUnitOfWork:
    def __init__(self):
        self.repository = Mock(spec=IdentityRepository)
        self.repository.find_registration_for_update.return_value = None
        self.active_transactions = 0

    @asynccontextmanager
    async def transaction(self):
        self.active_transactions += 1

        try:
            yield self.repository
        finally:
            self.active_transactions -= 1


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
@pytest.mark.br_075
async def test_registration_selects_role_and_consumes_locked_challenge():
    now = datetime(2026, 11, 24, 8, tzinfo=UTC)
    storage = MemoryUnitOfWork()
    repo = storage.repository
    repo.consume_rate_window.return_value = True
    repo.find_account_by_contact.return_value = None
    repo.save_registration.side_effect = lambda registration, *args, **kwargs: registration.id
    repo.add_account.return_value = True
    passwords = Mock(spec=Passwords)
    passwords.needs_rehash.return_value = False


    async def hash_outside_transaction(password):
        assert storage.active_transactions == 0

        return "test-digest"


    passwords.hash.side_effect = hash_outside_transaction
    delivery = Mock(spec=CodeDelivery)
    security = IdentitySecurity(b"test" * 8)
    policy = IdentityPolicy()
    sessions = SessionService(storage, security, policy, lambda: now)
    service = RegistrationService(
        storage,
        passwords,
        delivery,
        security,
        sessions,
        RateLimitService(storage, security),
        policy,
        lambda: now,
        contacts=ValidatedContacts(),
    )
    contact = Contact(ContactKind.EMAIL, "teacher@example.com")
    challenge_id = await service.start(ContactInput(contact.kind, contact.value), "127.0.0.1")
    repo.claim_registration_delivery.return_value = RegistrationDelivery(challenge_id, contact, 1)

    assert await service.deliver_pending(challenge_id)
    delivery.send.assert_called_once()

    delivered_contact, code = delivery.send.call_args.args

    assert delivered_contact == contact

    registration = repo.save_registration.call_args.args[0]
    repo.find_registration_for_update.return_value = registration
    result = await service.complete(challenge_id, code, "example password", "127.0.0.1", None)

    assert result.account.roles == frozenset({Role.TEACHER})
    assert result.account.contact == contact
    assert result.account.verified_at == now
    assert registration.code_digest != code
    repo.remove_registration.assert_called_once_with(challenge_id)
    assert repo.add_session.call_args.args[0].account_id == result.account.id


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
@pytest.mark.br_001
async def test_confirmation_checks_expiry_after_waiting_for_the_lock():
    from datetime import timedelta
    from uuid import uuid4

    from app.modules.identity.domain.entities import Registration
    from app.modules.identity.domain.exceptions import IdentityError


    now = datetime(2026, 11, 24, 8, tzinfo=UTC)
    challenge_id = uuid4()
    contact = Contact(ContactKind.EMAIL, "teacher@example.com")
    security = IdentitySecurity(b"test" * 8)
    storage = MemoryUnitOfWork()
    repository = storage.repository
    repository.consume_rate_window.return_value = True
    repository.find_registration_for_update.return_value = Registration(
        challenge_id,
        contact,
        security.registration_digest(challenge_id, "12345678"),
        now,
        now + timedelta(seconds=1),
        5,
    )
    clock = iter((now, now + timedelta(seconds=2))).__next__
    policy = IdentityPolicy()
    service = RegistrationService(
        storage,
        Mock(spec=Passwords),
        Mock(spec=CodeDelivery),
        security,
        SessionService(storage, security, policy, clock),
        RateLimitService(storage, security),
        policy,
        clock,
        contacts=ValidatedContacts(),
    )

    with pytest.raises(IdentityError, match="challenge_invalid"):
        await service.complete(challenge_id, "12345678", "example password", "127.0.0.1", None)

    repository.add_account.assert_not_awaited()
    repository.add_session.assert_not_awaited()
    repository.update_password_hash.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
@pytest.mark.br_001
@pytest.mark.parametrize("rehash", [False, True])
async def test_login_rechecks_credentials_after_password_verification(rehash):
    from dataclasses import replace
    from uuid import uuid4

    from app.modules.identity.application.services.authentication import AuthenticationService
    from app.modules.identity.domain.entities import Account
    from app.modules.identity.domain.exceptions import IdentityError


    now = datetime(2026, 11, 24, 8, tzinfo=UTC)
    contact = Contact(ContactKind.EMAIL, "teacher@example.com")
    account = Account(uuid4(), contact, frozenset({Role.TEACHER}), "old-hash", now)
    storage = MemoryUnitOfWork()
    repository = storage.repository
    repository.consume_rate_window.return_value = True
    repository.find_account_by_contact.side_effect = [
        account,
        replace(account, password_hash="changed-hash"),
    ]
    repository.find_account_for_update.return_value = replace(account, password_hash="changed-hash")
    passwords = Mock(spec=Passwords)
    passwords.needs_rehash.return_value = rehash
    security = IdentitySecurity(b"test" * 8)
    policy = IdentityPolicy()


    async def verify_outside_transaction(digest, password):
        assert storage.active_transactions == 0

        return digest == "old-hash"


    async def rehash_outside_transaction(password):
        assert storage.active_transactions == 0

        return "replacement-hash"


    passwords.hash.side_effect = rehash_outside_transaction
    passwords.verify.side_effect = verify_outside_transaction
    service = AuthenticationService(
        storage,
        passwords,
        SessionService(storage, security, policy, lambda: now),
        RateLimitService(storage, security),
        policy,
        lambda: now,
        "dummy-hash",
        contacts=ValidatedContacts(),
    )

    with pytest.raises(IdentityError, match="invalid_credentials"):
        await service.login(
            ContactInput(contact.kind, contact.value), "example password", "127.0.0.1", None
        )

    repository.add_session.assert_not_awaited()
    repository.update_password_hash.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
@pytest.mark.br_001
@pytest.mark.parametrize("password", ["short", "x" * 129])
async def test_registration_rejects_password_outside_policy_before_hashing(password):
    from uuid import uuid4

    from app.modules.identity.domain.exceptions import IdentityError


    now = datetime(2026, 11, 24, 8, tzinfo=UTC)
    storage = MemoryUnitOfWork()
    passwords = Mock(spec=Passwords)
    passwords.needs_rehash.return_value = False
    security = IdentitySecurity(b"test" * 8)
    policy = IdentityPolicy()
    service = RegistrationService(
        storage,
        passwords,
        Mock(spec=CodeDelivery),
        security,
        SessionService(storage, security, policy, lambda: now),
        RateLimitService(storage, security),
        policy,
        lambda: now,
        contacts=ValidatedContacts(),
    )

    with pytest.raises(IdentityError, match="invalid_password"):
        await service.complete(uuid4(), "12345678", password, "127.0.0.1", None)

    passwords.hash.assert_not_awaited()
    storage.repository.add_account.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
@pytest.mark.br_001
async def test_registration_normalizes_contact_before_rate_limits_and_storage():
    now = datetime(2026, 11, 24, 8, tzinfo=UTC)
    storage = MemoryUnitOfWork()
    storage.repository.find_account_by_contact.return_value = None
    storage.repository.consume_rate_window.return_value = True
    storage.repository.save_registration.side_effect = lambda registration, *args, **kwargs: (
        registration.id
    )
    security = IdentitySecurity(b"test" * 8)
    policy = IdentityPolicy()
    service = RegistrationService(
        storage,
        Mock(spec=Passwords),
        Mock(spec=CodeDelivery),
        security,
        SessionService(storage, security, policy, lambda: now),
        RateLimitService(storage, security),
        policy,
        lambda: now,
        contacts=ValidatedContacts(),
    )

    await service.start(ContactInput(ContactKind.EMAIL, "  Teacher@EXAMPLE.COM  "), "127.0.0.1")

    expected = Contact(ContactKind.EMAIL, "teacher@example.com")

    storage.repository.find_account_by_contact.assert_awaited_once_with(expected)
    assert storage.repository.save_registration.call_args.args[0].contact == expected
    assert storage.repository.consume_rate_window.call_args_list[1].args[0] == security.digest(
        "rate", "register-contact", "email:teacher@example.com"
    )


@pytest.fixture
def identity_case():
    from types import SimpleNamespace

    from app.modules.identity.application.services.authentication import AuthenticationService


    now = datetime(2026, 11, 24, 8, tzinfo=UTC)
    storage = MemoryUnitOfWork()
    storage.repository.consume_rate_window.return_value = True
    storage.repository.find_account_by_contact.return_value = None
    passwords = Mock(spec=Passwords)
    passwords.needs_rehash.return_value = False
    passwords.verify.return_value = False
    security = IdentitySecurity(b"test" * 8)
    policy = IdentityPolicy()
    service = AuthenticationService(
        storage,
        passwords,
        SessionService(storage, security, policy, lambda: now),
        RateLimitService(storage, security),
        policy,
        lambda: now,
        "dummy-hash",
        contacts=ValidatedContacts(),
    )

    registration = RegistrationService(
        storage,
        passwords,
        Mock(spec=CodeDelivery),
        security,
        SessionService(storage, security, policy, lambda: now),
        RateLimitService(storage, security),
        policy,
        lambda: now,
        contacts=ValidatedContacts(),
    )

    return SimpleNamespace(
        authentication=service,
        registration=registration,
        passwords=passwords,
        repository=storage.repository,
    )


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
@pytest.mark.br_001
async def test_login_normalizes_contact_and_accepts_legacy_short_password(identity_case):
    from app.modules.identity.domain.exceptions import IdentityError


    with pytest.raises(IdentityError, match="invalid_credentials"):
        await identity_case.authentication.login(
            ContactInput(ContactKind.EMAIL, " Teacher@EXAMPLE.COM "), "short", "127.0.0.1", None
        )

    identity_case.repository.find_account_by_contact.assert_awaited_once_with(
        Contact(ContactKind.EMAIL, "teacher@example.com")
    )
    identity_case.passwords.verify.assert_awaited_once_with("dummy-hash", "short")


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
@pytest.mark.br_001
@pytest.mark.parametrize("password", ["", "x" * 129])
async def test_login_rejects_invalid_password_size_before_hashing(identity_case, password):
    from app.modules.identity.domain.exceptions import IdentityError


    with pytest.raises(IdentityError, match="invalid_password"):
        await identity_case.authentication.login(
            ContactInput(ContactKind.EMAIL, "teacher@example.com"), password, "127.0.0.1", None
        )

    identity_case.passwords.verify.assert_not_awaited()
    identity_case.repository.find_account_by_contact.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
@pytest.mark.br_001
@pytest.mark.parametrize(
    "contact",
    [
        ContactInput(ContactKind.EMAIL, "not-an-email"),
        ContactInput(ContactKind.EMAIL, "teacher@example.com\nBcc: other@example.com"),
        ContactInput(ContactKind.PHONE, "+١٥٥٥١٢٣٤٥٦٧"),
        ContactInput(ContactKind.PHONE, "15551234567"),
        ContactInput(ContactKind.EMAIL, "x" * 255),
    ],
)
@pytest.mark.parametrize("operation", ["registration", "login"])
async def test_scenarios_reject_invalid_contact_before_hashing_or_storage(
    identity_case, contact, operation
):
    from app.modules.identity.domain.exceptions import IdentityError


    with pytest.raises(IdentityError, match="invalid_contact"):
        if operation == "registration":
            await identity_case.registration.start(contact, "127.0.0.1")
        else:
            await identity_case.authentication.login(contact, "example password", "127.0.0.1", None)

    identity_case.passwords.verify.assert_not_awaited()
    identity_case.repository.find_account_by_contact.assert_not_awaited()
    identity_case.repository.consume_rate_window.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
@pytest.mark.br_001
@pytest.mark.parametrize("code", ["", "123456789", "１２３４５６７８", "abcdefgh"])
async def test_registration_rejects_malformed_codes_before_hashing_or_storage(identity_case, code):
    from uuid import uuid4

    from app.modules.identity.domain.exceptions import IdentityError


    with pytest.raises(IdentityError, match="challenge_invalid"):
        await identity_case.registration.complete(
            uuid4(), code, "example password", "127.0.0.1", None
        )

    identity_case.passwords.hash.assert_not_awaited()
    identity_case.repository.find_registration_for_update.assert_not_awaited()
