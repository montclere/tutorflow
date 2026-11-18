from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.shared.presentation.api.schemas import Version

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=1500)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
Positive = Annotated[int, Field(strict=True, ge=1, le=1440)]


class Body(BaseModel):
    model_config = ConfigDict(extra="forbid")

    def payload(self, *, patch: bool = False) -> dict:
        result = self.model_dump(mode="json", exclude_unset=patch)
        if "reason" in result:
            result["reason"] = result["reason"] or None
        return result


class VersionBody(Body):
    expected_version: Version


class MainContent(Body):
    title: Title
    description: LongText | None = None
    preparation: ShortText | None = None
    private_note: LongText | None = None


class CreateLesson(MainContent):
    student_card_id: UUID
    starts_at: datetime
    duration_minutes: Positive
    client_request_id: UUID


class EditLesson(VersionBody):
    title: Title | None = None
    description: LongText | None = None
    preparation: ShortText | None = None
    private_note: LongText | None = None

    @model_validator(mode="after")
    def changed(self):
        if self.model_fields_set == {"expected_version"} or (
            "title" in self.model_fields_set and self.title is None
        ):
            raise ValueError("Не указано содержание")
        return self


class ReasonBody(VersionBody):
    reason: ShortText | None = None


class Attendance(ReasonBody):
    status: Literal["completed", "no_show"]

    @model_validator(mode="after")
    def reason_for_no_show(self):
        if self.status == "completed" and self.reason is not None:
            raise ValueError("Причина допустима только для пропуска")
        return self


class Propose(ReasonBody):
    proposed_starts_at: datetime


class TeacherPropose(Propose):
    duration_minutes: Positive | None = None


class Decision(VersionBody):
    decision: Literal["accept", "decline"]


class SeriesPlan(Body):
    student_card_id: UUID
    first_local_start: datetime
    timezone: Annotated[str, StringConstraints(max_length=64)]
    count: Positive
    duration_minutes: Positive
    ambiguous_time: Literal["earlier", "later"] | None = None


class CreateSeries(SeriesPlan, MainContent):
    client_request_id: UUID


class MoveSeries(VersionBody):
    from_lesson_id: UUID
    first_local_start: datetime
    duration_minutes: Positive
    ambiguous_time: Literal["earlier", "later"] | None = None


class ProposeSeries(MoveSeries):
    reason: ShortText | None = None


class CancelSeries(ReasonBody):
    scope: Literal["following", "all_future"]
    from_lesson_id: UUID | None = None

    @model_validator(mode="after")
    def anchor(self):
        if (self.scope == "following") != (self.from_lesson_id is not None):
            raise ValueError("Укажите начало области отмены")
        return self


class CabinetLesson(BaseModel):
    lesson_id: UUID
    student_card_id: UUID
    starts_at: datetime
    ends_at: datetime
    duration_minutes: int
    status: Literal["scheduled", "completed", "no_show", "cancelled"]
    title: str
    description: str | None
    preparation: str | None
    outcome_reason: str | None
    version: int


class TeacherLesson(CabinetLesson):
    private_note: str | None
    series_id: UUID | None
    series_position: int | None
    is_series_exception: bool
    uses_series_content: bool
    updated_at: datetime


class TeacherSeries(BaseModel):
    series_id: UUID
    student_card_id: UUID
    timezone: str
    version: int
    content_template: MainContent
    lessons: list[TeacherLesson]


class RequestView(BaseModel):
    request_id: UUID
    scope: str
    requester_role: str
    reason: str | None
    occurrences: list[dict]
    can_resolve: bool = False
    can_withdraw: bool = False
    status: str
    created_at: datetime
    version: int


class AbsenceView(BaseModel):
    can_withdraw: bool = False
    notice_id: UUID
    lesson_id: UUID
    requester_role: str
    reason: str | None
    status: str
    created_at: datetime
    version: int
