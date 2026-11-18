from dataclasses import asdict
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, delete, insert, select, tuple_, update
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.shared.application.contracts.accounts import AccountSummary
from app.shared.infrastructure.db.unit_of_work import PostgresRepository

from ..domain.accounts import Account, AccountProfile, Challenge, Contact, Session
from .models import accounts, challenges, profiles, sessions, teacher_cabinets


def fields(table, record) -> list[Column]:
    return [table.c[name] for name in record.__dataclass_fields__]


class PostgresIdentity(PostgresRepository):
    async def find_account(self, contact: Contact, *, lock: bool = False) -> Account | None:
        query = select(*fields(accounts, Account)).where(
            accounts.c.login_contact_type == contact.type,
            accounts.c.normalized_login_contact == contact.value,
        )
        row = await self.row(query.with_for_update() if lock else query)
        return Account(**row) if row else None

    async def get_account(self, account_id: UUID, *, lock: bool = False) -> Account | None:
        query = select(*fields(accounts, Account)).where(accounts.c.account_id == account_id)
        row = await self.row(query.with_for_update() if lock else query)
        return Account(**row) if row else None

    async def lookup_account(self, account_id: UUID) -> AccountSummary | None:
        account = accounts.c
        row = await self.row(
            select(
                account.account_id,
                account.status,
                account.login_contact_verified_at,
                profiles.c.display_name,
                teacher_cabinets.c.enabled_at,
            )
            .select_from(accounts.join(profiles).outerjoin(teacher_cabinets))
            .where(account.account_id == account_id)
        )
        if row is None:
            return None
        return AccountSummary(
            row["account_id"],
            row["display_name"],
            row["status"] == "active",
            row["login_contact_verified_at"] is not None,
            row["enabled_at"] is not None,
        )

    async def create_account(
        self, contact: Contact, password_hash: str, name: str, timezone: str, now: datetime
    ) -> Account | None:
        account = Account(uuid4(), "active", contact.type, contact.value, now, password_hash)
        statement = pg_insert(accounts).values(**asdict(account), created_at=now, updated_at=now)
        result = await self.db.execute(
            statement.on_conflict_do_nothing(
                index_elements=[accounts.c.login_contact_type, accounts.c.normalized_login_contact]
            ).returning(accounts.c.account_id)
        )
        if result.scalar_one_or_none() is None:
            return None
        await self.db.execute(
            insert(profiles).values(
                account_id=account.account_id,
                display_name=name,
                timezone=timezone,
                version=1,
                created_at=now,
                updated_at=now,
            )
        )
        return account

    async def set_password(self, account_id: UUID, password_hash: str, now: datetime) -> None:
        await self.db.execute(
            update(accounts)
            .where(accounts.c.account_id == account_id)
            .values(password_hash=password_hash, updated_at=now)
        )
        await self.clear_reset_challenges(account_id)

    async def get_profile(self, account_id: UUID) -> AccountProfile:
        row = await self.row(
            select(*fields(profiles, AccountProfile)).where(profiles.c.account_id == account_id)
        )
        assert row is not None
        return AccountProfile(**row)

    async def edit_profile(
        self, account_id: UUID, version: int, changes: dict, now: datetime
    ) -> AccountProfile | None:
        result = await self.db.execute(
            update(profiles)
            .where(profiles.c.account_id == account_id, profiles.c.version == version)
            .values(**changes, version=version + 1, updated_at=now)
            .returning(*fields(profiles, AccountProfile))
        )
        row = result.mappings().one_or_none()
        return AccountProfile(**row) if row else None

    async def enable_teacher(self, account_id: UUID, now: datetime) -> tuple[datetime, bool]:
        result = await self.db.execute(
            pg_insert(teacher_cabinets)
            .values(account_id=account_id, enabled_at=now)
            .on_conflict_do_nothing()
            .returning(teacher_cabinets.c.enabled_at)
        )
        enabled = result.scalar_one_or_none()
        if enabled is not None:
            return enabled, True
        existing = await self.db.scalar(
            select(teacher_cabinets.c.enabled_at).where(teacher_cabinets.c.account_id == account_id)
        )
        assert existing is not None
        return existing, False

    async def add_challenge(self, challenge: Challenge) -> None:
        await self.db.execute(insert(challenges).values(**asdict(challenge)))

    async def get_challenge(self, challenge_id: UUID, *, lock: bool = True) -> Challenge | None:
        query = select(challenges).where(challenges.c.challenge_id == challenge_id)
        row = await self.row(query.with_for_update() if lock else query)
        return Challenge(**row) if row else None

    async def fail_challenge(self, challenge: Challenge) -> None:
        await self.db.execute(
            update(challenges)
            .where(challenges.c.challenge_id == challenge.challenge_id)
            .values(failed_attempts=challenge.failed_attempts + 1)
        )

    async def consume_challenge(self, challenge_id: UUID) -> None:
        await self.db.execute(delete(challenges).where(challenges.c.challenge_id == challenge_id))

    async def clear_reset_challenges(self, account_id: UUID) -> None:
        await self.db.execute(
            delete(challenges).where(
                challenges.c.account_id == account_id, challenges.c.purpose == "password_reset"
            )
        )

    async def add_session(self, session: Session, token_digest: str) -> None:
        await self.db.execute(insert(sessions).values(**asdict(session), token_digest=token_digest))

    async def find_session(self, token_digest: str, now: datetime) -> Session | None:
        row = await self.row(
            select(*fields(sessions, Session)).where(
                sessions.c.token_digest == token_digest,
                sessions.c.expires_at > now,
                sessions.c.revoked_at.is_(None),
            )
        )
        return Session(**row) if row else None

    async def touch(self, session: Session, now: datetime) -> None:
        await self.db.execute(
            update(sessions)
            .where(
                sessions.c.session_id == session.session_id,
                sessions.c.last_seen_at < now,
                sessions.c.revoked_at.is_(None),
            )
            .values(last_seen_at=now)
        )

    async def revoke_session(
        self, session_id: UUID, account_id: UUID | None, now: datetime
    ) -> bool:
        result = await self.db.execute(
            update(sessions)
            .where(sessions.c.session_id == session_id, sessions.c.account_id == account_id)
            .values(revoked_at=now)
            .returning(sessions.c.session_id)
        )
        return result.scalar_one_or_none() is not None

    async def revoke_sessions(self, account_id: UUID, now: datetime) -> None:
        await self.db.execute(
            update(sessions)
            .where(sessions.c.account_id == account_id, sessions.c.revoked_at.is_(None))
            .values(revoked_at=now)
        )

    async def list_sessions(
        self,
        account_id: UUID,
        idle_since: datetime,
        now: datetime,
        limit: int,
        after: tuple[datetime, UUID] | None,
    ) -> list[Session]:
        c = sessions.c
        query = select(*fields(sessions, Session)).where(
            c.account_id == account_id,
            c.revoked_at.is_(None),
            c.expires_at > now,
            c.last_seen_at > idle_since,
        )
        if after:
            query = query.where(tuple_(c.created_at, c.session_id) < after)
        rows = await self.rows(
            query.order_by(c.created_at.desc(), c.session_id.desc()).limit(limit)
        )
        return [Session(**row) for row in rows]

    async def trim_sessions(self, account_id: UUID, now: datetime, maximum: int) -> None:
        c = sessions.c
        overflow = (
            select(c.session_id)
            .where(
                c.account_id == account_id,
                c.revoked_at.is_(None),
                c.expires_at > now,
            )
            .order_by(c.created_at.desc(), c.session_id.desc())
            .offset(maximum)
        )
        await self.db.execute(
            update(sessions).where(c.session_id.in_(overflow)).values(revoked_at=now)
        )
