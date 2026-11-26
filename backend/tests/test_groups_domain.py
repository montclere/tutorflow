"""Инварианты самостоятельной группы и персональной стоимости участия."""

from decimal import Decimal
from uuid import uuid4

import pytest

from app.modules.groups.domain.entities import Group, Member
from app.modules.groups.domain.exceptions import GroupError
from app.modules.groups.domain.values import Price


@pytest.mark.br_021
def test_empty_group_has_own_identity_and_normalized_name():
    owner = uuid4()
    first = Group.create(owner, "  Русский  ", "  Заметка  ")
    second = Group.create(owner, "Русский", None)

    assert first.name == "Русский" and first.notes == "Заметка"
    assert first.id != second.id
    assert first.teacher_id == owner


@pytest.mark.br_027
def test_archived_group_rejects_changes_until_restored():
    group = Group.create(uuid4(), "Группа", None).set_archived(True)

    with pytest.raises(GroupError, match="group_archived"):
        group.change({"name": "Новое"})

    assert group.set_archived(False).change({"name": "Новое"}).name == "Новое"


@pytest.mark.br_091
@pytest.mark.parametrize("value", ["-1", "NaN", "Infinity", "0.001", "10000000000"])
def test_price_rejects_invalid_amounts(value):
    with pytest.raises(GroupError, match="invalid_group_price"):
        Price(Decimal(value))


@pytest.mark.br_024
@pytest.mark.br_091
def test_personal_price_is_exact_and_independent_of_another_member():
    group_id, owner = uuid4(), uuid4()
    first = Member(group_id, owner, uuid4(), Price(Decimal("0")))
    second = Member(group_id, owner, uuid4(), Price(Decimal("125.20")))

    assert first.price.amount == Decimal("0.00")
    assert second.price.amount == Decimal("125.20")
