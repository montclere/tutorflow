"""Атомарное первоначальное назначение и явное переназначение ответственного."""

from collections.abc import Callable
from datetime import datetime
from uuid import UUID

from app.modules.identity.public import Actor
from app.modules.students.application.contracts import ResponsibilityAssignment
from app.modules.students.application.ports import StudentsTransaction, StudentsUnitOfWork
from app.modules.students.application.services.access import owned_card
from app.modules.students.domain.exceptions import StudentError
from app.modules.students.domain.responsibilities import Responsibility


async def assign_initial_responsibility(
    unit: StudentsTransaction, card_id: UUID, account_id: UUID, now: datetime
) -> None:
    assignment = Responsibility.initial(
        card_id, account_id, now, await unit.students.count_participants(card_id)
    )

    if assignment is not None:
        await unit.students.add_initial_responsibility(assignment)


class ResponsibilityService:
    def __init__(self, persistence: StudentsUnitOfWork, clock: Callable[[], datetime]) -> None:
        self.persistence = persistence
        self.clock = clock

    async def get(self, actor: Actor, card_id: UUID) -> ResponsibilityAssignment:
        async with self.persistence.transaction() as unit:
            await owned_card(unit.students, actor, card_id)

            assignment = await unit.students.find_responsibility(card_id)
            role = (
                await unit.students.find_participant_role(card_id, assignment.account_id)
                if assignment
                else None
            )

            return ResponsibilityAssignment(
                card_id, assignment.account_id if assignment else None, role
            )

    async def assign(
        self, actor: Actor, card_id: UUID, account_id: UUID
    ) -> ResponsibilityAssignment:
        async with self.persistence.transaction() as unit:
            await owned_card(unit.students, actor, card_id)

            role = await unit.students.find_participant_role(card_id, account_id)

            if role is None:
                raise StudentError("student_connection_not_found")

            await unit.students.set_responsibility(
                Responsibility(card_id, account_id, self.clock())
            )

            return ResponsibilityAssignment(card_id, account_id, role)
