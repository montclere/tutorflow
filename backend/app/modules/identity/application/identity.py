import hmac
import logging
import secrets
from dataclasses import dataclass, field
from datetime import timedelta
from uuid import UUID, uuid4

from app.shared.application.contracts.accounts import AccountSummary, InvitationAvailability
from app.shared.application.ports.clock import now_utc
from app.shared.application.security import digest, keyed_digest, new_token
from app.shared.domain.errors import Problem, ProblemCode

from ..domain.accounts import Account, Challenge, Contact, Session
from .ports import CodeDelivery, IdentityRepository, Passwords

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class IssuedCode:
    challenge_id: UUID
    contact: Contact | None = field(default=None, repr=False)
    code: str | None = field(default=None, repr=False)


@dataclass(frozen=True)
class IdentityPolicy:
    challenge_minutes: int
    challenge_attempts: int
    session_days: int
    session_idle_hours: int
    anonymous_minutes: int
    max_active_sessions: int


@dataclass(frozen=True)
class NewSession:
    session: Session
    token: str


class Identity:
    def __init__(
        self,
        store: IdentityRepository,
        delivery: CodeDelivery,
        passwords: Passwords,
        invitations: InvitationAvailability,
        key: str,
        policy: IdentityPolicy,
    ):
        self.store = store
        self.delivery = delivery
        self.passwords = passwords
        self.invitations = invitations
        self.key = key
        self.policy = policy

    async def session(self, token: str | None) -> Session | None:
        if not token:
            return None
        now = now_utc()
        session = await self.store.find_session(digest(token), now)
        if session is None:
            return None
        if session.account_id is not None:
            if session.last_seen_at <= now - timedelta(hours=self.policy.session_idle_hours):
                return None
        return session

    async def actor(self, session: Session | None) -> AccountSummary:
        account = (
            await self.store.lookup_account(session.account_id)
            if session and session.account_id
            else None
        )
        if account is None or not account.can_access:
            raise Problem(ProblemCode.AUTHENTICATION_REQUIRED)
        return account

    async def new_session(
        self, account: Account | None = None, previous: Session | None = None
    ) -> NewSession:
        now = now_utc()
        if previous:
            await self.store.revoke_session(previous.session_id, previous.account_id, now)
        token = new_token()
        expires = (
            timedelta(days=self.policy.session_days)
            if account
            else timedelta(minutes=self.policy.anonymous_minutes)
        )
        session = Session(
            uuid4(),
            account.account_id if account else None,
            new_token(),
            now,
            now,
            now + expires,
        )
        await self.store.add_session(session, digest(token))
        if account:
            await self.store.trim_sessions(account.account_id, now, self.policy.max_active_sessions)
        return NewSession(session, token)

    async def registration(self, contact: Contact, token: str | None) -> IssuedCode:
        if token is not None:
            await self.invitations.require_available(token)
        if await self.store.find_account(contact) is not None:
            return IssuedCode(uuid4())
        return await self._issue_challenge(contact, "registration", token, None)

    async def request_reset(self, contact: Contact) -> IssuedCode:
        account = await self.store.find_account(contact, lock=True)
        if not account or account.status != "active":
            return IssuedCode(uuid4())
        await self.store.clear_reset_challenges(account.account_id)
        return await self._issue_challenge(contact, "password_reset", None, account.account_id)

    async def _issue_challenge(
        self,
        contact: Contact,
        purpose: str,
        token: str | None,
        account_id: UUID | None,
    ) -> IssuedCode:
        challenge_id = uuid4()
        code = f"{secrets.randbelow(100_000_000):08d}"
        await self.store.add_challenge(
            Challenge(
                challenge_id,
                contact.type,
                contact.value if account_id is None else "",
                purpose,
                self._code_digest(challenge_id, purpose, code),
                digest(token) if token else None,
                now_utc() + timedelta(minutes=self.policy.challenge_minutes),
                None,
                account_id,
                0,
            )
        )
        return IssuedCode(challenge_id, contact, code)

    async def deliver_code(self, issued: IssuedCode, request_id: UUID) -> None:
        if issued.contact is None or issued.code is None:
            return
        try:
            await self.delivery.send(issued.contact.type, issued.contact.value, issued.code)
        except Exception as error:
            logger.warning(
                "code_delivery_failed request_id=%s channel=%s error=%s",
                request_id,
                issued.contact.type,
                type(error).__name__,
            )

    def _code_digest(self, challenge_id: UUID, purpose: str, code: str) -> str:
        return keyed_digest(self.key, "contact-challenge", str(challenge_id), purpose, code)

    async def _verify_challenge(
        self, challenge_id: UUID, purpose: str, code: str, token: str | None = None
    ) -> Challenge | None:
        challenge = await self.store.get_challenge(challenge_id)
        if (
            challenge is None
            or challenge.purpose != purpose
            or challenge.consumed_at
            or challenge.expires_at <= now_utc()
            or challenge.failed_attempts >= self.policy.challenge_attempts
        ):
            return None
        if challenge.invitation_digest != (
            digest(token) if token else None
        ) or not hmac.compare_digest(
            challenge.code_digest, self._code_digest(challenge_id, purpose, code)
        ):
            if challenge.failed_attempts + 1 >= self.policy.challenge_attempts:
                await self.store.consume_challenge(challenge_id)
            else:
                await self.store.fail_challenge(challenge)
            return None
        return challenge

    async def complete_registration(
        self,
        challenge_id: UUID,
        code: str,
        password: str,
        name: str,
        timezone: str,
        token: str | None,
        session: Session,
    ) -> tuple[Account, NewSession] | None:
        challenge = await self._verify_challenge(challenge_id, "registration", code, token)
        if challenge is None:
            return None
        password_hash = await self.passwords.hash(password)
        if token:
            await self.invitations.require_available(token, lock=True)
        now = now_utc()
        if challenge.expires_at <= now:
            return None
        account = await self.store.create_account(
            Contact(challenge.contact_type, challenge.contact), password_hash, name, timezone, now
        )
        await self.store.consume_challenge(challenge_id)
        if account is None:
            return None
        return account, await self.new_session(account, session)

    async def login(
        self,
        contact: Contact,
        password: str,
        session: Session,
    ) -> tuple[Account, NewSession]:
        account = await self.store.find_account(contact, lock=True)
        verified = await self.passwords.verify(password, account.password_hash if account else None)
        if not verified or account is None or account.status != "active":
            raise Problem(ProblemCode.INVALID_CREDENTIALS)
        return account, await self.new_session(account, session)

    async def reset_password(self, challenge_id: UUID, code: str, password: str) -> bool:
        hint = await self.store.get_challenge(challenge_id, lock=False)
        if hint is None or hint.purpose != "password_reset" or hint.account_id is None:
            return False
        account = await self.store.get_account(hint.account_id, lock=True)
        if account is None or account.status != "active":
            return False
        challenge = await self._verify_challenge(challenge_id, "password_reset", code)
        if challenge is None:
            return False
        password_hash = await self.passwords.hash(password)
        now = now_utc()
        if challenge.expires_at <= now:
            return False
        await self.store.set_password(account.account_id, password_hash, now)
        await self.store.revoke_sessions(account.account_id, now)
        return True
