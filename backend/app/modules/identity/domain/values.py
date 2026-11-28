"""Значения контакта, роли и настроек профиля Identity."""

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from types import MappingProxyType
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


CONTACT_MAX_LENGTH = 254
DISPLAY_NAME_MAX_LENGTH = 120
TIMEZONE_MAX_LENGTH = 80


class ContactKind(StrEnum):
    EMAIL = "email"
    PHONE = "phone"
    CHILD = "child"


class Role(StrEnum):
    TEACHER = "teacher"
    STUDENT = "student"
    ADULT = "adult"


INVITED_ROLES = frozenset({Role.STUDENT, Role.ADULT})


@dataclass(frozen=True)
class Contact:
    kind: ContactKind
    value: str


@dataclass(frozen=True)
class Profile:
    display_name: str | None = None
    timezone: str | None = None


@dataclass(frozen=True)
class ProfileChange:
    fields: Mapping[str, str | None]

    def __post_init__(self) -> None:
        values = dict(self.fields)

        if not values or values.keys() - {"display_name", "timezone"}:
            raise ValueError("Укажите хотя бы одно поле")

        if (name := values.get("display_name")) is not None:
            name = name.strip()

            if (
                not name
                or len(name) > DISPLAY_NAME_MAX_LENGTH
                or any(not char.isprintable() for char in name)
            ):
                raise ValueError("Некорректное отображаемое имя")

            values["display_name"] = name

        if (timezone := values.get("timezone")) is not None:
            if timezone != "UTC" and (
                "/" not in timezone or timezone.startswith(("posix/", "right/"))
            ):
                raise ValueError("Неизвестный часовой пояс")

            try:
                ZoneInfo(timezone)
            except (ZoneInfoNotFoundError, ValueError):
                raise ValueError("Неизвестный часовой пояс") from None

        object.__setattr__(self, "fields", MappingProxyType(values))
