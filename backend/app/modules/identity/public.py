from dataclasses import dataclass
from uuid import UUID

from fastapi import Request

from app.modules.identity.router import authenticated


@dataclass(frozen=True)
class Actor:
    account_id: UUID
    role: str
    timezone: str | None


def require_actor(request: Request, *, csrf: bool = False) -> Actor:
    """Возвращает только сведения, нужные другим модулям для проверки прав."""
    _, _, account = authenticated(request, csrf=csrf)
    return Actor(account.id, account.role, account.timezone)
