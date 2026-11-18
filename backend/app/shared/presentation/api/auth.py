from dataclasses import dataclass
from typing import Protocol

from pydantic import BaseModel, ConfigDict

from app.shared.application.contracts.accounts import AccountSummary


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


@dataclass(frozen=True)
class Actor:
    account: AccountSummary
    source: str


class RateLimiter(Protocol):
    async def __call__(self, action: str, subject: str, limit: int, seconds: int) -> None: ...
