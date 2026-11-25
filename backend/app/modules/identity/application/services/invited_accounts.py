"""Участник общей транзакции регистрации и безопасное чтение профилей."""

from uuid import UUID, uuid4

from app.modules.identity.application.ports import IdentityRepository
from app.modules.identity.application.services.registration import RegistrationService
from app.modules.identity.domain.entities import Account
from app.modules.identity.domain.exceptions import IdentityError
from app.modules.identity.domain.values import Role
from app.modules.identity.public import PublicProfile, StudentRegistrationProof, StudentSession


class InvitedAccountService:
    def __init__(self, repository: IdentityRepository, registration: RegistrationService) -> None:
        self.repository = repository
        self.registration = registration

    async def lock_student(self, account_id: UUID) -> PublicProfile | None:
        account = await self.repository.find_account_for_update(account_id)

        if account is None or account.role is not Role.STUDENT:
            return None

        return PublicProfile(account.id, account.profile.display_name, account.profile.timezone)

    async def profile(self, account_id: UUID) -> PublicProfile | None:
        account = await self.repository.find_account(account_id)

        if account is None:
            return None

        return PublicProfile(account.id, account.profile.display_name, account.profile.timezone)

    async def profiles(self, account_ids: list[UUID]) -> dict[UUID, PublicProfile]:
        accounts = await self.repository.list_accounts(account_ids)

        return {
            a.id: PublicProfile(a.id, a.profile.display_name, a.profile.timezone) for a in accounts
        }

    async def register(
        self, proof: StudentRegistrationProof, previous_token: str | None
    ) -> StudentSession:
        challenge = await self.registration.verify_code(
            self.repository, proof.challenge_id, proof.code, proof.invitation_id
        )

        if challenge is None:
            raise IdentityError("challenge_invalid")

        now = self.registration.clock()
        account = Account(uuid4(), challenge.contact, Role.STUDENT, proof.password_hash, now)

        if not await self.repository.add_account(account):
            raise IdentityError("challenge_invalid")

        if not challenge.is_active(self.registration.clock()):
            raise IdentityError("challenge_invalid")

        await self.repository.remove_registration(challenge.id)

        signed = await self.registration.sessions.create(
            self.repository, account, previous_token, now
        )

        return StudentSession(account.id, signed.session_token, signed.csrf_token)
