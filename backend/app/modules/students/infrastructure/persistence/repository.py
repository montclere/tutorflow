"""Операции PostgreSQL над агрегатом карточки и его связями."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.students.application.contracts import CardDetails
from app.modules.students.domain.entities import (
    Connection,
    Invitation,
    LearningProfile,
    StudentCard,
)
from app.modules.students.domain.exceptions import StudentError
from app.modules.students.domain.values import Money
from app.modules.students.infrastructure.persistence.models import Connection as ConnectionRow
from app.modules.students.infrastructure.persistence.models import Invitation as InvitationRow
from app.modules.students.infrastructure.persistence.models import LearningProfile as ProfileRow
from app.modules.students.infrastructure.persistence.models import StudentCard as CardRow


def card_value(row: CardRow) -> StudentCard:
    return StudentCard(row.id, row.teacher_id, row.name, row.notes, row.archived)


def profile_value(row: ProfileRow) -> LearningProfile:
    return LearningProfile(
        row.id,
        row.card_id,
        Money(row.amount, row.currency),
        row.subject,
        row.level,
        row.goal,
        row.duration,
        row.description,
    )


def connection_value(row: ConnectionRow | None) -> Connection | None:
    return Connection(row.card_id, row.teacher_id, row.account_id) if row else None


class PostgresStudentsRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def add_card(self, card: StudentCard) -> None:
        self.db.add(
            CardRow(
                id=card.id,
                teacher_id=card.teacher_id,
                name=card.name,
                notes=card.notes,
                archived=card.archived,
            )
        )

        await self.db.flush()

    async def find_card(
        self, card_id: UUID, teacher_id: UUID | None = None, *, lock: bool = False
    ) -> StudentCard | None:
        query = select(CardRow).where(CardRow.id == card_id)

        if teacher_id is not None:
            query = query.where(CardRow.teacher_id == teacher_id)

        if lock:
            query = query.with_for_update()

        row = await self.db.scalar(query)

        return card_value(row) if row else None

    async def find_student_card(self, card_id: UUID, account_id: UUID) -> StudentCard | None:
        query = (
            select(CardRow)
            .join(ConnectionRow, ConnectionRow.card_id == CardRow.id)
            .where(
                CardRow.id == card_id,
                ConnectionRow.account_id == account_id,
                ConnectionRow.role == "student",
            )
            .with_for_update(of=CardRow)
        )
        row = await self.db.scalar(query)

        return card_value(row) if row else None

    async def save_card(self, card: StudentCard) -> None:
        await self.db.execute(
            update(CardRow)
            .where(CardRow.id == card.id)
            .values(name=card.name, notes=card.notes, archived=card.archived)
        )

    async def delete_card(self, card_id: UUID) -> None:
        await self.db.execute(delete(CardRow).where(CardRow.id == card_id))

    async def list_cards(
        self, teacher_id: UUID, include_archived: bool, after_id: UUID | None, limit: int
    ) -> list[CardDetails]:
        query = (
            select(CardRow, ConnectionRow.account_id)
            .outerjoin(
                ConnectionRow,
                and_(ConnectionRow.card_id == CardRow.id, ConnectionRow.role == "student"),
            )
            .where(CardRow.teacher_id == teacher_id)
        )

        if not include_archived:
            query = query.where(CardRow.archived.is_(False))

        if after_id is not None:
            query = query.where(CardRow.id > after_id)

        rows = await self.db.execute(query.order_by(CardRow.id).limit(limit))

        return [CardDetails(card_value(card), account_id) for card, account_id in rows]

    async def save_profile(self, profile: LearningProfile) -> None:
        values = {
            name: getattr(profile, name)
            for name in ("subject", "level", "goal", "duration", "description")
        }

        values.update(amount=profile.price.amount, currency=profile.price.currency)

        statement = insert(ProfileRow).values(id=profile.id, card_id=profile.card_id, **values)

        result = await self.db.scalar(
            statement.on_conflict_do_update(
                index_elements=[ProfileRow.id],
                set_=values,
                where=ProfileRow.card_id == profile.card_id,
            ).returning(ProfileRow.id)
        )

        if result is None:
            raise StudentError("student_profile_not_found")

    async def find_profile(self, card_id: UUID, profile_id: UUID) -> LearningProfile | None:
        row = await self.db.scalar(
            select(ProfileRow).where(ProfileRow.id == profile_id, ProfileRow.card_id == card_id)
        )

        return profile_value(row) if row else None

    async def list_profiles(
        self, card_id: UUID, after_id: UUID | None, limit: int
    ) -> list[LearningProfile]:
        query = select(ProfileRow).where(ProfileRow.card_id == card_id)

        if after_id is not None:
            query = query.where(ProfileRow.id > after_id)

        rows = await self.db.scalars(query.order_by(ProfileRow.id).limit(limit))

        return [profile_value(row) for row in rows]

    async def delete_profile(self, card_id: UUID, profile_id: UUID) -> bool:
        statement = (
            delete(ProfileRow)
            .where(ProfileRow.id == profile_id, ProfileRow.card_id == card_id)
            .returning(ProfileRow.id)
        )

        return await self.db.scalar(statement) is not None

    async def save_invitation(self, invitation: Invitation) -> None:
        values = {
            name: getattr(invitation, name)
            for name in ("id", "token_digest", "created_at", "expires_at", "welcome", "consumed_at")
        }
        statement = insert(InvitationRow).values(card_id=invitation.card_id, **values)

        await self.db.execute(
            statement.on_conflict_do_update(index_elements=[InvitationRow.card_id], set_=values)
        )

    async def find_invitation(self, digest: str) -> Invitation | None:
        row = await self.db.scalar(
            select(InvitationRow)
            .where(InvitationRow.token_digest == digest)
            .execution_options(populate_existing=True)
        )

        return (
            Invitation(
                row.id,
                row.card_id,
                row.token_digest,
                row.created_at,
                row.expires_at,
                row.welcome,
                row.consumed_at,
            )
            if row
            else None
        )

    async def revoke_invitation(self, card_id: UUID) -> None:
        await self.db.execute(delete(InvitationRow).where(InvitationRow.card_id == card_id))

    async def consume_invitation(self, invitation_id: UUID, now: datetime) -> bool:
        statement = (
            update(InvitationRow)
            .where(
                InvitationRow.id == invitation_id,
                InvitationRow.consumed_at.is_(None),
                InvitationRow.expires_at > func.clock_timestamp(),
            )
            .values(consumed_at=now)
            .returning(InvitationRow.id)
        )

        return await self.db.scalar(statement) is not None

    async def find_connection(self, card_id: UUID) -> Connection | None:
        return connection_value(
            await self.db.scalar(
                select(ConnectionRow).where(
                    ConnectionRow.card_id == card_id, ConnectionRow.role == "student"
                )
            )
        )

    async def find_teacher_connection(
        self, teacher_id: UUID, account_id: UUID
    ) -> Connection | None:
        return connection_value(
            await self.db.scalar(
                select(ConnectionRow).where(
                    ConnectionRow.teacher_id == teacher_id,
                    ConnectionRow.account_id == account_id,
                    ConnectionRow.role == "student",
                )
            )
        )

    async def add_connection(self, connection: Connection) -> None:
        self.db.add(
            ConnectionRow(
                card_id=connection.card_id,
                teacher_id=connection.teacher_id,
                account_id=connection.account_id,
                role="student",
                slot=0,
            )
        )

        await self.db.flush()

    async def delete_connection(self, card_id: UUID) -> None:
        await self.db.execute(
            delete(ConnectionRow).where(
                ConnectionRow.card_id == card_id, ConnectionRow.role == "student"
            )
        )

    async def list_connections(
        self, account_id: UUID, after_id: UUID | None, limit: int
    ) -> list[tuple[Connection, bool]]:
        query = (
            select(ConnectionRow, CardRow.archived)
            .join(CardRow, CardRow.id == ConnectionRow.card_id)
            .where(ConnectionRow.account_id == account_id, ConnectionRow.role == "student")
        )

        if after_id is not None:
            query = query.where(ConnectionRow.card_id > after_id)

        rows = await self.db.execute(query.order_by(ConnectionRow.card_id).limit(limit))

        return [
            (Connection(row.card_id, row.teacher_id, row.account_id), archived)
            for row, archived in rows
        ]
