import hmac
import unicodedata
from dataclasses import dataclass
from datetime import timedelta
from uuid import UUID, uuid4

from app.shared.application.contracts.accounts import AccountDirectory, AccountSummary
from app.shared.application.contracts.student_cards import StudentCardOperation
from app.shared.application.ports.clock import now_utc
from app.shared.application.security import digest, keyed_digest, new_token
from app.shared.domain.errors import Problem, ProblemCode

from ..domain.errors import not_found, unavailable
from ..domain.student import Invitation, InvitationPurpose, ParentAccess, StudentCard
from .ports import Position, StudentsRepository


@dataclass(frozen=True)
class CabinetCard:
    card: StudentCard
    teacher_display_name: str
    parent_access_id: UUID | None = None

    def view(self) -> dict:
        result = {**self.card.shared_view(), "teacher_display_name": self.teacher_display_name}
        if self.parent_access_id is not None:
            result["parent_access_id"] = self.parent_access_id
        return result


class Students:
    def __init__(
        self, store: StudentsRepository, accounts: AccountDirectory, key: str, invitation_hours: int
    ):
        self.store = store
        self.accounts = accounts
        self.key = key
        self.invitation_hours = invitation_hours

    @staticmethod
    def require_teacher(actor: AccountSummary) -> None:
        if not actor.teacher_enabled:
            raise Problem(ProblemCode.TEACHER_CABINET_REQUIRED)

    async def _active_teacher(self, account_id: UUID) -> AccountSummary | None:
        teacher = await self.accounts.lookup_account(account_id)
        return teacher if teacher and teacher.can_access and teacher.teacher_enabled else None

    async def issue(
        self, actor: AccountSummary, purpose: InvitationPurpose
    ) -> tuple[Invitation, str]:
        self.require_teacher(actor)
        token = new_token()
        now = now_utc()
        invitation = Invitation(
            uuid4(),
            actor.account_id,
            purpose,
            now,
            now + timedelta(hours=self.invitation_hours),
            None,
            None,
            None,
            None,
            None,
        )
        await self.store.add_invitation(invitation, digest(token))
        await self.store.audit(
            actor.account_id, "invitation_created", "invitation", invitation.invitation_id
        )
        return invitation, token

    async def preview(self, token: str, *, lock: bool = False) -> Invitation:
        invitation = await self.store.invitation_by_token(digest(token), lock=lock)
        if invitation is None or invitation.status(now_utc()) != "pending":
            raise unavailable()
        if await self._active_teacher(invitation.teacher_account_id) is None:
            raise unavailable()
        return invitation

    async def require_available(self, invitation_token: str, *, lock: bool = False) -> None:
        await self.preview(invitation_token, lock=lock)

    async def invitations(
        self, actor: AccountSummary, limit: int, after: Position | None
    ) -> list[Invitation]:
        self.require_teacher(actor)
        return await self.store.list_invitations(actor.account_id, limit, after)

    async def revoke_invitation(self, actor: AccountSummary, invitation_id: UUID) -> None:
        self.require_teacher(actor)
        invitation = await self.store.invitation_by_id(invitation_id, lock=True)
        if invitation is None or invitation.teacher_account_id != actor.account_id:
            raise not_found()
        now = now_utc()
        status = invitation.status(now)
        if status == "revoked":
            return
        if status == "accepted":
            raise Problem(ProblemCode.INVITATION_ALREADY_ACCEPTED)
        if status == "expired":
            raise unavailable()
        await self.store.revoke_invitation(invitation_id, now)
        await self.store.audit(actor.account_id, "invitation_revoked", "invitation", invitation_id)

    async def accept(
        self,
        actor: AccountSummary,
        token: str,
        fields: dict,
    ) -> tuple[dict, bool]:
        invitation = await self.store.invitation_by_token(digest(token), lock=True)
        now = now_utc()
        if (
            invitation is None
            or invitation.revoked_at
            or invitation.expires_at <= now
            or invitation.teacher_account_id == actor.account_id
            or await self._active_teacher(invitation.teacher_account_id) is None
        ):
            raise unavailable()
        current_actor = await self.accounts.lookup_account(actor.account_id)
        if current_actor is None or not current_actor.can_access:
            raise unavailable()

        parent = invitation.purpose == InvitationPurpose.PARENT
        if invitation.accepted_at:
            return await self._repeat(invitation, current_actor, parent, fields), False

        name, intent = self._card_name(parent, fields, current_actor)
        card = StudentCard(
            uuid4(),
            invitation.teacher_account_id,
            None if parent else actor.account_id,
            name,
            None,
            None,
            None,
            "active",
            now,
            now,
            1,
        )
        if not await self.store.add_card(card):
            raise Problem(ProblemCode.STUDENT_CARD_ALREADY_LINKED)
        if now_utc() >= invitation.expires_at:
            raise unavailable()
        result = self._acceptance(invitation, card.student_card_id)
        await self.store.audit(
            actor.account_id, "student_card_created", "student_card", card.student_card_id
        )
        if parent:
            access = ParentAccess(uuid4(), card.student_card_id, actor.account_id, now, None)
            await self.store.add_parent_access(access)
            await self.store.audit(
                actor.account_id, "parent_access_created", "parent_access", access.parent_access_id
            )
            result["parent_access_id"] = access.parent_access_id
        else:
            await self.store.audit(
                actor.account_id, "student_account_linked", "student_card", card.student_card_id
            )
        await self.store.accept_invitation(
            invitation, actor.account_id, card.student_card_id, now, intent
        )
        await self.store.audit(
            actor.account_id, "invitation_accepted", "invitation", invitation.invitation_id
        )
        return result, True

    async def _repeat(
        self, invitation: Invitation, actor: AccountSummary, parent: bool, fields: dict
    ) -> dict:
        card_id = invitation.created_student_card_id
        if invitation.accepted_by_account_id != actor.account_id or card_id is None:
            raise unavailable()
        card = await self.store.get_card(card_id, lock=True)
        if card is None or card.status != "active" or now_utc() >= invitation.expires_at:
            raise unavailable()
        result = self._acceptance(invitation, card_id)
        if parent:
            access = await self._active_parent_access(card_id, actor.account_id)
            if access is None:
                raise unavailable()
            result["parent_access_id"] = access.parent_access_id
        elif card.student_account_id != actor.account_id:
            raise unavailable()
        _, intent = self._card_name(parent, fields, actor)
        if not hmac.compare_digest(intent, invitation.acceptance_payload_digest or ""):
            raise Problem(ProblemCode.INVITATION_ACCEPTANCE_CONFLICT)
        return result

    def _card_name(self, parent: bool, fields: dict, actor: AccountSummary) -> tuple[str, str]:
        if parent:
            raw_name = fields.get("student_card_name")
            if not isinstance(raw_name, str):
                raise Problem(ProblemCode.VALIDATION_FAILED)
            normalized = raw_name.strip()
            if not 1 <= len(normalized) <= 80 or any(
                unicodedata.category(c).startswith("C") for c in normalized
            ):
                raise Problem(ProblemCode.VALIDATION_FAILED)
            return normalized, keyed_digest(self.key, "acceptance-parent", normalized)
        if "student_card_name" in fields:
            raise Problem(ProblemCode.VALIDATION_FAILED)
        return actor.display_name, keyed_digest(self.key, "acceptance-student")

    @staticmethod
    def _acceptance(invitation: Invitation, card_id: UUID) -> dict:
        return {"purpose": invitation.purpose, "student_card_id": card_id}

    async def allows_active_card_operation(
        self, actor_account_id: UUID, student_card_id: UUID, operation: StudentCardOperation
    ) -> bool:
        if operation is not StudentCardOperation.READ and (
            operation is not StudentCardOperation.EDIT
        ):
            return False
        actor = await self.accounts.lookup_account(actor_account_id)
        if actor is None or not actor.can_access:
            return False
        changing = operation is StudentCardOperation.EDIT
        card = await self.store.get_card(student_card_id, lock=changing)
        if card is None or card.status != "active":
            return False
        if card.teacher_account_id == actor.account_id:
            return actor.teacher_enabled
        if changing or await self._active_teacher(card.teacher_account_id) is None:
            return False
        return (
            card.student_account_id == actor.account_id
            or await self._active_parent_access(student_card_id, actor.account_id) is not None
        )

    async def _active_parent_access(
        self, student_card_id: UUID, account_id: UUID
    ) -> ParentAccess | None:
        access = await self.store.parent_access_for(student_card_id, account_id)
        return access if access is not None and access.revoked_at is None else None

    async def teacher_card(
        self, actor: AccountSummary, card_id: UUID, *, lock: bool = False
    ) -> StudentCard:
        self.require_teacher(actor)
        card = await self.store.get_card(card_id, lock=lock)
        if card is None or card.teacher_account_id != actor.account_id:
            raise not_found()
        return card

    async def edit_card(
        self, actor: AccountSummary, card_id: UUID, version: int, changes: dict
    ) -> StudentCard:
        card = await self.teacher_card(actor, card_id, lock=True)
        self._check_version(card, version)
        updated = await self.store.update_card(
            card_id, {**changes, "version": version + 1, "updated_at": now_utc()}
        )
        await self.store.audit(actor.account_id, "student_card_updated", "student_card", card_id)
        return updated

    async def change_status(
        self, actor: AccountSummary, card_id: UUID, version: int, status: str
    ) -> StudentCard:
        card = await self.teacher_card(actor, card_id, lock=True)
        self._check_version(card, version)
        if card.status == status:
            return card
        now = now_utc()
        if status == "archived":
            for access in await self.store.revoke_all_parent_access(card_id, now):
                await self.store.audit(
                    actor.account_id, "parent_access_revoked", "parent_access", access
                )
        updated = await self.store.update_card(
            card_id, {"status": status, "version": version + 1, "updated_at": now}
        )
        event = "student_card_archived" if status == "archived" else "student_card_restored"
        await self.store.audit(actor.account_id, event, "student_card", card_id)
        return updated

    @staticmethod
    def _check_version(card: StudentCard, version: int) -> None:
        if card.version != version:
            raise Problem(ProblemCode.VERSION_CONFLICT)

    async def teacher_cards(
        self, actor: AccountSummary, status: str, limit: int, after: Position | None
    ) -> list[StudentCard]:
        self.require_teacher(actor)
        return [
            card
            for card, _ in await self.store.list_cards(
                actor.account_id, "teacher", status, limit, after
            )
        ]

    async def cabinet_card(self, actor: AccountSummary, card_id: UUID, role: str) -> CabinetCard:
        card = await self.store.get_card(card_id)
        if card is None or card.status != "active":
            raise not_found()
        access_id = None
        if role == "student":
            if card.student_account_id != actor.account_id:
                raise not_found()
        else:
            access = await self._active_parent_access(card_id, actor.account_id)
            if access is None:
                raise not_found()
            access_id = access.parent_access_id
        teacher = await self._active_teacher(card.teacher_account_id)
        if teacher is None:
            raise not_found()
        return CabinetCard(card, teacher.display_name, access_id)

    async def cabinet_cards(
        self, actor: AccountSummary, role: str, limit: int, after: Position | None
    ) -> list[CabinetCard]:
        visible = []
        while len(visible) < limit:
            rows = await self.store.list_cards(actor.account_id, role, "active", limit, after)
            for card, access_id in rows:
                teacher = await self._active_teacher(card.teacher_account_id)
                if teacher:
                    visible.append(CabinetCard(card, teacher.display_name, access_id))
                    if len(visible) == limit:
                        return visible
            if len(rows) < limit:
                break
            last = rows[-1][0]
            after = last.updated_at, last.student_card_id
        return visible

    async def access_list(
        self, actor: AccountSummary, card_id: UUID, limit: int, after: Position | None
    ) -> list[tuple[ParentAccess, dict]]:
        await self.teacher_card(actor, card_id)
        rows = await self.store.list_parent_access(card_id, limit, after)
        results = []
        for access in rows:
            parent = await self.accounts.lookup_account(access.parent_account_id)
            results.append(
                (
                    access,
                    {
                        "parent_access_id": access.parent_access_id,
                        "student_card_id": card_id,
                        "parent_display_name": parent.display_name if parent else None,
                        "status": "revoked" if access.revoked_at else "active",
                    },
                )
            )
        return results

    async def revoke_access(self, actor: AccountSummary, access_id: UUID) -> None:
        access = await self.store.parent_access_by_id(access_id)
        if access is None:
            raise not_found()
        card = await self.store.get_card(access.student_card_id, lock=True)
        if card is None or (
            actor.account_id != access.parent_account_id
            and (actor.account_id != card.teacher_account_id or not actor.teacher_enabled)
        ):
            raise not_found()
        if await self.store.revoke_parent_access(access_id, now_utc()):
            await self.store.audit(
                actor.account_id, "parent_access_revoked", "parent_access", access_id
            )
