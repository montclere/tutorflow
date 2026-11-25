"""Сценарии карточек, архива, удаления и разрешённого профиля."""

from dataclasses import replace
from uuid import UUID

from app.modules.identity.public import Actor, PublicProfile
from app.modules.students.application.contracts import CardDetails
from app.modules.students.application.ports import StudentsUnitOfWork
from app.modules.students.application.services.access import (
    owned_card,
    require_page_size,
    require_teacher,
)
from app.modules.students.domain.entities import StudentCard
from app.modules.students.domain.exceptions import StudentError


class CardService:
    def __init__(self, persistence: StudentsUnitOfWork) -> None:
        self.persistence = persistence

    async def create(self, actor: Actor, name: str, notes: str | None) -> CardDetails:
        require_teacher(actor)

        card = StudentCard.create(actor.account_id, name, notes)

        async with self.persistence.transaction() as unit:
            await unit.students.add_card(card)

        return CardDetails(card, None)

    async def get(self, actor: Actor, card_id: UUID) -> CardDetails:
        async with self.persistence.transaction() as unit:
            card = await owned_card(unit.students, actor, card_id, lock=False)
            connection = await unit.students.find_connection(card.id)

        return CardDetails(card, connection.account_id if connection else None)

    async def list(
        self, actor: Actor, include_archived: bool, after_id: UUID | None, limit: int
    ) -> list[CardDetails]:
        require_teacher(actor)
        require_page_size(limit)

        async with self.persistence.transaction() as unit:
            return await unit.students.list_cards(
                actor.account_id, include_archived, after_id, limit + 1
            )

    async def update(
        self, actor: Actor, card_id: UUID, fields: dict[str, str | None]
    ) -> CardDetails:
        async with self.persistence.transaction() as unit:
            card = (await owned_card(unit.students, actor, card_id)).change(fields)

            await unit.students.save_card(card)

            connection = await unit.students.find_connection(card.id)

        return CardDetails(card, connection.account_id if connection else None)

    async def archive(self, actor: Actor, card_id: UUID, archived: bool) -> CardDetails:
        async with self.persistence.transaction() as unit:
            card = replace(await owned_card(unit.students, actor, card_id), archived=archived)

            await unit.students.save_card(card)

            if archived:
                await unit.students.revoke_invitation(card.id)

            connection = await unit.students.find_connection(card.id)

        return CardDetails(card, connection.account_id if connection else None)

    async def delete(self, actor: Actor, card_id: UUID) -> None:
        async with self.persistence.transaction() as unit:
            card = await owned_card(unit.students, actor, card_id)

            await unit.students.delete_card(card.id)

    async def account_profile(self, actor: Actor, card_id: UUID) -> PublicProfile:
        async with self.persistence.transaction() as unit:
            card = await owned_card(unit.students, actor, card_id)
            connection = await unit.students.find_connection(card.id)

            if connection is None:
                raise StudentError("student_connection_not_found")

            profile = await unit.accounts.profile(connection.account_id)

            if profile is None:
                raise StudentError("student_connection_not_found")

            return profile
