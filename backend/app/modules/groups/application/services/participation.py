"""Безопасный обзор групп только собственной подключённой карточки."""

from uuid import UUID

from app.modules.groups.application.contracts import Participation
from app.modules.groups.application.ports import GroupsUnitOfWork
from app.modules.groups.application.services.access import require_page_size
from app.modules.groups.domain.exceptions import GroupError
from app.modules.identity.public import Actor, Role


class ParticipationService:
    def __init__(self, persistence: GroupsUnitOfWork) -> None:
        self.persistence = persistence

    async def list(
        self, actor: Actor, card_id: UUID, after_id: UUID | None, limit: int
    ) -> list[Participation]:
        require_page_size(limit)

        async with self.persistence.transaction() as unit:
            if (
                actor.role not in {Role.STUDENT, Role.ADULT}
                or await unit.cards.find_accessible(card_id, actor) is None
            ):
                raise GroupError("student_card_not_found")

            return await unit.groups.participations(card_id, after_id, limit + 1)

    async def get(self, actor: Actor, card_id: UUID, group_id: UUID) -> Participation:
        async with self.persistence.transaction() as unit:
            if (
                actor.role not in {Role.STUDENT, Role.ADULT}
                or await unit.cards.find_accessible(card_id, actor) is None
            ):
                raise GroupError("student_card_not_found")

            result = await unit.groups.find_participation(card_id, group_id)

            if result is None:
                raise GroupError("group_not_found")

            return result
