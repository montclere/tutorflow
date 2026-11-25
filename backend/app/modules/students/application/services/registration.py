"""Оркестрация приглашённой регистрации с атомарной привязкой аккаунта."""

from uuid import UUID

from app.modules.identity.public import InvitedRegistration, InvitedSession, Role
from app.modules.students.application.ports import (
    CardInvitationAccess,
    ConnectionAcceptance,
    StudentsUnitOfWork,
)
from app.modules.students.domain.exceptions import StudentError


class InvitedRegistrationService:
    def __init__(
        self,
        persistence: StudentsUnitOfWork,
        identity: InvitedRegistration,
        invitations: CardInvitationAccess,
        connections: ConnectionAcceptance,
        role: Role,
    ) -> None:
        self.persistence = persistence
        self.identity = identity
        self.invitations = invitations
        self.connections = connections
        self.role = role

    async def start(self, token: str, kind: str, contact: str, ip: str) -> UUID:
        await self.invitations.requests.access(ip)

        async with self.persistence.transaction() as unit:
            _, invitation = await self.invitations.get_active(unit, token)

        return await self.identity.start_invited(kind, contact, invitation.id, ip, role=self.role)

    async def complete(
        self,
        token: str,
        challenge_id: UUID,
        code: str,
        password: str,
        ip: str,
        previous_token: str | None,
    ) -> InvitedSession:
        await self.invitations.requests.access(ip)

        async with self.persistence.transaction() as unit:
            _, invitation = await self.invitations.get_active(unit, token)

        proof = await self.identity.prepare_invited(
            challenge_id, code, password, invitation.id, ip, role=self.role
        )

        async with self.persistence.transaction() as unit:
            card, current = await self.invitations.get_active(unit, token)

            if current.id != proof.invitation_id or proof.role is not self.role:
                raise StudentError("invitation_invalid")

            session = await unit.accounts.register(proof, previous_token)

            await self.connections.connect(unit, card, current, session.account_id)

            return session

    async def deliver_pending(self, challenge_id: UUID) -> bool:
        return await self.identity.deliver_pending(challenge_id)
