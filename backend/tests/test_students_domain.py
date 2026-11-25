"""Проверяет значения и жизненный цикл карточек и приглашений."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest

from app.modules.students.domain.entities import Invitation, StudentCard
from app.modules.students.domain.exceptions import StudentError
from app.modules.students.domain.values import Money


@pytest.mark.br_076
@pytest.mark.parametrize("amount", ["-0.01", "0.001", "NaN", "Infinity"])
def test_money_rejects_invalid_amount(amount):
    with pytest.raises(StudentError):
        Money(Decimal(amount))


@pytest.mark.br_076
def test_money_preserves_exact_rubles_and_accepts_zero():
    assert Money(Decimal("0")).amount == Decimal("0.00")
    assert Money(Decimal("123.45")).currency == "RUB"


@pytest.mark.br_005
def test_card_requires_name_and_preserves_independent_ids():
    owner = uuid4()
    first = StudentCard.create(owner, " Ученик ", None)
    second = StudentCard.create(owner, "Ученик", None)

    assert first.name == second.name == "Ученик"
    assert first.id != second.id

    with pytest.raises(StudentError):
        StudentCard.create(owner, " ", None)


@pytest.mark.br_012
def test_invitation_rechecks_expiry_and_consumption():
    now = datetime(2026, 11, 25, tzinfo=UTC)
    invitation = Invitation(uuid4(), uuid4(), "digest", now, now + timedelta(seconds=1), None, None)

    invitation.require_active(now)

    with pytest.raises(StudentError):
        invitation.require_active(now + timedelta(seconds=1))

    with pytest.raises(StudentError):
        replace(invitation, consumed_at=now).require_active(now)


@pytest.mark.br_012
def test_tokens_are_random_scoped_and_settings_are_validated(monkeypatch):
    from app.modules.students.infrastructure.security.tokens import SecureInvitationTokens
    from app.modules.students.infrastructure.settings import StudentSettings


    tokens = SecureInvitationTokens(b"x" * 32)
    first, second = tokens.new_token(), tokens.new_token()

    assert len(first) == 43 and first != second
    assert tokens.digest(first) != first
    assert tokens.digest(first) != SecureInvitationTokens(b"y" * 32).digest(first)

    with pytest.raises(StudentError):
        tokens.digest("/" * 43)

    monkeypatch.setenv("TUTORFLOW_STUDENTS_POLICY__INVITATION_ACCESS_ATTEMPTS", "2")
    assert StudentSettings().policy.invitation_access_attempts == 2
    monkeypatch.setenv("TUTORFLOW_STUDENTS_POLICY__INVITATION_ACCESS_ATTEMPTS", "0")

    with pytest.raises(ValueError):
        StudentSettings()
