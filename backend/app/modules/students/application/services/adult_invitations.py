"""Независимые приглашения взрослых с резервированием свободных мест."""

from collections.abc import Callable
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.identity.public import Actor
from app.modules.students.application.contracts import AdultInvitationPreview, IssuedInvitation
from app.modules.students.application.ports import (
    InvitationTokens,
    StudentRequests,
    StudentsTransaction,
    StudentsUnitOfWork,
)
from app.modules.students.application.services.access import owned_card, require_teacher
from app.modules.students.application.services.invitations import load_active_invitation
from app.modules.students.domain.entities import Invitation, StudentCard
from app.modules.students.domain.exceptions import StudentError
from app.modules.students.domain.policies import AdultAccessPolicy, StudentPolicy


class AdultInvitationService:
    def __init__(
        self,
        persistence: StudentsUnitOfWork,
        tokens: InvitationTokens,
        requests: StudentRequests,
        policy: StudentPolicy,
        access_policy: AdultAccessPolicy,
        clock: Callable[[], datetime],
    ) -> None:
        self.persistence = persistence
        self.tokens = tokens
        self.requests = requests
        self.policy = policy
        self.access_policy = access_policy
        self.clock = clock

    async def create(
        self, unit: StudentsTransaction, card: StudentCard, welcome: str | None
    ) -> IssuedInvitation:
        card.require_active()

        await unit.adults.purge_expired_invitations(card.id)

        self.access_policy.require_invitation_space(
            await unit.adults.count_connections(card.id),
            len(await unit.adults.list_invitations(card.id)),
        )

        now = self.clock()
        token = self.tokens.new_token()
        invitation = Invitation(
            uuid4(),
            card.id,
            self.tokens.digest(token),
            now,
            now + self.policy.invitation_lifetime,
            welcome,
            None,
        )

        await unit.adults.save_invitation(invitation)

        return IssuedInvitation(invitation.id, token, invitation.expires_at)

    async def issue(self, actor: Actor, card_id: UUID, welcome: str | None) -> IssuedInvitation:
        require_teacher(actor)

        await self.requests.issue(actor.account_id)

        async with self.persistence.transaction() as unit:
            card = await owned_card(unit.students, actor, card_id)

            return await self.create(unit, card, welcome)

    async def reissue(self, actor: Actor, card_id: UUID, invitation_id: UUID) -> IssuedInvitation:
        require_teacher(actor)

        await self.requests.issue(actor.account_id)

        async with self.persistence.transaction() as unit:
            card = await owned_card(unit.students, actor, card_id)
            previous = await unit.adults.find_card_invitation(card.id, invitation_id)

            if previous is None:
                raise StudentError("adult_invitation_not_found")

            await unit.adults.revoke_invitation(card.id, previous.id)

            return await self.create(unit, card, previous.welcome)

    async def revoke(self, actor: Actor, card_id: UUID, invitation_id: UUID) -> None:
        async with self.persistence.transaction() as unit:
            card = await owned_card(unit.students, actor, card_id)

            await unit.adults.revoke_invitation(card.id, invitation_id)

    async def list(self, actor: Actor, card_id: UUID) -> list[Invitation]:
        async with self.persistence.transaction() as unit:
            card = await owned_card(unit.students, actor, card_id, lock=False)

            return await unit.adults.list_invitations(card.id)

    async def get_active(
        self, unit: StudentsTransaction, token: str
    ) -> tuple[StudentCard, Invitation]:
        card, invitation = await load_active_invitation(
            unit.students, unit.adults, self.tokens, self.clock, token
        )

        self.access_policy.require_connection_space(await unit.adults.count_connections(card.id))

        return card, invitation

    async def preview(self, token: str, ip: str) -> AdultInvitationPreview:
        await self.requests.access(ip)

        async with self.persistence.transaction() as unit:
            card, invitation = await self.get_active(unit, token)
            teacher = await unit.accounts.profile(card.teacher_id)

            if teacher is None:
                raise StudentError("invitation_invalid")

            return AdultInvitationPreview(
                card.teacher_id,
                teacher.display_name,
                card.name,
                invitation.welcome,
                invitation.expires_at,
            )
