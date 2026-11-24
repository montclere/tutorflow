"""Значения контакта, роли и настроек профиля Identity."""

from dataclasses import dataclass
from enum import StrEnum


CONTACT_MAX_LENGTH = 254
DISPLAY_NAME_MAX_LENGTH = 120
TIMEZONE_MAX_LENGTH = 80


class ContactKind(StrEnum):
    EMAIL = "email"
    PHONE = "phone"


class Role(StrEnum):
    TEACHER = "teacher"
    STUDENT = "student"
    ADULT = "adult"


@dataclass(frozen=True)
class Contact:
    kind: ContactKind
    value: str


@dataclass(frozen=True)
class Profile:
    display_name: str | None = None
    timezone: str | None = None
