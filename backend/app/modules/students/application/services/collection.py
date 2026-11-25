"""Собранные прикладные сценарии модуля Students."""

from dataclasses import dataclass

from app.modules.students.application.services.cards import CardService
from app.modules.students.application.services.connections import ConnectionService
from app.modules.students.application.services.invitations import InvitationService
from app.modules.students.application.services.profiles import LearningProfileService
from app.modules.students.application.services.registration import StudentRegistrationService


@dataclass(frozen=True)
class StudentServices:
    cards: CardService
    profiles: LearningProfileService
    invitations: InvitationService
    connections: ConnectionService
    registration: StudentRegistrationService
