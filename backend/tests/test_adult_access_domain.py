"""Проверки лимита подключений и резервирования мест взрослыми."""

import pytest

from app.modules.students.domain.exceptions import StudentError
from app.modules.students.domain.policies import AdultAccessPolicy


@pytest.mark.br_082
@pytest.mark.br_083
def test_active_invitations_reserve_available_capacity():
    policy = AdultAccessPolicy()

    policy.require_invitation_space(0, 1)
    policy.require_connection_space(1)

    for connections, invitations in [(0, 2), (1, 1), (2, 0)]:
        with pytest.raises(StudentError):
            policy.require_invitation_space(connections, invitations)

    with pytest.raises(StudentError):
        policy.require_connection_space(2)


@pytest.mark.br_082
@pytest.mark.parametrize("limit", [0, 3])
def test_capacity_cannot_exceed_storage_guarantee(limit):
    with pytest.raises(ValueError):
        AdultAccessPolicy(max_connections=limit)
