"""Собранные сценарии публикации времени, записи и собственных часов ученика."""

from dataclasses import dataclass

from app.modules.scheduling.application.services.availability_bookings import BookingService
from app.modules.scheduling.application.services.availability_publications import PublicationService
from app.modules.scheduling.application.services.availability_slots import AvailabilitySlotService
from app.modules.scheduling.application.services.student_hours import StudentHoursService
from app.modules.scheduling.domain.policies import LessonPolicy


@dataclass(frozen=True)
class AvailabilityServices:
    publications: PublicationService
    slots: AvailabilitySlotService
    bookings: BookingService
    hours: StudentHoursService
    policy: LessonPolicy
