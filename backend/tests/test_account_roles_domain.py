"""Проверки одной личности с несколькими явно подключёнными ролями."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.modules.identity.domain.entities import Account
from app.modules.identity.domain.exceptions import IdentityError
from app.modules.identity.domain.values import Contact, ContactKind, Role


@pytest.mark.br_075
@pytest.mark.br_087
def test_account_has_explicit_roles_without_global_active_role():
    account = Account(
        uuid4(),
        Contact(ContactKind.EMAIL, "person@example.com"),
        frozenset({Role.TEACHER, Role.STUDENT}),
        "hash",
        datetime.now(UTC),
    )

    account.require_role(Role.TEACHER)
    account.require_role(Role.STUDENT)

    with pytest.raises(IdentityError, match="role_not_enabled"):
        account.require_role(Role.ADULT)

    assert account.roles == frozenset({Role.TEACHER, Role.STUDENT})


@pytest.mark.br_075
def test_account_cannot_have_empty_role_set():
    with pytest.raises(ValueError):
        Account(
            uuid4(),
            Contact(ContactKind.EMAIL, "person@example.com"),
            frozenset(),
            "hash",
            datetime.now(UTC),
        )
