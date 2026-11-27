"""Независимые результаты проведения занятия и посещаемость его участников."""

from enum import StrEnum


class LessonOutcome(StrEnum):
    UNRECORDED = "unrecorded"
    HELD = "held"
    NOT_HELD = "not_held"


class Attendance(StrEnum):
    UNMARKED = "unmarked"
    PRESENT = "present"
    ABSENT = "absent"
