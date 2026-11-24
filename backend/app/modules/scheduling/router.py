from datetime import datetime
from functools import lru_cache
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, NaiveDatetime

from app.database import database_engine
from app.modules.identity.public import Actor, require_actor
from app.modules.scheduling.service import Calendar

router = APIRouter(prefix="/api/v1/me/calendar-blocks", tags=["Личные блоки календаря"])


class BlockInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    local_start: NaiveDatetime
    duration_minutes: Annotated[int, Field(ge=5, le=480)] = 60


class BlockView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    starts_at: datetime
    timezone: str
    duration_minutes: int


@lru_cache(maxsize=1)
def default_calendar() -> Calendar:
    return Calendar(database_engine())


def calendar(request: Request) -> Calendar:
    injected: Calendar | None = getattr(request.app.state, "calendar", None)
    return injected if injected is not None else default_calendar()


def teacher(request: Request, *, csrf: bool = False) -> Actor:
    actor = require_actor(request, csrf=csrf)
    if actor.role != "teacher":
        raise HTTPException(403, "teacher_required")
    return actor


@router.get("")
def list_blocks(request: Request) -> list[BlockView]:
    actor = teacher(request)
    return [
        BlockView.model_validate(block)
        for block in calendar(request).list(actor.account_id)
    ]


@router.post("", status_code=201)
def add_block(command: BlockInput, request: Request) -> BlockView:
    actor = teacher(request, csrf=True)
    try:
        block = calendar(request).create(
            actor.account_id,
            command.local_start,
            actor.timezone,
            command.duration_minutes,
        )
    except ValueError:
        raise HTTPException(422, "invalid_local_start") from None
    return BlockView.model_validate(block)
