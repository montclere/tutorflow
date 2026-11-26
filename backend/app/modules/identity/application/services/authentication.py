"""Сервис входа по контакту и паролю."""

from collections.abc import Callable
from dataclasses import replace
from datetime import datetime

from app.modules.identity.application.contracts import ContactInput, SignedIn
from app.modules.identity.application.ports import ContactNormalizer, IdentityUnitOfWork, Passwords
from app.modules.identity.application.services.rate_limits import RateLimitService
from app.modules.identity.application.services.sessions import SessionService
from app.modules.identity.domain.exceptions import IdentityError
from app.modules.identity.domain.policies import IdentityPolicy, validate_password
from app.modules.identity.domain.values import Role


MAX_CREDENTIAL_VERIFICATIONS = 2


class AuthenticationService:
    def __init__(
        self,
        persistence: IdentityUnitOfWork,
        passwords: Passwords,
        sessions: SessionService,
        rate_limits: RateLimitService,
        policy: IdentityPolicy,
        clock: Callable[[], datetime],
        dummy_hash: str,
        *,
        contacts: ContactNormalizer,
    ) -> None:
        self.persistence = persistence
        self.passwords = passwords
        self.sessions = sessions
        self.rate_limits = rate_limits
        self.policy = policy
        self.clock = clock
        self.dummy_hash = dummy_hash
        self.contacts = contacts

    async def login(
        self,
        contact: ContactInput,
        password: str,
        ip: str,
        previous_token: str | None,
        *,
        role: Role | None = None,
    ) -> SignedIn:
        validate_password(password, registering=False)

        normalized = self.contacts.normalize(contact)
        now = self.clock()

        await self.rate_limits.check("login-ip", ip, self.policy.login_ip, now)
        await self.rate_limits.check(
            "login-contact", f"{normalized.kind}:{normalized.value}", self.policy.login_contact, now
        )

        for _ in range(MAX_CREDENTIAL_VERIFICATIONS):
            async with self.persistence.transaction() as repository:
                account = await repository.find_account_by_contact(normalized)

            digest = account.password_hash if account else self.dummy_hash

            if not await self.passwords.verify(digest, password) or account is None:
                raise IdentityError("invalid_credentials")

            replacement = None

            if self.passwords.needs_rehash(digest):
                replacement = await self.passwords.hash(password)

            async with self.persistence.transaction() as repository:
                current = await repository.find_account_for_update(account.id)

                if current is None:
                    raise IdentityError("invalid_credentials")

                if current.password_hash != digest:
                    continue

                if role is not None:
                    current.require_role(role)

                if replacement is not None:
                    await repository.update_password_hash(current.id, replacement)

                    current = replace(current, password_hash=replacement)

                return await self.sessions.create(repository, current, previous_token, self.clock())

        raise IdentityError("identity_busy")
