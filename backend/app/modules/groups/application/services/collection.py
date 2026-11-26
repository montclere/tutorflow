"""Набор сценариев управления группами и чтения собственного участия."""

from dataclasses import dataclass

from app.modules.groups.application.services.groups import GroupService
from app.modules.groups.application.services.memberships import MembershipService
from app.modules.groups.application.services.participation import ParticipationService


@dataclass(frozen=True)
class GroupServices:
    groups: GroupService
    memberships: MembershipService
    participation: ParticipationService
