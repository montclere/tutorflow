"""HTTP-контракт собственных личных блоков преподавателя."""

from collections.abc import Awaitable, Callable
from datetime import datetime
from typing import Annotated, NoReturn
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, NaiveDatetime

from app.modules.identity.public import Actor
from app.modules.scheduling.application.calendar import Calendar
from app.modules.scheduling.application.ports import BlockCursor
from app.modules.scheduling.domain.calendar import MAX_DURATION, MIN_DURATION, CalendarError
from app.shared.presentation.http import require_json


class BlockInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    local_start: NaiveDatetime
    duration_minutes: Annotated[int, Field(ge=MIN_DURATION, le=MAX_DURATION)] = 60


class CreateBlock(BlockInput):
    request_id: UUID | None = None


class BlockView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    starts_at: datetime
    timezone: str
    duration_minutes: int


def raise_calendar_error(error: CalendarError) -> NoReturn:
    status_code = {
        "teacher_required": 403,
        "calendar_block_not_found": 404,
        "calendar_block_conflict": 409,
    }.get(error.code, 422)

    raise HTTPException(status_code, error.code) from None


def calendar_router(
    get_calendar: Callable[[Request], Awaitable[Calendar]],
    read_actor: Callable[[Request], Awaitable[Actor]],
    write_actor: Callable[[Request], Awaitable[Actor]],
) -> APIRouter:
    router = APIRouter(prefix="/me/calendar-blocks", tags=["Личные блоки календаря"])


    @router.get("")
    async def list_blocks(
        request: Request,
        limit: Annotated[int, Query(ge=1, le=100)] = 50,
        after_start: AwareDatetime | None = None,
        after_id: UUID | None = None,
    ) -> list[BlockView]:
        actor = await read_actor(request)

        if (after_start is None) != (after_id is None):
            raise HTTPException(422, "invalid_calendar_cursor")

        after = BlockCursor(after_start, after_id) if after_start and after_id else None

        try:
            blocks = await (await get_calendar(request)).list(actor, limit=limit, after=after)
        except CalendarError as error:
            raise_calendar_error(error)

        return [BlockView.model_validate(block) for block in blocks]


    @router.post("", status_code=201)
    async def add_block(command: CreateBlock, request: Request) -> BlockView:
        require_json(request)

        actor = await write_actor(request)

        try:
            block = await (await get_calendar(request)).create(
                actor, command.local_start, command.duration_minutes, command.request_id
            )
        except CalendarError as error:
            raise_calendar_error(error)

        return BlockView.model_validate(block)


    @router.put("/{block_id}")
    async def replace_block(block_id: UUID, command: BlockInput, request: Request) -> BlockView:
        require_json(request)

        actor = await write_actor(request)

        try:
            block = await (await get_calendar(request)).replace(
                actor, block_id, command.local_start, command.duration_minutes
            )
        except CalendarError as error:
            raise_calendar_error(error)

        return BlockView.model_validate(block)


    @router.delete("/{block_id}", status_code=204)
    async def remove_block(block_id: UUID, request: Request) -> None:
        actor = await write_actor(request)

        try:
            await (await get_calendar(request)).remove(actor, block_id)
        except CalendarError as error:
            raise_calendar_error(error)


    return router
