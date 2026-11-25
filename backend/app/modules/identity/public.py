"""Тип данных Identity, доступный соседним модулям."""

from dataclasses import dataclass
from uuid import UUID

from app.modules.identity.domain.values import Role as Role


@dataclass(frozen=True)
class Actor:
    account_id: UUID
    role: Role
    timezone: str | None
