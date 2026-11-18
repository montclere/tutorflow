from dataclasses import asdict
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, Select, insert, select, tuple_, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.application.ports.clock import now_utc
from app.shared.infrastructure.db.unit_of_work import PostgresRepository

from ...application.ports import Position
from ...domain.student import Invitation, ParentAccess, StudentCard
from .models import audit_events, invitations, parent_access, student_cards


def fields(table, record) -> list[Column]:
    return [table.c[name] for name in record.__dataclass_fields__]


def page(query: Select, time: Column, key: Column, limit: int, after: Position | None) -> Select:
    if after:
        query = query.where(tuple_(time, key) < after)
    return query.order_by(time.desc(), key.desc()).limit(limit)


class PostgresStudents(PostgresRepository):
    def __init__(self, db: AsyncSession, request_id: UUID):
        super().__init__(db)
        self.request_id = request_id

    async def add_invitation(self, invitation: Invitation, token_digest: str) -> None:
        await self.db.execute(
            insert(invitations).values(**asdict(invitation), token_digest=token_digest)
        )

    async def invitation_by_token(self, token_digest: str, *, lock: bool) -> Invitation | None:
        return await self._invitation(invitations.c.token_digest == token_digest, lock)

    async def invitation_by_id(self, invitation_id: UUID, *, lock: bool) -> Invitation | None:
        return await self._invitation(invitations.c.invitation_id == invitation_id, lock)

    async def _invitation(self, condition, lock: bool) -> Invitation | None:
        query = select(*fields(invitations, Invitation)).where(condition)
        row = await self.row(query.with_for_update() if lock else query)
        return Invitation(**row) if row else None

    async def list_invitations(
        self, owner: UUID, limit: int, after: Position | None
    ) -> list[Invitation]:
        c = invitations.c
        query = select(*fields(invitations, Invitation)).where(c.teacher_account_id == owner)
        rows = await self.rows(page(query, c.created_at, c.invitation_id, limit, after))
        return [Invitation(**row) for row in rows]

    async def revoke_invitation(self, invitation_id: UUID, now: datetime) -> None:
        await self.db.execute(
            update(invitations)
            .where(invitations.c.invitation_id == invitation_id)
            .values(revoked_at=now)
        )

    async def accept_invitation(
        self,
        invitation: Invitation,
        account_id: UUID,
        card_id: UUID,
        now: datetime,
        payload_digest: str,
    ) -> None:
        await self.db.execute(
            update(invitations)
            .where(invitations.c.invitation_id == invitation.invitation_id)
            .values(
                accepted_at=now,
                accepted_by_account_id=account_id,
                created_student_card_id=card_id,
                acceptance_payload_digest=payload_digest,
            )
        )

    async def add_card(self, card: StudentCard) -> bool:
        statement = (
            pg_insert(student_cards)
            .values(**asdict(card))
            .on_conflict_do_nothing(constraint="uq_student_teacher_account")
            .returning(student_cards.c.student_card_id)
        )
        return (await self.db.execute(statement)).scalar_one_or_none() is not None

    async def get_card(self, card_id: UUID, *, lock: bool = False) -> StudentCard | None:
        query = select(student_cards).where(student_cards.c.student_card_id == card_id)
        row = await self.row(query.with_for_update() if lock else query)
        return StudentCard(**row) if row else None

    async def list_cards(
        self, actor: UUID, role: str, status: str, limit: int, after: Position | None
    ) -> list[tuple[StudentCard, UUID | None]]:
        c = student_cards.c
        query = select(student_cards).where(c.status == status)
        if role == "teacher":
            query = query.where(c.teacher_account_id == actor)
        elif role == "student":
            query = query.where(c.student_account_id == actor)
        else:
            p = parent_access.c
            query = (
                query.add_columns(p.parent_access_id)
                .join(parent_access)
                .where(p.parent_account_id == actor, p.revoked_at.is_(None))
            )
        rows = await self.rows(page(query, c.updated_at, c.student_card_id, limit, after))
        return [
            (StudentCard(**row), access)
            for row in rows
            for access in [row.pop("parent_access_id", None)]
        ]

    async def update_card(self, card_id: UUID, changes: dict) -> StudentCard:
        result = await self.db.execute(
            update(student_cards)
            .where(student_cards.c.student_card_id == card_id)
            .values(**changes)
            .returning(*student_cards.c)
        )
        return StudentCard(**result.mappings().one())

    async def add_parent_access(self, access: ParentAccess) -> None:
        await self.db.execute(insert(parent_access).values(**asdict(access)))

    async def parent_access_for(self, card_id: UUID, parent: UUID) -> ParentAccess | None:
        c = parent_access.c
        row = await self.row(
            select(parent_access).where(c.student_card_id == card_id, c.parent_account_id == parent)
        )
        return ParentAccess(**row) if row else None

    async def parent_access_by_id(self, access_id: UUID) -> ParentAccess | None:
        row = await self.row(
            select(parent_access).where(parent_access.c.parent_access_id == access_id)
        )
        return ParentAccess(**row) if row else None

    async def list_parent_access(
        self, card_id: UUID, limit: int, after: Position | None
    ) -> list[ParentAccess]:
        c = parent_access.c
        query = select(parent_access).where(c.student_card_id == card_id)
        rows = await self.rows(page(query, c.created_at, c.parent_access_id, limit, after))
        return [ParentAccess(**row) for row in rows]

    async def revoke_parent_access(self, access_id: UUID, now: datetime) -> bool:
        c = parent_access.c
        result = await self.db.execute(
            update(parent_access)
            .where(c.parent_access_id == access_id, c.revoked_at.is_(None))
            .values(revoked_at=now)
            .returning(c.parent_access_id)
        )
        return result.scalar_one_or_none() is not None

    async def revoke_all_parent_access(self, card_id: UUID, now: datetime) -> list[UUID]:
        c = parent_access.c
        result = await self.db.execute(
            update(parent_access)
            .where(c.student_card_id == card_id, c.revoked_at.is_(None))
            .values(revoked_at=now)
            .returning(c.parent_access_id)
        )
        return list(result.scalars())

    async def audit(self, actor: UUID, action: str, kind: str, object_id: UUID) -> None:
        await self.db.execute(
            insert(audit_events).values(
                event_id=uuid4(),
                actor_account_id=actor,
                action=action,
                object_kind=kind,
                object_id=object_id,
                outcome="success",
                request_id=self.request_id,
                occurred_at=now_utc(),
            )
        )
