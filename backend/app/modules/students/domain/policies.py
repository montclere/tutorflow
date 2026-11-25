"""Настраиваемые сроки и ограничения запросов приглашений."""

from dataclasses import dataclass
from datetime import timedelta

from app.modules.students.domain.exceptions import StudentError
from app.modules.students.domain.values import MAX_ADULT_CONNECTIONS


@dataclass(frozen=True)
class StudentPolicy:
    invitation_lifetime: timedelta = timedelta(days=7)
    invitation_access_attempts: int = 120
    invitation_issue_attempts: int = 30
    invitation_access_period: timedelta = timedelta(minutes=1)
    invitation_issue_period: timedelta = timedelta(hours=1)

    def __post_init__(self) -> None:
        if (
            self.invitation_lifetime <= timedelta(0)
            or self.invitation_access_period <= timedelta(0)
            or self.invitation_issue_period <= timedelta(0)
        ):
            raise ValueError("Периоды должны быть положительными")

        if min(self.invitation_access_attempts, self.invitation_issue_attempts) < 1:
            raise ValueError("Количество попыток должно быть положительным")


@dataclass(frozen=True)
class AdultAccessPolicy:
    max_connections: int = MAX_ADULT_CONNECTIONS

    def __post_init__(self) -> None:
        if not 1 <= self.max_connections <= MAX_ADULT_CONNECTIONS:
            raise ValueError("Лимит взрослых должен быть от одного до двух")

    def require_connection_space(self, connections: int) -> None:
        if connections >= self.max_connections:
            raise StudentError("adult_limit_reached")

    def require_invitation_space(self, connections: int, invitations: int) -> None:
        self.require_connection_space(connections + invitations)
