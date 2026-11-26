"""Общие интеграционные проекции доступа к карточкам Students."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.public import Actor
from app.modules.students.infrastructure.persistence.models import Connection, StudentCard
from app.modules.students.infrastructure.persistence.repository import PostgresStudentsRepository
from app.modules.students.public import CardReference


class PostgresCardAccess:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.students = PostgresStudentsRepository(db)

    async def find_owned(
        self, card_id: UUID, teacher_id: UUID, *, lock: bool
    ) -> CardReference | None:
        card = await self.students.find_card(card_id, teacher_id, lock=lock)

        return CardReference(card.id, card.teacher_id, card.name, card.archived) if card else None

    async def find_accessible(
        self, card_id: UUID, actor: Actor, *, include_archived: bool = False
    ) -> CardReference | None:
        row = await self.db.scalar(
            select(StudentCard)
            .join(Connection, Connection.card_id == StudentCard.id)
            .where(
                StudentCard.id == card_id,
                Connection.account_id == actor.account_id,
                Connection.role == actor.role,
            )
        )

        if row is None or row.archived and not include_archived:
            return None

        return CardReference(row.id, row.teacher_id, row.name, row.archived)

    async def names(self, card_ids: list[UUID]) -> dict[UUID, str]:
        if not card_ids:
            return {}

        rows = await self.db.execute(
            select(StudentCard.id, StudentCard.name).where(StudentCard.id.in_(card_ids))
        )

        return {card_id: name for card_id, name in rows}
