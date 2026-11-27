"""Команды свободного времени и безопасные представления ячеек и резервов."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.modules.scheduling.application.availability_contracts import PublicationDraft, StudentHours
from app.modules.scheduling.domain.availability import (
    AvailabilityAudience,
    AvailabilityPublication,
    AvailableSlot,
    BookingMode,
    TimeWindow,
)
from app.modules.scheduling.domain.bookings import BookingState
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.lessons import LessonConditions
from app.modules.scheduling.presentation.http.lesson_schemas import Input, Price
from app.modules.scheduling.presentation.http.series_schemas import RecurrenceInput, RuleView


class WindowInput(Input):
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    recurrence: RecurrenceInput | None = None

    def to_window(self, timezone: str) -> TimeWindow:
        rule = None

        if self.recurrence is not None:
            minutes = (self.ends_at - self.starts_at).total_seconds() / 60

            if not minutes.is_integer() or minutes < 1:
                raise LessonError("invalid_availability")

            conditions = LessonConditions(self.starts_at, timezone, int(minutes))
            rule = self.recurrence.to_command().resolve(conditions)

        return TimeWindow(self.starts_at, self.ends_at, rule)


class AudienceInput(Input):
    all_connected: bool = True
    card_ids: list[UUID] = Field(default_factory=list)
    group_ids: list[UUID] = Field(default_factory=list)

    def to_audience(self) -> AvailabilityAudience:
        return AvailabilityAudience(self.all_connected, tuple(self.card_ids), tuple(self.group_ids))


class PublicationInput(Input):
    windows: list[WindowInput]
    timezone: Annotated[str, Field(min_length=1, max_length=80)] = "UTC"
    duration_minutes: Annotated[int | None, Field(ge=1)] = None
    step_minutes: Annotated[int | None, Field(ge=1)] = None
    break_minutes: Annotated[int, Field(ge=0)] = 0
    price: Price
    mode: BookingMode = BookingMode.INSTANT
    audience: AudienceInput = Field(default_factory=AudienceInput)

    def to_command(self) -> PublicationDraft:
        return PublicationDraft(
            tuple(window.to_window(self.timezone) for window in self.windows),
            self.timezone,
            self.duration_minutes,
            self.step_minutes,
            self.break_minutes,
            self.price.to_price(),
            self.mode,
            self.audience.to_audience(),
        )


class PublicationUpdate(PublicationInput):
    expected_version: Annotated[int, Field(ge=1)]


class AlternativeInput(Input):
    expected_version: Annotated[int, Field(ge=1)]
    starts_at: list[AwareDatetime]


class WindowView(BaseModel):
    starts_at: datetime
    ends_at: datetime
    recurrence: RuleView | None = None


class PublicationView(BaseModel):
    id: UUID
    version: int
    active: bool
    windows: list[WindowView]
    timezone: str
    duration_minutes: int
    step_minutes: int
    break_minutes: int
    price: Price
    mode: BookingMode
    audience: AudienceInput
    lesson_id: UUID | None

    @classmethod
    def from_publication(cls, publication: AvailabilityPublication) -> "PublicationView":
        windows = [window_view(window) for window in publication.windows]

        return cls(
            id=publication.id,
            version=publication.version,
            active=publication.active,
            windows=windows,
            timezone=publication.timezone,
            duration_minutes=publication.duration_minutes,
            step_minutes=publication.step_minutes,
            break_minutes=publication.break_minutes,
            price=Price(amount=publication.price.amount),
            mode=publication.mode,
            audience=AudienceInput(
                all_connected=publication.audience.all_connected,
                card_ids=list(publication.audience.card_ids),
                group_ids=list(publication.audience.group_ids),
            ),
            lesson_id=publication.lesson_id,
        )


class SlotView(BaseModel):
    publication_id: UUID
    version: int
    starts_at: datetime
    ends_at: datetime
    price: Price

    @classmethod
    def from_slot(cls, slot: AvailableSlot) -> "SlotView":
        return cls(
            publication_id=slot.publication_id,
            version=slot.version,
            starts_at=slot.starts_at,
            ends_at=slot.ends_at,
            price=Price(amount=slot.price.amount),
        )


class BookingInput(Input):
    publication_id: UUID
    expected_version: Annotated[int, Field(ge=1)]
    starts_at: AwareDatetime
    request_id: UUID


class BookingDecisionInput(Input):
    state: Literal["accepted", "rejected"]


class BookingView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    publication_id: UUID
    publication_version: int
    card_id: UUID
    starts_at: datetime
    ends_at: datetime
    created_at: datetime
    expires_at: datetime
    state: BookingState
    lesson_id: UUID | None
    decided_at: datetime | None


class BookingPage(BaseModel):
    items: list[BookingView]
    next_after: UUID | None


class PublicationPage(BaseModel):
    items: list[PublicationView]
    next_after: UUID | None


class StudentHoursInput(Input):
    expected_version: Annotated[int, Field(ge=0)]
    timezone: Annotated[str, Field(min_length=1, max_length=80)] = "UTC"
    free: list[WindowInput] = Field(default_factory=list)
    busy: list[WindowInput] = Field(default_factory=list)


class StudentHoursView(BaseModel):
    card_id: UUID
    version: int
    free: list[WindowView]
    busy: list[WindowView]

    @classmethod
    def from_hours(cls, hours: StudentHours) -> "StudentHoursView":
        return cls(
            card_id=hours.card_id,
            version=hours.version,
            free=[window_view(window) for window in hours.free],
            busy=[window_view(window) for window in hours.busy],
        )


class FreeIntervalView(BaseModel):
    starts_at: datetime
    ends_at: datetime


def window_view(window: TimeWindow) -> WindowView:
    return WindowView(
        starts_at=window.starts_at,
        ends_at=window.ends_at,
        recurrence=RuleView.from_rule(window.recurrence) if window.recurrence else None,
    )
