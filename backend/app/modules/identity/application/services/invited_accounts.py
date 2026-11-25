"""Участник общей транзакции регистрации и безопасное чтение профилей."""

from uuid import UUID, uuid4

from app.modules.identity.application.ports import IdentityRepository
from app.modules.identity.application.services.registration import RegistrationService
from app.modules.identity.domain.entities import Account
from app.modules.identity.domain.exceptions import IdentityError
from app.modules.identity.domain.values import Role
from app.modules.identity.public import InvitedRegistrationProof, InvitedSession, PublicProfile


class InvitedAccountService:
    def __init__(self, repository: IdentityRepository, registration: RegistrationService) -> None:
        self.repository = repository
        self.registration = registration

    async def lock_profile(self, account_id: UUID, role: Role) -> PublicProfile | None:
        return await self.repository.find_public_profile_for_update(account_id, role)

    async def activate_role(self, account_id: UUID, role: Role) -> PublicProfile | None:
        profile = await self.repository.find_public_profile_for_update(account_id)

        if profile is not None:
            await self.repository.add_role(account_id, role, self.registration.clock())

        return profile

    async def profile(self, account_id: UUID) -> PublicProfile | None:
        return await self.repository.find_public_profile(account_id)

    async def profiles(self, account_ids: list[UUID]) -> dict[UUID, PublicProfile]:
        profiles = await self.repository.list_public_profiles(account_ids)

        return {profile.account_id: profile for profile in profiles}

    async def register(
        self, proof: InvitedRegistrationProof, previous_token: str | None
    ) -> InvitedSession:
        challenge = await self.registration.verify_code(
            self.repository, proof.challenge_id, proof.code, proof.invitation_id, role=proof.role
        )

        if challenge is None:
            raise IdentityError("challenge_invalid")

        now = self.registration.clock()
        account = Account(
            uuid4(), challenge.contact, frozenset({proof.role}), proof.password_hash, now
        )

        if not await self.repository.add_account(account):
            raise IdentityError("challenge_invalid")

        if not challenge.is_active(self.registration.clock()):
            raise IdentityError("challenge_invalid")

        await self.repository.remove_registration(challenge.id)

        signed = await self.registration.sessions.create(
            self.repository, account, previous_token, now
        )

        return InvitedSession(account.id, signed.session_token, signed.csrf_token)
