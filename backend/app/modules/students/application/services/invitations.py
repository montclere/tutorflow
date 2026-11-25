"""Выпуск, отзыв и разрешённое предварительное описание приглашения."""

from collections.abc import Callable
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.identity.public import Actor
from app.modules.students.application.contracts import InvitationPreview, IssuedInvitation
from app.modules.students.application.ports import (
    InvitationTokens,
    StudentRequests,
    StudentsTransaction,
    StudentsUnitOfWork,
)
from app.modules.students.application.services.access import owned_card, require_teacher
from app.modules.students.domain.entities import Invitation, StudentCard
from app.modules.students.domain.exceptions import StudentError
from app.modules.students.domain.policies import StudentPolicy
from app.modules.students.domain.values import WELCOME_MAX_LENGTH, optional_text


class InvitationService:
    def __init__(
        self,
        persistence: StudentsUnitOfWork,
        tokens: InvitationTokens,
        requests: StudentRequests,
        policy: StudentPolicy,
        clock: Callable[[], datetime],
    ) -> None:
        self.persistence = persistence
        self.tokens = tokens
        self.requests = requests
        self.policy = policy
        self.clock = clock

    async def issue(self, actor: Actor, card_id: UUID, welcome: str | None) -> IssuedInvitation:
        require_teacher(actor)

        message = optional_text(welcome, WELCOME_MAX_LENGTH)

        await self.requests.issue(actor.account_id)

        async with self.persistence.transaction() as unit:
            card = await owned_card(unit.students, actor, card_id)

            card.require_active()

            if await unit.students.find_connection(card.id) is not None:
                raise StudentError("student_already_connected")

            token = self.tokens.new_token()
            now = self.clock()
            invitation = Invitation(
                uuid4(),
                card.id,
                self.tokens.digest(token),
                now,
                now + self.policy.invitation_lifetime,
                message,
                None,
            )

            await unit.students.save_invitation(invitation)

        return IssuedInvitation(invitation.id, token, invitation.expires_at)

    async def revoke(self, actor: Actor, card_id: UUID) -> None:
        async with self.persistence.transaction() as unit:
            card = await owned_card(unit.students, actor, card_id)

            await unit.students.revoke_invitation(card.id)

    async def get_active(
        self, unit: StudentsTransaction, token: str
    ) -> tuple[StudentCard, Invitation]:
        digest = self.tokens.digest(token)
        invitation = await unit.students.find_invitation(digest)

        if invitation is None:
            raise StudentError("invitation_invalid")

        card = await unit.students.find_card(invitation.card_id, lock=True)
        invitation = await unit.students.find_invitation(digest)

        if card is None or card.archived or invitation is None:
            raise StudentError("invitation_invalid")

        invitation.require_active(self.clock())

        if await unit.students.find_connection(card.id) is not None:
            raise StudentError("invitation_invalid")

        return card, invitation

    async def preview(self, token: str, ip: str) -> InvitationPreview:
        await self.requests.access(ip)

        async with self.persistence.transaction() as unit:
            card, invitation = await self.get_active(unit, token)
            teacher = await unit.accounts.profile(card.teacher_id)

            if teacher is None:
                raise StudentError("invitation_invalid")

            return InvitationPreview(
                card.teacher_id, teacher.display_name, invitation.welcome, invitation.expires_at
            )
