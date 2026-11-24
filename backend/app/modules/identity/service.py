import hashlib
import hmac
import logging
import secrets
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from sqlalchemy import Engine, case, delete, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, sessionmaker

from app.modules.identity.delivery import ContactKind, DeliveryUnavailable
from app.modules.identity.models import Account, LoginSession, RateWindow, Registration

logger = logging.getLogger(__name__)
Delivery = Callable[[ContactKind, str, str], None]
SESSION_LIFETIME = timedelta(days=7)
CODE_LIFETIME = timedelta(minutes=10)
CODE_COOLDOWN = timedelta(seconds=45)
CODE_ATTEMPTS = 5


class IdentityError(Exception):
    """Ожидаемый отказ операции Identity."""

    def __init__(self, code: str):
        self.code = code


@dataclass(frozen=True)
class SignedIn:
    account: Account
    session_token: str
    csrf_token: str


class Identity:
    def __init__(
        self, engine: Engine, secret: bytes, deliver: Delivery, *, secure_cookie: bool
    ):
        self.sessions = sessionmaker(engine, expire_on_commit=False)
        self.secret = secret
        self.deliver = deliver
        self.secure_cookie = secure_cookie
        self.cookie_name = (
            "__Host-tutorflow_session" if secure_cookie else "tutorflow_session"
        )
        self.passwords = PasswordHasher(
            time_cost=2, memory_cost=19 * 1024, parallelism=1
        )
        self.dummy_hash = self.passwords.hash(secrets.token_hex(32))

    def _digest(self, *parts: str) -> str:
        return hmac.digest(self.secret, "\0".join(parts).encode(), "sha256").hex()

    def _rate_limit(
        self, purpose: str, identity: str, limit: int, period: timedelta, now: datetime
    ) -> None:
        key = self._digest("rate", purpose, identity)
        expired = RateWindow.reset_at <= now
        statement = (
            insert(RateWindow)
            .values(key=key, attempts=1, reset_at=now + period)
            .on_conflict_do_update(
                index_elements=[RateWindow.key],
                set_={
                    "attempts": case((expired, 1), else_=RateWindow.attempts + 1),
                    "reset_at": case(
                        (expired, now + period), else_=RateWindow.reset_at
                    ),
                },
                where=or_(expired, RateWindow.attempts < limit),
            )
            .returning(RateWindow.key)
        )
        with self.sessions.begin() as db:
            if db.scalar(statement) is None:
                raise IdentityError("rate_limited")

    @staticmethod
    def _find_account(db: Session, kind: ContactKind, contact: str) -> Account | None:
        return db.scalar(
            select(Account).where(
                Account.contact_kind == kind, Account.contact == contact
            )
        )

    def start_registration(
        self, kind: ContactKind, contact: str, ip: str
    ) -> tuple[UUID, str | None]:
        now = datetime.now(UTC)
        self._rate_limit("register-ip", ip, 30, timedelta(hours=1), now)
        self._rate_limit(
            "register-contact", f"{kind}:{contact}", 5, timedelta(hours=1), now
        )

        challenge_id = uuid4()
        code = f"{secrets.randbelow(100_000_000):08d}"
        values = {
            "id": challenge_id,
            "code_digest": self._digest("registration", str(challenge_id), code),
            "sent_at": now,
            "expires_at": now + CODE_LIFETIME,
            "remaining_attempts": CODE_ATTEMPTS,
        }
        with self.sessions.begin() as db:
            if self._find_account(db, kind, contact) is not None:
                return challenge_id, None
            statement = (
                insert(Registration)
                .values(contact_kind=kind, contact=contact, **values)
                .on_conflict_do_update(
                    index_elements=[Registration.contact_kind, Registration.contact],
                    set_=values,
                    where=Registration.sent_at <= now - CODE_COOLDOWN,
                )
                .returning(Registration.id)
            )
            created = db.scalar(statement)
            if created is None:
                current_id = db.scalar(
                    select(Registration.id).where(
                        Registration.contact_kind == kind,
                        Registration.contact == contact,
                    )
                )
                return current_id or challenge_id, None
        return challenge_id, code

    def deliver_code(self, kind: ContactKind, contact: str, code: str) -> None:
        try:
            self.deliver(kind, contact, code)
        except DeliveryUnavailable:
            logger.warning("Канал подтверждения недоступен: %s", kind)

    def finish_registration(
        self,
        challenge_id: UUID,
        code: str,
        password: str,
        ip: str,
        previous_token: str | None,
    ) -> SignedIn:
        now = datetime.now(UTC)
        self._rate_limit("confirm-ip", ip, 60, timedelta(minutes=10), now)
        with self.sessions.begin() as db:
            challenge = db.scalar(
                select(Registration)
                .where(Registration.id == challenge_id)
                .with_for_update()
            )
            if (
                challenge is not None
                and challenge.expires_at > now
                and challenge.remaining_attempts > 0
            ):
                digest = self._digest("registration", str(challenge_id), code)
                if hmac.compare_digest(digest, challenge.code_digest):
                    statement = (
                        insert(Account)
                        .values(
                            id=uuid4(),
                            contact_kind=challenge.contact_kind,
                            contact=challenge.contact,
                            role="teacher",
                            password_hash=self.passwords.hash(password),
                            verified_at=now,
                        )
                        .on_conflict_do_nothing(
                            index_elements=[Account.contact_kind, Account.contact]
                        )
                        .returning(Account)
                    )
                    account = db.scalar(statement)
                    db.delete(challenge)
                    if account is not None:
                        return self._sign_in(db, account, previous_token, now)
                else:
                    challenge.remaining_attempts -= 1

        raise IdentityError("challenge_invalid")

    def login(
        self,
        kind: ContactKind,
        contact: str,
        password: str,
        ip: str,
        previous_token: str | None,
    ) -> SignedIn:
        now = datetime.now(UTC)
        self._rate_limit("login-ip", ip, 60, timedelta(minutes=10), now)
        self._rate_limit(
            "login-contact", f"{kind}:{contact}", 10, timedelta(minutes=10), now
        )
        with self.sessions.begin() as db:
            account = self._find_account(db, kind, contact)
            try:
                self.passwords.verify(
                    account.password_hash if account else self.dummy_hash, password
                )
            except (InvalidHashError, VerificationError):
                raise IdentityError("invalid_credentials") from None
            if account is None:
                raise IdentityError("invalid_credentials")
            return self._sign_in(db, account, previous_token, now)

    def _sign_in(
        self, db: Session, account: Account, previous_token: str | None, now: datetime
    ) -> SignedIn:
        if previous_token:
            db.execute(
                delete(LoginSession).where(
                    LoginSession.token_digest == self._token_digest(previous_token)
                )
            )
        token = secrets.token_urlsafe(32)
        db.add(
            LoginSession(
                token_digest=self._token_digest(token),
                account_id=account.id,
                expires_at=now + SESSION_LIFETIME,
            )
        )
        return SignedIn(account, token, self.csrf_token(token))

    @staticmethod
    def _token_digest(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    def csrf_token(self, token: str) -> str:
        return self._digest("csrf", token)

    def current_account(self, token: str) -> Account:
        with self.sessions() as db:
            account = db.scalar(
                select(Account)
                .join(LoginSession, Account.id == LoginSession.account_id)
                .where(
                    LoginSession.token_digest == self._token_digest(token),
                    LoginSession.expires_at > datetime.now(UTC),
                )
            )
        if account is None:
            raise IdentityError("authentication_required")
        return account

    def logout(self, token: str) -> None:
        with self.sessions.begin() as db:
            db.execute(
                delete(LoginSession).where(
                    LoginSession.token_digest == self._token_digest(token)
                )
            )

    def update_profile(
        self, account_id: UUID, changes: dict[str, str | None]
    ) -> Account:
        with self.sessions.begin() as db:
            statement = (
                update(Account)
                .where(Account.id == account_id)
                .values(**changes)
                .returning(Account)
            )
            account = db.scalar(statement)
            if account is None:
                raise IdentityError("authentication_required")
            return account
