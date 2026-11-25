"""Проверяет обновление заполненной схемы и пакетную очистку Identity."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from prometheus_client.parser import text_string_to_metric_families
from scripts.maintenance import Maintenance, main
from sqlalchemy import delete, insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession as Session
from tests.postgres_testkit import check_schema, migrate, migrated_schema, postgres_cluster

from app.composition import build_services
from app.main import create_app
from app.modules.identity.domain.values import Contact
from app.modules.identity.infrastructure.persistence.models import (
    Account,
    LoginSession,
    RateWindow,
    Registration,
)
from app.modules.identity.infrastructure.persistence.retention import IdentityRetention
from app.modules.scheduling.infrastructure.models import BlockRequest, CalendarBlock
from app.modules.scheduling.infrastructure.repository import PostgresCalendarRepository
from app.shared.infrastructure.metrics import MaintenanceMetrics


pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend():
    return "asyncio"


class InactiveDelivery:
    async def send(self, contact: Contact, code: str) -> None:
        raise AssertionError("Доставка не требуется для проверки готовности")


async def test_upgrade_preserves_data_and_enforces_workspace_ownership():
    now = datetime.now(UTC)
    owner_id, block_id = (uuid4(), uuid4())
    values = dict(
        id=block_id, owner_id=owner_id, starts_at=now, timezone="UTC", duration_minutes=45
    )

    async with postgres_cluster() as cluster:
        async with migrated_schema(cluster, "0002") as engine:
            async with Session(engine) as db:
                async with db.begin():
                    await db.execute(
                        insert(Account).values(
                            id=owner_id,
                            contact_kind="email",
                            contact="teacher@example.com",
                            verified_at=now,
                            password_hash="old-hash",
                            role="teacher",
                        )
                    )
                    await db.execute(insert(CalendarBlock).values(**values))
                    await db.execute(
                        insert(LoginSession).values(
                            token_digest="old-session",
                            account_id=owner_id,
                            expires_at=now + timedelta(days=1),
                        )
                    )

            app = create_app(
                await build_services(engine, b"x" * 32, InactiveDelivery(), secure_cookie=True)
            )

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="https://test"
            ) as client:
                assert (await client.get("/health")).status_code == 200
                assert (await client.get("/ready")).status_code == 503
                await migrate(engine, "head")
                await check_schema(engine)
                assert (await client.get("/ready")).status_code == 200

            async with Session(engine) as db:
                account = await db.get(Account, owner_id)
                block = await db.get(CalendarBlock, block_id)
                session = await db.get(LoginSession, "old-session")

                assert account is not None and account.contact == "teacher@example.com"
                assert block is not None and block.duration_minutes == 45
                assert session is not None and session.account_id == owner_id

            for change in ({"owner_id": uuid4()}, {"duration_minutes": 0}):
                with pytest.raises(IntegrityError):
                    async with Session(engine) as db:
                        async with db.begin():
                            await db.execute(
                                insert(CalendarBlock).values(**{**values, **change, "id": uuid4()})
                            )

            async with Session(engine) as db:
                async with db.begin():
                    await db.execute(
                        insert(BlockRequest).values(
                            id=block_id, owner_id=owner_id, fingerprint="old"
                        )
                    )
                    await db.execute(delete(Account).where(Account.id == owner_id))

            async with Session(engine) as db:
                assert await db.get(CalendarBlock, block_id) is None
                assert await db.get(BlockRequest, block_id) is None
                assert await db.get(LoginSession, "old-session") is None


async def test_purge_batches_expired_rows_and_preserves_live_records():
    now = datetime.now(UTC)
    owner_id = uuid4()

    async with postgres_cluster() as cluster:
        async with migrated_schema(cluster) as engine:
            async with Session(engine) as db:
                async with db.begin():
                    await db.execute(
                        insert(Account).values(
                            id=owner_id,
                            contact_kind="email",
                            contact="teacher@example.com",
                            verified_at=now,
                            password_hash="old-hash",
                            role="teacher",
                        )
                    )

                    for name, expiry in (
                        ("old", now - timedelta(minutes=2)),
                        ("boundary", now),
                        ("live", now + timedelta(minutes=2)),
                    ):
                        await db.execute(
                            insert(Registration).values(
                                id=uuid4(),
                                contact_kind="email",
                                contact=f"{name}@example.com",
                                code_digest=name,
                                sent_at=now - timedelta(minutes=15),
                                expires_at=expiry,
                                remaining_attempts=5,
                            )
                        )
                        await db.execute(
                            insert(LoginSession).values(
                                token_digest=name, account_id=owner_id, expires_at=expiry
                            )
                        )
                        await db.execute(
                            insert(RateWindow).values(key=name, reset_at=expiry, attempts=1)
                        )
                        await db.execute(
                            insert(BlockRequest).values(
                                id=uuid4(), owner_id=owner_id, fingerprint=name, expires_at=expiry
                            )
                        )

            retention = IdentityRetention(engine)
            calendar = PostgresCalendarRepository(engine)

            for _ in range(2):
                removed = await retention.purge_expired(now, limit=1)

                assert (removed.registrations, removed.sessions, removed.rate_windows) == (1, 1, 1)
                assert await calendar.purge_expired_requests(now, limit=1) == 1

            removed = await retention.purge_expired(now, limit=1)

            assert (removed.registrations, removed.sessions, removed.rate_windows) == (0, 0, 0)
            assert await calendar.purge_expired_requests(now, limit=1) == 0

            async with Session(engine) as db:
                assert (await db.scalars(select(Registration.contact))).all() == [
                    "live@example.com"
                ]
                assert (await db.scalars(select(LoginSession.token_digest))).all() == ["live"]
                assert (await db.scalars(select(RateWindow.key))).all() == ["live"]
                assert (await db.scalars(select(BlockRequest.fingerprint))).all() == ["live"]


async def test_maintenance_exports_success_and_preserves_it_on_failure(tmp_path, monkeypatch):
    async with postgres_cluster() as cluster:
        async with migrated_schema(cluster) as engine:
            services = await build_services(
                engine, b"x" * 32, InactiveDelivery(), secure_cookie=True
            )
            metrics = MaintenanceMetrics(tmp_path)

            await Maintenance(services, metrics).run()

            success = (tmp_path / "maintenance-success.prom").read_text()

            assert "tutorflow_maintenance_last_success_unixtime" in success

            snapshot = (tmp_path / "maintenance-attempt.prom").read_text()

            assert "tutorflow_maintenance_success 1.0" in snapshot
            list(text_string_to_metric_families(snapshot))
            monkeypatch.setenv("TUTORFLOW_METRICS_DIRECTORY", str(tmp_path))
            monkeypatch.setenv("IDENTITY_SECRET", "")
            assert await main() == 1
            assert (tmp_path / "maintenance-success.prom").read_text() == success
            assert (
                "tutorflow_maintenance_success 0.0"
                in (tmp_path / "maintenance-attempt.prom").read_text()
            )


async def test_identity_constraints_upgrade_preserves_existing_records():
    now = datetime.now(UTC)
    identifier = uuid4()

    async with postgres_cluster() as cluster, migrated_schema(cluster, "0003") as engine:
        async with Session(engine) as db, db.begin():
            await db.execute(
                insert(Registration).values(
                    id=identifier,
                    contact_kind="email",
                    contact="existing@example.com",
                    code_digest="old",
                    sent_at=now,
                    expires_at=now + timedelta(minutes=10),
                    remaining_attempts=5,
                )
            )

        await migrate(engine, "head")
        await check_schema(engine)

        async with Session(engine) as db:
            registration = await db.get(Registration, ("email", "existing@example.com"))

            assert registration is not None
            assert registration.id == identifier
            assert registration.remaining_attempts == 5


async def test_identity_constraints_upgrade_rejects_invalid_data_without_deleting_it():
    from sqlalchemy import text


    now = datetime.now(UTC)
    identifier = uuid4()

    async with postgres_cluster() as cluster, migrated_schema(cluster, "0003") as engine:
        async with Session(engine) as db, db.begin():
            await db.execute(
                insert(Registration).values(
                    id=identifier,
                    contact_kind="email",
                    contact="invalid@example.com",
                    code_digest="old",
                    sent_at=now,
                    expires_at=now + timedelta(minutes=10),
                    remaining_attempts=-1,
                )
            )

        with pytest.raises(IntegrityError):
            await migrate(engine, "head")

        async with Session(engine) as db:
            assert await db.scalar(select(Registration.id)) == identifier
            assert await db.scalar(text("SELECT version_num FROM alembic_version")) == "0003"
