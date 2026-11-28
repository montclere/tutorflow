"""Создание детского аккаунта и передача управления через карточку."""

from collections.abc import Callable
from datetime import datetime
from uuid import UUID

from app.modules.identity.public import Actor, ChildCredentials, ChildManagement
from app.modules.students.application.contracts import ChildAccountStatus
from app.modules.students.application.ports import StudentsTransaction, StudentsUnitOfWork
from app.modules.students.application.services.access import connected_adult_card, require_adult
from app.modules.students.application.services.responsibilities import assign_initial_responsibility
from app.modules.students.domain.entities import Connection
from app.modules.students.domain.exceptions import StudentError


async def connected_child(unit: StudentsTransaction, actor: Actor, card_id: UUID) -> Connection:
    card = await connected_adult_card(unit, actor, card_id)

    card.require_active()

    connection = await unit.students.find_connection(card.id)

    if connection is None:
        raise StudentError("student_connection_not_found")

    return connection


class ChildAccountService:
    def __init__(self, persistence: StudentsUnitOfWork, clock: Callable[[], datetime]) -> None:
        self.persistence = persistence
        self.clock = clock

    async def status(self, actor: Actor, card_id: UUID) -> ChildAccountStatus:
        async with self.persistence.transaction() as unit:
            card = await connected_adult_card(unit, actor, card_id)
            connection = await unit.students.find_connection(card.id)

            if connection is None:
                return ChildAccountStatus(not card.archived, None, [])

            management = await unit.accounts.get_child_management(connection.account_id)

            if management is None or actor.account_id not in (
                management.manager_id,
                management.pending_manager_id,
            ):
                return ChildAccountStatus(False, None, [])

            targets = []

            if management.manager_id == actor.account_id and not card.archived:
                connections = await unit.adults.list_connections(card.id)
                profiles = await unit.accounts.profiles(
                    [item.account_id for item in connections if item.account_id != actor.account_id]
                )
                targets = list(profiles.values())

            return ChildAccountStatus(False, management, targets)

    async def create(self, actor: Actor, card_id: UUID) -> ChildCredentials:
        async with self.persistence.transaction() as unit:
            card = await connected_adult_card(unit, actor, card_id)

            card.require_active()

            if await unit.students.find_connection(card.id) is not None:
                raise StudentError("student_already_connected")

            credentials = await unit.accounts.create_child(actor.account_id)
            connection = Connection(card.id, card.teacher_id, credentials.account_id)

            await unit.students.add_connection(connection)
            await unit.students.revoke_invitation(card.id)
            await assign_initial_responsibility(unit, card.id, credentials.account_id, self.clock())

            return credentials

    async def request_transfer(self, actor: Actor, card_id: UUID, target_id: UUID) -> None:
        async with self.persistence.transaction() as unit:
            child = await connected_child(unit, actor, card_id)

            if await unit.adults.find_connection(card_id, target_id) is None:
                raise StudentError("adult_connection_not_found")

            await unit.accounts.request_child_transfer(
                child.account_id, actor.account_id, target_id
            )

    async def accept_transfer(self, actor: Actor, card_id: UUID) -> ChildCredentials:
        async with self.persistence.transaction() as unit:
            child = await connected_child(unit, actor, card_id)

            return await unit.accounts.accept_child_transfer(child.account_id, actor.account_id)

    async def reset_password(self, actor: Actor, child_id: UUID) -> ChildCredentials:
        require_adult(actor)

        async with self.persistence.transaction() as unit:
            return await unit.accounts.reset_child_password(child_id, actor.account_id)

    async def list_managed(self, actor: Actor) -> list[ChildManagement]:
        require_adult(actor)

        async with self.persistence.transaction() as unit:
            return await unit.accounts.list_managed_children(actor.account_id)

    async def cancel_transfer(self, actor: Actor, child_id: UUID) -> None:
        require_adult(actor)

        async with self.persistence.transaction() as unit:
            await unit.accounts.cancel_child_transfer(child_id, actor.account_id)

    async def release(self, actor: Actor, child_id: UUID) -> None:
        require_adult(actor)

        async with self.persistence.transaction() as unit:
            await unit.accounts.release_child(child_id, actor.account_id)
