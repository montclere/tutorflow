"""Подключение взрослых и разрешённые проекции карточек и стоимости."""

from uuid import UUID

from app.modules.identity.public import Actor, Principal, PublicProfile, Role
from app.modules.students.application.contracts import AdultLearningProfile, AdultStudent
from app.modules.students.application.ports import StudentsTransaction, StudentsUnitOfWork
from app.modules.students.application.services.access import (
    connected_adult_card,
    owned_card,
    require_adult,
    require_page_size,
)
from app.modules.students.application.services.adult_invitations import AdultInvitationService
from app.modules.students.application.services.responsibilities import assign_initial_responsibility
from app.modules.students.domain.entities import Connection, Invitation, StudentCard
from app.modules.students.domain.exceptions import StudentError
from app.modules.students.domain.policies import AdultAccessPolicy


class AdultConnectionService:
    def __init__(
        self,
        persistence: StudentsUnitOfWork,
        invitations: AdultInvitationService,
        policy: AdultAccessPolicy,
    ) -> None:
        self.persistence = persistence
        self.invitations = invitations
        self.policy = policy

    async def connect(
        self, unit: StudentsTransaction, card: StudentCard, invitation: Invitation, account_id: UUID
    ) -> Connection:
        student = await unit.students.find_connection(card.id)

        if student is not None and student.account_id == account_id:
            raise StudentError("self_connection_forbidden")

        if await unit.accounts.activate_role(account_id, Role.ADULT) is None:
            raise StudentError("authentication_required")

        invitation.require_for(card, self.invitations.clock())
        self.policy.require_connection_space(await unit.adults.count_connections(card.id))

        if await unit.adults.find_connection(card.id, account_id) is not None:
            raise StudentError("adult_already_connected")

        if not await unit.adults.consume_invitation(invitation.id):
            raise StudentError("invitation_invalid")

        connection = Connection(card.id, card.teacher_id, account_id)

        await unit.adults.add_connection(connection)
        await assign_initial_responsibility(unit, card.id, account_id, self.invitations.clock())

        return connection

    async def accept(self, actor: Principal, token: str, ip: str) -> Connection:
        await self.invitations.requests.access(ip)

        async with self.persistence.transaction() as unit:
            card, invitation = await self.invitations.get_active(unit, token)

            return await self.connect(unit, card, invitation, actor.account_id)

    async def disconnect(self, actor: Actor, card_id: UUID) -> None:
        async with self.persistence.transaction() as unit:
            card = await connected_adult_card(unit, actor, card_id)

            await unit.accounts.lock_profile(actor.account_id, Role.ADULT)
            await unit.adults.delete_connection(card.id, actor.account_id)

    async def disconnect_owned(self, actor: Actor, card_id: UUID, account_id: UUID) -> None:
        async with self.persistence.transaction() as unit:
            card = await owned_card(unit.students, actor, card_id)

            if await unit.adults.find_connection(card.id, account_id) is None:
                raise StudentError("adult_connection_not_found")

            await unit.accounts.lock_profile(account_id, Role.ADULT)
            await unit.adults.delete_connection(card.id, account_id)

    async def adults(self, actor: Actor, card_id: UUID) -> list[PublicProfile]:
        async with self.persistence.transaction() as unit:
            card = await owned_card(unit.students, actor, card_id, lock=False)
            connections = await unit.adults.list_connections(card.id)
            profiles = await unit.accounts.profiles([item.account_id for item in connections])

            return [
                profiles[item.account_id] for item in connections if item.account_id in profiles
            ]

    async def students(self, actor: Actor, after_id: UUID | None, limit: int) -> list[AdultStudent]:
        require_adult(actor)
        require_page_size(limit)

        async with self.persistence.transaction() as unit:
            cards = await unit.adults.list_student_cards(actor.account_id, after_id, limit + 1)
            teachers = await unit.accounts.profiles([card.teacher_id for card in cards])

        return [
            AdultStudent(
                card.id,
                card.name,
                card.teacher_id,
                teachers[card.teacher_id].display_name if card.teacher_id in teachers else None,
                card.archived,
            )
            for card in cards
        ]

    async def profiles(
        self, actor: Actor, card_id: UUID, after_id: UUID | None, limit: int
    ) -> list[AdultLearningProfile]:
        require_adult(actor)
        require_page_size(limit)

        async with self.persistence.transaction() as unit:
            await connected_adult_card(unit, actor, card_id)

            return await unit.adults.list_learning_profiles(card_id, after_id, limit + 1)
