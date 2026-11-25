"""Принятие, отключение и безопасный список подключений ученика."""

from uuid import UUID

from app.modules.identity.public import Actor, Role
from app.modules.students.application.ports import StudentsTransaction, StudentsUnitOfWork
from app.modules.students.application.services.access import (
    owned_card,
    require_page_size,
    require_student,
)
from app.modules.students.application.services.invitations import InvitationService
from app.modules.students.domain.entities import (
    Connection,
    Invitation,
    StudentCard,
    TeacherConnection,
)
from app.modules.students.domain.exceptions import StudentError


class ConnectionService:
    def __init__(self, persistence: StudentsUnitOfWork, invitations: InvitationService) -> None:
        self.persistence = persistence
        self.invitations = invitations

    async def connect(
        self, unit: StudentsTransaction, card: StudentCard, invitation: Invitation, account_id: UUID
    ) -> Connection:
        if await unit.accounts.lock_profile(account_id, Role.STUDENT) is None:
            raise StudentError("student_required")

        invitation.require_for(card, self.invitations.clock())

        if await unit.students.find_teacher_connection(card.teacher_id, account_id) is not None:
            raise StudentError("student_already_connected")

        if not await unit.students.consume_invitation(invitation.id, self.invitations.clock()):
            raise StudentError("invitation_invalid")

        connection = Connection(card.id, card.teacher_id, account_id)

        await unit.students.add_connection(connection)

        return connection

    async def accept(self, actor: Actor, token: str, ip: str) -> Connection:
        require_student(actor)

        await self.invitations.requests.access(ip)

        async with self.persistence.transaction() as unit:
            card, invitation = await self.invitations.get_active(unit, token)

            return await self.connect(unit, card, invitation, actor.account_id)

    async def disconnect(self, actor: Actor, card_id: UUID) -> None:
        async with self.persistence.transaction() as unit:
            if actor.role is Role.TEACHER:
                card = await owned_card(unit.students, actor, card_id)
            else:
                require_student(actor)

                card = await unit.students.find_student_card(card_id, actor.account_id)

                if card is None:
                    raise StudentError("student_connection_not_found")

            connection = await unit.students.find_connection(card.id)

            if connection is None or (
                actor.role is not Role.TEACHER and connection.account_id != actor.account_id
            ):
                raise StudentError("student_connection_not_found")

            await unit.accounts.lock_profile(connection.account_id, Role.STUDENT)
            await unit.students.delete_connection(card.id)
            await unit.students.revoke_invitation(card.id)

    async def list(
        self, actor: Actor, after_id: UUID | None, limit: int
    ) -> list[TeacherConnection]:
        require_student(actor)
        require_page_size(limit)

        async with self.persistence.transaction() as unit:
            rows = await unit.students.list_connections(actor.account_id, after_id, limit + 1)
            teachers = await unit.accounts.profiles([row.teacher_id for row, archived in rows])

        return [
            TeacherConnection(
                row.card_id,
                row.teacher_id,
                teachers[row.teacher_id].display_name if row.teacher_id in teachers else None,
                archived,
            )
            for row, archived in rows
        ]
