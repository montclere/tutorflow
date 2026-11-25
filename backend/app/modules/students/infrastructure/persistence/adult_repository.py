"""PostgreSQL-хранилище ограниченного доступа взрослых к карточкам."""

from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.students.application.contracts import AdultLearningProfile, StudentCardSummary
from app.modules.students.domain.entities import Connection, Invitation, StudentCard
from app.modules.students.domain.exceptions import StudentError
from app.modules.students.domain.values import MAX_ADULT_CONNECTIONS, Money
from app.modules.students.infrastructure.persistence.adult_models import (
    AdultConnection,
    AdultInvitation,
)
from app.modules.students.infrastructure.persistence.models import LearningProfile
from app.modules.students.infrastructure.persistence.models import StudentCard as CardRow
from app.modules.students.infrastructure.persistence.repository import card_value


def invitation_value(row: AdultInvitation) -> Invitation:
    return Invitation(
        row.id, row.card_id, row.token_digest, row.created_at, row.expires_at, row.welcome, None
    )


def connection_value(row: AdultConnection) -> Connection:
    return Connection(row.card_id, row.teacher_id, row.account_id)


class PostgresAdultAccessRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def available_slot(
        self, model: type[AdultConnection] | type[AdultInvitation], card_id: UUID
    ) -> int:
        occupied = set(await self.db.scalars(select(model.slot).where(model.card_id == card_id)))
        slot = next(
            (value for value in range(1, MAX_ADULT_CONNECTIONS + 1) if value not in occupied), None
        )

        if slot is None:
            raise StudentError("adult_limit_reached")

        return slot

    async def count_connections(self, card_id: UUID) -> int:
        return (
            await self.db.scalar(
                select(func.count())
                .select_from(AdultConnection)
                .where(AdultConnection.card_id == card_id)
            )
        ) or 0

    async def add_connection(self, connection: Connection) -> None:
        slot = await self.available_slot(AdultConnection, connection.card_id)

        self.db.add(
            AdultConnection(
                card_id=connection.card_id,
                teacher_id=connection.teacher_id,
                account_id=connection.account_id,
                slot=slot,
            )
        )
        await self.db.flush()

    async def find_connection(self, card_id: UUID, account_id: UUID) -> Connection | None:
        row = await self.db.get(AdultConnection, (card_id, account_id))

        return connection_value(row) if row else None

    async def list_connections(self, card_id: UUID) -> list[Connection]:
        rows = await self.db.scalars(
            select(AdultConnection)
            .where(AdultConnection.card_id == card_id)
            .order_by(AdultConnection.account_id)
        )

        return [connection_value(row) for row in rows]

    async def find_card_for_update(self, card_id: UUID, account_id: UUID) -> StudentCard | None:
        row = await self.db.scalar(
            select(CardRow)
            .join(AdultConnection, AdultConnection.card_id == CardRow.id)
            .where(CardRow.id == card_id, AdultConnection.account_id == account_id)
            .with_for_update(of=CardRow)
        )

        return card_value(row) if row else None

    async def delete_connection(self, card_id: UUID, account_id: UUID) -> bool:
        statement = (
            delete(AdultConnection)
            .where(AdultConnection.card_id == card_id, AdultConnection.account_id == account_id)
            .returning(AdultConnection.card_id)
        )

        return await self.db.scalar(statement) is not None

    async def list_student_cards(
        self, account_id: UUID, after_id: UUID | None, limit: int
    ) -> list[StudentCardSummary]:
        query = (
            select(CardRow.id, CardRow.teacher_id, CardRow.name, CardRow.archived)
            .join(AdultConnection, AdultConnection.card_id == CardRow.id)
            .where(AdultConnection.account_id == account_id)
        )

        if after_id is not None:
            query = query.where(CardRow.id > after_id)

        rows = await self.db.execute(query.order_by(CardRow.id).limit(limit))

        return [StudentCardSummary(row.id, row.teacher_id, row.name, row.archived) for row in rows]

    async def list_learning_profiles(
        self, card_id: UUID, after_id: UUID | None, limit: int
    ) -> list[AdultLearningProfile]:
        query = select(
            LearningProfile.id,
            LearningProfile.subject,
            LearningProfile.amount,
            LearningProfile.currency,
        ).where(LearningProfile.card_id == card_id)

        if after_id is not None:
            query = query.where(LearningProfile.id > after_id)

        rows = await self.db.execute(query.order_by(LearningProfile.id).limit(limit))

        return [
            AdultLearningProfile(row.id, row.subject, Money(row.amount, row.currency))
            for row in rows
        ]

    async def purge_expired_invitations(self, card_id: UUID) -> None:
        await self.db.execute(
            delete(AdultInvitation).where(
                AdultInvitation.card_id == card_id,
                AdultInvitation.expires_at <= func.clock_timestamp(),
            )
        )

    async def list_invitations(self, card_id: UUID) -> list[Invitation]:
        rows = await self.db.scalars(
            select(AdultInvitation)
            .where(
                AdultInvitation.card_id == card_id,
                AdultInvitation.expires_at > func.clock_timestamp(),
            )
            .order_by(AdultInvitation.id)
        )

        return [invitation_value(row) for row in rows]

    async def save_invitation(self, invitation: Invitation) -> None:
        slot = await self.available_slot(AdultInvitation, invitation.card_id)

        self.db.add(
            AdultInvitation(
                id=invitation.id,
                card_id=invitation.card_id,
                slot=slot,
                token_digest=invitation.token_digest,
                created_at=invitation.created_at,
                expires_at=invitation.expires_at,
                welcome=invitation.welcome,
            )
        )
        await self.db.flush()

    async def find_invitation(self, digest: str) -> Invitation | None:
        row = await self.db.scalar(
            select(AdultInvitation)
            .where(AdultInvitation.token_digest == digest)
            .execution_options(populate_existing=True)
        )

        return invitation_value(row) if row else None

    async def find_card_invitation(self, card_id: UUID, invitation_id: UUID) -> Invitation | None:
        row = await self.db.scalar(
            select(AdultInvitation).where(
                AdultInvitation.id == invitation_id, AdultInvitation.card_id == card_id
            )
        )

        return invitation_value(row) if row else None

    async def revoke_invitation(self, card_id: UUID, invitation_id: UUID) -> None:
        await self.db.execute(
            delete(AdultInvitation).where(
                AdultInvitation.card_id == card_id, AdultInvitation.id == invitation_id
            )
        )

    async def revoke_invitations(self, card_id: UUID) -> None:
        await self.db.execute(delete(AdultInvitation).where(AdultInvitation.card_id == card_id))

    async def consume_invitation(self, invitation_id: UUID) -> bool:
        statement = (
            delete(AdultInvitation)
            .where(
                AdultInvitation.id == invitation_id,
                AdultInvitation.expires_at > func.clock_timestamp(),
            )
            .returning(AdultInvitation.id)
        )

        return await self.db.scalar(statement) is not None
