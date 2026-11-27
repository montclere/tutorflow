"""Собственная запись и часы ученика в фиксированных ученическом и взрослом кабинетах."""

from collections.abc import Awaitable, Callable
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import AwareDatetime

from app.modules.identity.public import Actor
from app.modules.scheduling.application.services.availability_collection import AvailabilityServices
from app.modules.scheduling.domain.bookings import Booking, BookingState
from app.modules.scheduling.presentation.http.availability_schemas import (
    BookingInput,
    BookingPage,
    BookingView,
    SlotView,
    StudentHoursInput,
    StudentHoursView,
)
from app.shared.presentation.http import RequestAccess, require_json


def booking_page(rows: list[Booking], size: int) -> BookingPage:
    return BookingPage(
        items=[BookingView.model_validate(row) for row in rows[:size]],
        next_after=rows[size - 1].id if len(rows) > size else None,
    )


def availability_participation_router(
    prefix: str,
    access: RequestAccess[Actor],
    get_services: Callable[[Request], Awaitable[AvailabilityServices]],
) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=["Собственная запись"])


    @router.get("/{card_id}/available-slots")
    async def slots(
        card_id: UUID,
        actor: Annotated[Actor, Depends(access.read)],
        services: Annotated[AvailabilityServices, Depends(get_services)],
        from_: Annotated[AwareDatetime, Query(alias="from")],
        to: AwareDatetime,
        publication_id: UUID | None = None,
    ) -> list[SlotView]:
        return [
            SlotView.from_slot(slot)
            for slot in await services.slots.list_slots(actor, card_id, from_, to, publication_id)
        ]


    @router.post("/{card_id}/bookings", status_code=201)
    async def book(
        card_id: UUID,
        command: BookingInput,
        request: Request,
        actor: Annotated[Actor, Depends(access.write)],
        services: Annotated[AvailabilityServices, Depends(get_services)],
    ) -> BookingView:
        require_json(request)

        return BookingView.model_validate(
            await services.bookings.book(
                actor,
                card_id,
                command.publication_id,
                command.expected_version,
                command.starts_at,
                command.request_id,
            )
        )


    @router.get("/{card_id}/bookings")
    async def bookings(
        card_id: UUID,
        actor: Annotated[Actor, Depends(access.read)],
        services: Annotated[AvailabilityServices, Depends(get_services)],
        after_id: UUID | None = None,
        limit: Annotated[int | None, Query(ge=1)] = None,
    ) -> BookingPage:
        size = services.policy.page_size(limit)
        rows = await services.bookings.list_bookings(actor, card_id, after_id, size)

        return booking_page(rows, size)


    @router.post("/{card_id}/bookings/{booking_id}/withdraw")
    async def withdraw(
        card_id: UUID,
        booking_id: UUID,
        actor: Annotated[Actor, Depends(access.write)],
        services: Annotated[AvailabilityServices, Depends(get_services)],
    ) -> BookingView:
        return BookingView.model_validate(
            await services.bookings.decide(actor, booking_id, BookingState.WITHDRAWN, card_id)
        )


    @router.get("/{card_id}/availability")
    async def hours(
        card_id: UUID,
        actor: Annotated[Actor, Depends(access.read)],
        services: Annotated[AvailabilityServices, Depends(get_services)],
    ) -> StudentHoursView:
        return StudentHoursView.from_hours(await services.hours.own(actor, card_id))


    @router.put("/{card_id}/availability")
    async def change_hours(
        card_id: UUID,
        command: StudentHoursInput,
        request: Request,
        actor: Annotated[Actor, Depends(access.write)],
        services: Annotated[AvailabilityServices, Depends(get_services)],
    ) -> StudentHoursView:
        require_json(request)

        return StudentHoursView.from_hours(
            await services.hours.update(
                actor,
                card_id,
                command.expected_version,
                tuple(window.to_window(command.timezone) for window in command.free),
                tuple(window.to_window(command.timezone) for window in command.busy),
            )
        )


    return router
