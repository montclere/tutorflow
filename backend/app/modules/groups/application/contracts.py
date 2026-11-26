"""Контракты обзора группы, состава и собственного участия."""

from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from app.modules.groups.domain.entities import Group, Member


PAGE_MAX_SIZE = 100
DEFAULT_PAGE_SIZE = 50


@dataclass(frozen=True)
class GroupOverview:
    group: Group
    total: Decimal


@dataclass(frozen=True)
class MemberOverview:
    member: Member
    name: str


@dataclass(frozen=True)
class Participation:
    group_id: UUID
    teacher_id: UUID
    name: str
    archived: bool
    card_id: UUID
    amount: Decimal
