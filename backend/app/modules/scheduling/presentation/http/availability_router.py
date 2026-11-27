"""Преподавательские публикации времени, рассмотрение записей и свободные часы ученика."""

from collections.abc import Awaitable, Callable
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import AwareDatetime

from app.modules.identity.public import Actor
from app.modules.scheduling.application.services.availability_collection import AvailabilityServices
from app.modules.scheduling.domain.bookings import BookingState
from app.modules.scheduling.presentation.http.availability_participation_router import (
    availability_participation_router,
    booking_page,
)
from app.modules.scheduling.presentation.http.availability_schemas import (
    AlternativeInput,
    BookingDecisionInput,
    BookingPage,
    BookingView,
    FreeIntervalView,
    PublicationInput,
    PublicationPage,
    PublicationUpdate,
    PublicationView,
    SlotView,
)
from app.shared.presentation.http import RequestAccess, require_json


def availability_router(
    get_services: Callable[[Request], Awaitable[AvailabilityServices]],
    teacher: RequestAccess[Actor],
    student: RequestAccess[Actor],
    adult: RequestAccess[Actor],
) -> APIRouter:
    router = APIRouter(tags=["Время для записи"])


    @router.post("/availability", status_code=201)
    async def create(
        command: PublicationInput,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[AvailabilityServices, Depends(get_services)],
    ) -> PublicationView:
        require_json(request)

        return PublicationView.from_publication(
            await services.publications.create(actor, command.to_command())
        )


    @router.get("/availability")
    async def publications(
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[AvailabilityServices, Depends(get_services)],
        after_id: UUID | None = None,
        limit: Annotated[int | None, Query(ge=1)] = None,
    ) -> PublicationPage:
        size = services.policy.page_size(limit)
        rows = await services.publications.list_publications(actor, size, after_id)

        return PublicationPage(
            items=[PublicationView.from_publication(row) for row in rows[:size]],
            next_after=rows[size - 1].id if len(rows) > size else None,
        )


    @router.put("/availability/{publication_id}")
    async def update(
        publication_id: UUID,
        command: PublicationUpdate,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[AvailabilityServices, Depends(get_services)],
    ) -> PublicationView:
        require_json(request)

        return PublicationView.from_publication(
            await services.publications.update(
                actor, publication_id, command.expected_version, command.to_command()
            )
        )


    @router.delete("/availability/{publication_id}", status_code=204)
    async def remove(
        publication_id: UUID,
        expected_version: Annotated[int, Query(ge=1)],
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[AvailabilityServices, Depends(get_services)],
    ) -> None:
        await services.publications.remove(actor, publication_id, expected_version)


    @router.post("/lessons/{lesson_id}/time-options", status_code=201)
    async def alternatives(
        lesson_id: UUID,
        command: AlternativeInput,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[AvailabilityServices, Depends(get_services)],
    ) -> PublicationView:
        require_json(request)

        return PublicationView.from_publication(
            await services.publications.alternatives(
                actor, lesson_id, command.expected_version, tuple(command.starts_at)
            )
        )


    @router.get("/bookings")
    async def bookings(
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[AvailabilityServices, Depends(get_services)],
        after_id: UUID | None = None,
        limit: Annotated[int | None, Query(ge=1)] = None,
    ) -> BookingPage:
        size = services.policy.page_size(limit)

        return booking_page(
            await services.bookings.list_bookings(actor, None, after_id, size), size
        )


    @router.post("/bookings/{booking_id}/decision")
    async def decide(
        booking_id: UUID,
        command: BookingDecisionInput,
        request: Request,
        actor: Annotated[Actor, Depends(teacher.write)],
        services: Annotated[AvailabilityServices, Depends(get_services)],
    ) -> BookingView:
        require_json(request)

        return BookingView.model_validate(
            await services.bookings.decide(actor, booking_id, BookingState(command.state))
        )


    @router.get("/students/cards/{card_id}/availability")
    async def free_hours(
        card_id: UUID,
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[AvailabilityServices, Depends(get_services)],
        from_: Annotated[AwareDatetime, Query(alias="from")],
        to: AwareDatetime,
    ) -> list[FreeIntervalView]:
        return [
            FreeIntervalView(starts_at=window.starts_at, ends_at=window.ends_at)
            for window in await services.hours.free(actor, card_id, from_, to)
        ]


    @router.get("/students/cards/{card_id}/availability/matches")
    async def matches(
        card_id: UUID,
        actor: Annotated[Actor, Depends(teacher.read)],
        services: Annotated[AvailabilityServices, Depends(get_services)],
        from_: Annotated[AwareDatetime, Query(alias="from")],
        to: AwareDatetime,
    ) -> list[SlotView]:
        return [
            SlotView.from_slot(slot)
            for slot in await services.hours.matches(actor, card_id, from_, to)
        ]


    router.include_router(availability_participation_router("/me/teachers", student, get_services))
    router.include_router(availability_participation_router("/me/students", adult, get_services))

    return router
