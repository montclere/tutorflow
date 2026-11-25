"""Сервис подтверждения контакта и регистрации преподавателя."""

from collections.abc import Callable
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.identity.application.contracts import ContactInput, SignedIn
from app.modules.identity.application.ports import (
    CodeDelivery,
    ContactNormalizer,
    DeliveryUnavailable,
    IdentityRepository,
    IdentityTokens,
    IdentityUnitOfWork,
    Passwords,
)
from app.modules.identity.application.services.rate_limits import RateLimitService
from app.modules.identity.application.services.sessions import SessionService
from app.modules.identity.domain.entities import Account, Registration
from app.modules.identity.domain.exceptions import IdentityError
from app.modules.identity.domain.policies import (
    IdentityPolicy,
    validate_password,
    validate_registration_code,
)
from app.modules.identity.domain.values import Role


class RegistrationService:
    def __init__(
        self,
        persistence: IdentityUnitOfWork,
        passwords: Passwords,
        delivery: CodeDelivery,
        security: IdentityTokens,
        sessions: SessionService,
        rate_limits: RateLimitService,
        policy: IdentityPolicy,
        clock: Callable[[], datetime],
        *,
        contacts: ContactNormalizer,
    ) -> None:
        self.persistence = persistence
        self.passwords = passwords
        self.delivery = delivery
        self.security = security
        self.sessions = sessions
        self.rate_limits = rate_limits
        self.policy = policy
        self.clock = clock
        self.contacts = contacts

    async def start(self, contact: ContactInput, ip: str) -> UUID:
        normalized = self.contacts.normalize(contact)
        now = self.clock()

        await self.rate_limits.check("register-ip", ip, self.policy.registration_ip, now)
        await self.rate_limits.check(
            "register-contact",
            f"{normalized.kind}:{normalized.value}",
            self.policy.registration_contact,
            now,
        )

        challenge_id = uuid4()
        code = self.security.registration_code(challenge_id)

        async with self.persistence.transaction() as repository:
            may_register = await repository.find_account_by_contact(normalized) is None
            registration = Registration(
                challenge_id,
                normalized,
                self.security.registration_digest(challenge_id, code),
                now,
                now + self.policy.code_lifetime,
                self.policy.code_attempts,
            )

            return await repository.save_registration(
                registration, now - self.policy.code_cooldown, delivery_enabled=may_register
            )

    async def deliver_pending(self, challenge_id: UUID | None = None) -> bool:
        async with self.persistence.transaction() as repository:
            delivery = await repository.claim_registration_delivery(
                challenge_id,
                self.clock(),
                self.policy.delivery_retry_delay,
                self.policy.delivery_attempts,
            )

        if delivery is None:
            return False

        try:
            await self.delivery.send(
                delivery.contact, self.security.registration_code(delivery.challenge_id)
            )
        except DeliveryUnavailable:
            pass
        else:
            async with self.persistence.transaction() as repository:
                await repository.mark_registration_delivered(delivery)

        return True

    async def complete(
        self, challenge_id: UUID, code: str, password: str, ip: str, previous_token: str | None
    ) -> SignedIn:
        validate_password(password, registering=True)
        validate_registration_code(code)

        now = self.clock()

        await self.rate_limits.check("confirm-ip", ip, self.policy.confirmation_ip, now)

        async with self.persistence.transaction() as repository:
            challenge = await self._verify_code(repository, challenge_id, code)

        if challenge is None:
            raise IdentityError("challenge_invalid")

        password_hash = await self.passwords.hash(password)

        async with self.persistence.transaction() as repository:
            challenge = await self._verify_code(repository, challenge_id, code)

            if challenge is not None:
                now = self.clock()
                account = Account(uuid4(), challenge.contact, Role.TEACHER, password_hash, now)
                created = await repository.add_account(account)

                await repository.remove_registration(challenge_id)

                if created:
                    return await self.sessions.create(repository, account, previous_token, now)

        raise IdentityError("challenge_invalid")

    async def _verify_code(
        self, repository: IdentityRepository, challenge_id: UUID, code: str
    ) -> Registration | None:
        challenge = await repository.find_registration_for_update(challenge_id)

        if challenge is None or not challenge.is_active(self.clock()):
            return None

        if challenge.matches(self.security.registration_digest(challenge_id, code)):
            return challenge

        await repository.save_attempts(challenge.reject_code())

        return None
