"""PostgreSQL-репозиторий и транзакции Identity."""

from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import case, delete, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession as DatabaseSession

from app.modules.identity.application.ports import RegistrationDelivery
from app.modules.identity.domain.entities import Account, Registration, Session
from app.modules.identity.domain.values import Contact, ContactKind, Profile, Role
from app.modules.identity.infrastructure.persistence.models import Account as AccountRow
from app.modules.identity.infrastructure.persistence.models import LoginSession, RateWindow
from app.modules.identity.infrastructure.persistence.models import Registration as RegistrationRow
from app.modules.identity.public import PublicProfile


def to_account(row: AccountRow | None) -> Account | None:
    if row is None:
        return None

    return Account(
        row.id,
        Contact(ContactKind(row.contact_kind), row.contact),
        Role(row.role),
        row.password_hash,
        row.verified_at,
        Profile(row.display_name, row.timezone),
    )


class PostgresIdentityRepository:
    def __init__(self, db: DatabaseSession) -> None:
        self.db = db

    async def find_public_profile(self, account_id: UUID) -> PublicProfile | None:
        profiles = await self.list_public_profiles([account_id])

        return profiles[0] if profiles else None

    async def list_public_profiles(self, account_ids: list[UUID]) -> list[PublicProfile]:
        if not account_ids:
            return []

        rows = await self.db.execute(
            select(AccountRow.id, AccountRow.display_name, AccountRow.timezone).where(
                AccountRow.id.in_(account_ids)
            )
        )

        return [PublicProfile(row.id, row.display_name, row.timezone) for row in rows]

    async def find_student_profile_for_update(self, account_id: UUID) -> PublicProfile | None:
        row = (
            await self.db.execute(
                select(AccountRow.id, AccountRow.display_name, AccountRow.timezone)
                .where(AccountRow.id == account_id, AccountRow.role == Role.STUDENT)
                .with_for_update()
            )
        ).one_or_none()

        return PublicProfile(row.id, row.display_name, row.timezone) if row else None

    async def find_account_for_update(self, account_id: UUID) -> Account | None:
        row = await self.db.scalar(
            select(AccountRow).where(AccountRow.id == account_id).with_for_update()
        )

        return to_account(row)

    async def find_account_by_contact(self, contact: Contact) -> Account | None:
        return to_account(
            await self.db.scalar(
                select(AccountRow).where(
                    AccountRow.contact_kind == contact.kind, AccountRow.contact == contact.value
                )
            )
        )

    async def add_account(self, account: Account) -> bool:
        statement = (
            insert(AccountRow)
            .values(
                id=account.id,
                contact_kind=account.contact.kind,
                contact=account.contact.value,
                role=account.role,
                password_hash=account.password_hash,
                verified_at=account.verified_at,
            )
            .on_conflict_do_nothing(index_elements=[AccountRow.contact_kind, AccountRow.contact])
            .returning(AccountRow.id)
        )

        return await self.db.scalar(statement) is not None

    async def update_password_hash(self, account_id: UUID, digest: str) -> None:
        await self.db.execute(
            update(AccountRow).where(AccountRow.id == account_id).values(password_hash=digest)
        )

    async def save_registration(
        self,
        registration: Registration,
        cooldown_before: datetime,
        *,
        delivery_enabled: bool = True,
    ) -> UUID:
        values = {
            "id": registration.id,
            "role": registration.role,
            "invitation_id": registration.invitation_id,
            "code_digest": registration.code_digest,
            "sent_at": registration.sent_at,
            "expires_at": registration.expires_at,
            "remaining_attempts": registration.remaining_attempts,
            "delivery_due_at": registration.sent_at if delivery_enabled else None,
            "delivery_attempts": 0,
        }
        may_replace = RegistrationRow.sent_at <= cooldown_before
        updates = {
            name: case((may_replace, value), else_=getattr(RegistrationRow, name))
            for name, value in values.items()
        }
        statement = (
            insert(RegistrationRow)
            .values(
                contact_kind=registration.contact.kind, contact=registration.contact.value, **values
            )
            .on_conflict_do_update(
                index_elements=[RegistrationRow.contact_kind, RegistrationRow.contact],
                set_=updates,
            )
            .returning(RegistrationRow.id)
        )

        return (await self.db.execute(statement)).scalar_one()

    async def claim_registration_delivery(
        self, challenge_id: UUID | None, now: datetime, retry_delay: timedelta, max_attempts: int
    ) -> RegistrationDelivery | None:
        query = (
            select(RegistrationRow)
            .where(
                RegistrationRow.expires_at > now,
                RegistrationRow.delivery_due_at <= now,
                RegistrationRow.delivery_attempts < max_attempts,
                RegistrationRow.remaining_attempts > 0,
            )
            .order_by(RegistrationRow.delivery_due_at, RegistrationRow.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )

        if challenge_id is not None:
            query = query.where(RegistrationRow.id == challenge_id)

        row = await self.db.scalar(query)

        if row is None:
            return None

        row.delivery_attempts += 1
        row.delivery_due_at = now + retry_delay

        return RegistrationDelivery(
            row.id, Contact(ContactKind(row.contact_kind), row.contact), row.delivery_attempts
        )

    async def mark_registration_delivered(self, delivery: RegistrationDelivery) -> None:
        await self.db.execute(
            update(RegistrationRow)
            .where(
                RegistrationRow.id == delivery.challenge_id,
                RegistrationRow.delivery_attempts == delivery.attempt,
            )
            .values(delivery_due_at=None)
        )

    async def find_registration_for_update(self, registration_id: UUID) -> Registration | None:
        row = await self.db.scalar(
            select(RegistrationRow).where(RegistrationRow.id == registration_id).with_for_update()
        )

        if row is None:
            return None

        return Registration(
            row.id,
            Contact(ContactKind(row.contact_kind), row.contact),
            row.code_digest,
            row.sent_at,
            row.expires_at,
            row.remaining_attempts,
            Role(row.role),
            row.invitation_id,
        )

    async def save_attempts(self, registration: Registration) -> None:
        await self.db.execute(
            update(RegistrationRow)
            .where(RegistrationRow.id == registration.id)
            .values(remaining_attempts=registration.remaining_attempts)
        )

    async def remove_registration(self, registration_id: UUID) -> None:
        await self.db.execute(delete(RegistrationRow).where(RegistrationRow.id == registration_id))

    async def consume_rate_window(
        self, key: str, limit: int, now: datetime, reset_at: datetime
    ) -> bool:
        expired = RateWindow.reset_at <= now
        statement = (
            insert(RateWindow)
            .values(key=key, attempts=1, reset_at=reset_at)
            .on_conflict_do_update(
                index_elements=[RateWindow.key],
                set_={
                    "attempts": case((expired, 1), else_=RateWindow.attempts + 1),
                    "reset_at": case((expired, reset_at), else_=RateWindow.reset_at),
                },
                where=or_(expired, RateWindow.attempts < limit),
            )
            .returning(RateWindow.key)
        )

        return await self.db.scalar(statement) is not None

    async def add_session(self, session: Session) -> None:
        self.db.add(
            LoginSession(
                token_digest=session.token_digest,
                account_id=session.account_id,
                expires_at=session.expires_at,
            )
        )

    async def remove_session(self, digest: str) -> None:
        await self.db.execute(delete(LoginSession).where(LoginSession.token_digest == digest))

    async def find_account_by_session(self, digest: str, now: datetime) -> Account | None:
        return to_account(
            await self.db.scalar(
                select(AccountRow)
                .join(LoginSession, AccountRow.id == LoginSession.account_id)
                .where(LoginSession.token_digest == digest, LoginSession.expires_at > now)
            )
        )

    async def update_profile(
        self, account_id: UUID, changes: dict[str, str | None]
    ) -> Account | None:
        statement = (
            update(AccountRow)
            .where(AccountRow.id == account_id)
            .values(**changes)
            .returning(AccountRow)
        )

        return to_account(await self.db.scalar(statement))
