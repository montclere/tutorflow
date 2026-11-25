"""Оркестрация приглашённой регистрации с атомарной привязкой аккаунта."""

from uuid import UUID

from app.modules.identity.public import InvitedRegistration, StudentSession
from app.modules.students.application.ports import StudentsUnitOfWork
from app.modules.students.application.services.connections import ConnectionService
from app.modules.students.application.services.invitations import InvitationService
from app.modules.students.domain.exceptions import StudentError


class StudentRegistrationService:
    def __init__(
        self,
        persistence: StudentsUnitOfWork,
        identity: InvitedRegistration,
        invitations: InvitationService,
        connections: ConnectionService,
    ):
        self.persistence = persistence
        self.identity = identity
        self.invitations = invitations
        self.connections = connections

    async def start(self, token: str, kind: str, contact: str, ip: str) -> UUID:
        await self.invitations.requests.access(ip)

        async with self.persistence.transaction() as unit:
            card, invitation = await self.invitations.get_active(unit, token)

        return await self.identity.start_student(kind, contact, invitation.id, ip)

    async def complete(
        self,
        token: str,
        challenge_id: UUID,
        code: str,
        password: str,
        ip: str,
        previous_token: str | None,
    ) -> StudentSession:
        await self.invitations.requests.access(ip)

        async with self.persistence.transaction() as unit:
            card, invitation = await self.invitations.get_active(unit, token)

        proof = await self.identity.prepare_student(challenge_id, code, password, invitation.id, ip)

        async with self.persistence.transaction() as unit:
            card, current = await self.invitations.get_active(unit, token)

            if current.id != proof.invitation_id:
                raise StudentError("invitation_invalid")

            session = await unit.accounts.register(proof, previous_token)

            await self.connections.connect(unit, card, current, session.account_id)

            return session
