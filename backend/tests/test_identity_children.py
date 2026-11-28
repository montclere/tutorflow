"""Проверки отдельного детского входа, смены управления и миграции Identity."""

import asyncio
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from tests.identity_testkit import seed_account
from tests.postgres_testkit import check_schema, migrate, migrated_schema

from app.modules.identity.application.contracts import ContactInput
from app.modules.identity.application.services.invited_accounts import InvitedAccountService
from app.modules.identity.domain.exceptions import IdentityError
from app.modules.identity.domain.values import ContactKind, Role
from app.modules.identity.infrastructure.persistence.models import Account
from app.modules.identity.public import ChildCredentials


pytestmark = [pytest.mark.anyio, pytest.mark.br_019, pytest.mark.br_020]


async def seed_adult(db, account_id):
    await seed_account(
        db,
        account_id=account_id,
        contact_kind="email",
        contact=f"{account_id}@example.com",
        password_hash="hash",
        verified_at=datetime.now(UTC),
        role="adult",
    )


async def test_child_credentials_and_manager_lifecycle(services, database):
    registration = services.identity.registration
    auth = services.identity.authentication
    sessions = services.identity.sessions
    first, second = uuid4(), uuid4()

    async with AsyncSession(database) as db, db.begin():
        await seed_adult(db, first)
        await seed_adult(db, second)

    async with registration.persistence.transaction() as repository:
        invited = InvitedAccountService(repository, registration)
        credentials = await invited.create_child(first)

    child_id = credentials.account_id
    contact = ContactInput(ContactKind.CHILD, credentials.login.upper())
    original = await auth.login(contact, credentials.password, "test", None)

    assert original.account.id == child_id
    assert original.account.roles == {Role.STUDENT}
    assert original.account.manager_id == first
    assert credentials.password not in repr(credentials)

    with pytest.raises(IdentityError, match="invalid_contact"):
        await registration.start(contact, "test")

    with pytest.raises(IdentityError, match="invalid_contact"):
        await registration.start_invited(
            "child", credentials.login, uuid4(), "test", role=Role.STUDENT
        )

    with pytest.raises(IdentityError, match="child_account_managed"):
        await auth.change_child_password(child_id, "a new long password", original.session_token)

    with pytest.raises(IdentityError, match="child_account_managed"):
        await services.identity.roles.activate_teacher(child_id)

    async with registration.persistence.transaction() as repository:
        invited = InvitedAccountService(repository, registration)

        with pytest.raises(IdentityError, match="child_account_managed"):
            await invited.activate_role(child_id, Role.ADULT)

        with pytest.raises(IdentityError, match="child_not_managed_by_actor"):
            await invited.reset_child_password(child_id, second)

        reset = await invited.reset_child_password(child_id, first)

        await invited.request_child_transfer(child_id, first, second)

    assert reset.login == credentials.login and reset.password != credentials.password

    with pytest.raises(IdentityError, match="authentication_required"):
        await sessions.get_account(original.session_token)

    with pytest.raises(IdentityError, match="invalid_credentials"):
        await auth.login(contact, credentials.password, "test", None)

    before_transfer = await auth.login(contact, reset.password, "test", None)

    async with registration.persistence.transaction() as repository:
        invited = InvitedAccountService(repository, registration)
        children = await invited.list_managed_children(first)

        assert len(children) == 1 and children[0].pending_manager_id == second

        with pytest.raises(IdentityError, match="child_transfer_invalid"):
            await invited.accept_child_transfer(child_id, first)

        transferred = await invited.accept_child_transfer(child_id, second)

        assert await invited.list_managed_children(first) == []

        with pytest.raises(IdentityError, match="child_transfer_invalid"):
            await invited.accept_child_transfer(child_id, second)

        with pytest.raises(IdentityError, match="child_not_managed_by_actor"):
            await invited.release_child(child_id, first)

    with pytest.raises(IdentityError, match="authentication_required"):
        await sessions.get_account(before_transfer.session_token)

    assert transferred.account_id == child_id and transferred.login == credentials.login

    before_release = await auth.login(contact, transferred.password, "test", None)

    async with registration.persistence.transaction() as repository:
        invited = InvitedAccountService(repository, registration)

        await invited.release_child(child_id, second)

        management = await invited.get_child_management(child_id)

        assert management is not None and management.manager_id is None
        assert management.pending_manager_id is None

    with pytest.raises(IdentityError, match="authentication_required"):
        await sessions.get_account(before_release.session_token)

    released = await auth.login(contact, transferred.password, "test", None)

    competing = await auth.login(contact, transferred.password, "test", None)
    passwords = ("a new long password", "another long password")
    results = await asyncio.gather(
        auth.change_child_password(child_id, passwords[0], released.session_token),
        auth.change_child_password(child_id, passwords[1], competing.session_token),
        return_exceptions=True,
    )

    assert results.count(None) == 1

    rejected = next(result for result in results if result is not None)

    assert isinstance(rejected, IdentityError) and rejected.code == "authentication_required"

    with pytest.raises(IdentityError, match="authentication_required"):
        await sessions.get_account(released.session_token)

    independent = await auth.login(contact, passwords[results.index(None)], "test", None)

    assert independent.account.id == child_id and independent.account.manager_id is None


async def test_only_one_concurrent_transfer_accept_succeeds(services, database):
    registration = services.identity.registration
    first, second = uuid4(), uuid4()

    async with AsyncSession(database) as db, db.begin():
        await seed_adult(db, first)
        await seed_adult(db, second)

    async with registration.persistence.transaction() as repository:
        invited = InvitedAccountService(repository, registration)
        child = await invited.create_child(first)

        await invited.request_child_transfer(child.account_id, first, second)


    async def accept() -> ChildCredentials:
        async with registration.persistence.transaction() as repository:
            invited = InvitedAccountService(repository, registration)

            return await invited.accept_child_transfer(child.account_id, second)


    results = await asyncio.gather(accept(), accept(), return_exceptions=True)
    credentials = [result for result in results if isinstance(result, ChildCredentials)]
    errors = [result.code for result in results if isinstance(result, IdentityError)]

    assert len(credentials) == 1 and errors == ["child_transfer_invalid"]

    signed = await services.identity.authentication.login(
        ContactInput(ContactKind.CHILD, child.login), credentials[0].password, "test", None
    )

    assert signed.account.id == child.account_id and signed.account.manager_id == second


async def test_deleted_manager_leaves_child_independent(services, database):
    registration = services.identity.registration
    manager, target = uuid4(), uuid4()

    async with AsyncSession(database) as db, db.begin():
        await seed_adult(db, manager)
        await seed_adult(db, target)

    async with registration.persistence.transaction() as repository:
        invited = InvitedAccountService(repository, registration)
        child = await invited.create_child(manager)

        await invited.request_child_transfer(child.account_id, manager, target)

    async with AsyncSession(database) as db, db.begin():
        await db.execute(delete(Account).where(Account.id == manager))

    async with registration.persistence.transaction() as repository:
        invited = InvitedAccountService(repository, registration)
        management = await invited.get_child_management(child.account_id)

        assert management is not None and management.manager_id is None
        assert management.pending_manager_id is None

        with pytest.raises(IdentityError, match="child_transfer_invalid"):
            await invited.accept_child_transfer(child.account_id, target)

    result = await services.identity.authentication.login(
        ContactInput(ContactKind.CHILD, child.login), child.password, "test", None
    )

    assert result.account.id == child.account_id and result.account.manager_id is None


async def test_child_login_migration_preserves_existing_account_and_refuses_loss(cluster):
    manager = uuid4()

    async with migrated_schema(cluster, "0017") as database:
        async with AsyncSession(database) as db, db.begin():
            await seed_adult(db, manager)

        await migrate(database, "head")
        await check_schema(database)

        async with AsyncSession(database) as db, db.begin():
            account = await db.get(Account, manager)

            assert account is not None and account.password_hash == "hash"
            assert account.manager_id is None and account.pending_manager_id is None

            await db.execute(
                text(
                    "INSERT INTO identity_accounts (id, contact_kind, contact, password_hash, "
                    "verified_at, manager_id) VALUES "
                    "(:id, 'child', :login, 'hash', now(), :manager)"
                ),
                dict(id=uuid4(), login=str(uuid4()), manager=manager),
            )

        with pytest.raises(RuntimeError, match="Откат удалил бы данные"):
            await migrate(database, "0017", downgrade=True)

        await check_schema(database)

        async with AsyncSession(database) as db:
            assert len((await db.scalars(select(Account.id))).all()) == 2
