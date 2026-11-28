"""Участник общей транзакции регистрации и безопасное чтение профилей."""

from secrets import token_urlsafe
from uuid import UUID, uuid4

from app.modules.identity.application.ports import IdentityRepository
from app.modules.identity.application.services.registration import RegistrationService
from app.modules.identity.domain.entities import Account
from app.modules.identity.domain.exceptions import IdentityError
from app.modules.identity.domain.values import Contact, ContactKind, Role
from app.modules.identity.public import (
    ChildCredentials,
    ChildManagement,
    InvitedRegistrationProof,
    InvitedSession,
    PublicProfile,
)


CHILD_PASSWORD_BYTES = 24


class InvitedAccountService:
    def __init__(self, repository: IdentityRepository, registration: RegistrationService) -> None:
        self.repository = repository
        self.registration = registration

    async def create_child(self, manager_id: UUID) -> ChildCredentials:
        await self._require_adult(manager_id)

        account_id = uuid4()
        login = str(uuid4())
        password = token_urlsafe(CHILD_PASSWORD_BYTES)
        digest = await self.registration.passwords.hash(password)
        account = Account(
            account_id,
            Contact(ContactKind.CHILD, login),
            frozenset({Role.STUDENT}),
            digest,
            self.registration.clock(),
            manager_id=manager_id,
        )

        if not await self.repository.add_account(account):
            raise IdentityError("identity_busy")

        return ChildCredentials(account_id, login, password)

    async def get_child_management(self, child_id: UUID) -> ChildManagement | None:
        return await self.repository.find_child_management(child_id)

    async def list_managed_children(self, manager_id: UUID) -> list[ChildManagement]:
        return await self.repository.list_managed_children(manager_id)

    async def request_child_transfer(
        self, child_id: UUID, manager_id: UUID, target_id: UUID
    ) -> None:
        child = await self._managed_child(child_id, manager_id)

        if target_id == manager_id:
            raise IdentityError("child_transfer_invalid")

        await self._require_adult(target_id)
        await self.repository.update_child_management(child.id, manager_id, target_id)

    async def accept_child_transfer(self, child_id: UUID, target_id: UUID) -> ChildCredentials:
        child = await self._child(child_id)

        if child.manager_id is None or child.pending_manager_id != target_id:
            raise IdentityError("child_transfer_invalid")

        await self._require_adult(target_id)
        await self.repository.update_child_management(child.id, target_id, None)

        return await self._reset_password(child)

    async def cancel_child_transfer(self, child_id: UUID, manager_id: UUID) -> None:
        child = await self._managed_child(child_id, manager_id)

        await self.repository.update_child_management(child.id, manager_id, None)

    async def release_child(self, child_id: UUID, manager_id: UUID) -> None:
        child = await self._managed_child(child_id, manager_id)

        await self.repository.update_child_management(child.id, None, None)
        await self.repository.remove_account_sessions(child.id)

    async def reset_child_password(self, child_id: UUID, manager_id: UUID) -> ChildCredentials:
        child = await self._managed_child(child_id, manager_id)

        return await self._reset_password(child)

    async def _require_adult(self, account_id: UUID) -> None:
        if await self.lock_profile(account_id, Role.ADULT) is None:
            raise IdentityError("child_manager_invalid")

    async def _child(self, child_id: UUID) -> Account:
        child = await self.repository.find_account_for_update(child_id)

        if child is None:
            raise IdentityError("child_not_found")

        child.require_child()

        return child

    async def _managed_child(self, child_id: UUID, manager_id: UUID) -> Account:
        child = await self._child(child_id)

        child.require_child_manager(manager_id)

        return child

    async def _reset_password(self, child: Account) -> ChildCredentials:
        password = token_urlsafe(CHILD_PASSWORD_BYTES)
        digest = await self.registration.passwords.hash(password)

        await self.repository.update_password_hash(child.id, digest)
        await self.repository.remove_account_sessions(child.id)

        return ChildCredentials(child.id, child.contact.value, password)

    async def lock_profile(self, account_id: UUID, role: Role) -> PublicProfile | None:
        return await self.repository.find_public_profile_for_update(account_id, role)

    async def activate_role(self, account_id: UUID, role: Role) -> PublicProfile | None:
        account = await self.repository.find_account_for_update(account_id)

        if account is None:
            return None

        account.require_role_activation(role)
        await self.repository.add_role(account_id, role, self.registration.clock())

        return PublicProfile(account.id, account.profile.display_name, account.profile.timezone)

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
