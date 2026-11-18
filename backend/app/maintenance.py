"""Очистка истёкших технических данных и закрытого dev inbox."""

import argparse
import logging
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from time import sleep

from sqlalchemy import Connection, create_engine, delete, func, or_, update
from sqlalchemy.pool import NullPool

from app.config import CHALLENGE_MINUTES, SESSION_IDLE_HOURS
from app.modules.identity.infrastructure.models import challenges, sessions
from app.modules.students.infrastructure.persistence.models import audit_events, invitations
from app.shared.infrastructure.rate_limit import rate_limits

logger = logging.getLogger("maintenance")


def prune(db: Connection, now: datetime, session_idle_hours: int) -> None:
    db.execute(
        delete(challenges).where(
            or_(challenges.c.expires_at <= now, challenges.c.consumed_at.is_not(None))
        )
    )
    db.execute(
        delete(sessions).where(
            or_(
                sessions.c.expires_at <= now,
                sessions.c.revoked_at.is_not(None),
                sessions.c.last_seen_at <= now - timedelta(hours=session_idle_hours),
            )
        )
    )
    db.execute(delete(rate_limits).where(rate_limits.c.expires_at <= now))
    closed_at = func.coalesce(
        invitations.c.revoked_at, invitations.c.accepted_at, invitations.c.expires_at
    )
    db.execute(delete(invitations).where(closed_at <= now - timedelta(days=30)))
    db.execute(
        update(invitations)
        .where(
            or_(invitations.c.expires_at <= now, invitations.c.revoked_at.is_not(None)),
            or_(
                invitations.c.token_digest.is_not(None),
                invitations.c.acceptance_payload_digest.is_not(None),
            ),
        )
        .values(token_digest=None, acceptance_payload_digest=None)
    )
    db.execute(delete(audit_events).where(audit_events.c.occurred_at <= now - timedelta(days=90)))


def prune_pickup(directory: Path, cutoff: datetime) -> None:
    if directory.is_symlink() or directory.stat().st_mode & 0o077:
        raise OSError("Dev inbox должен быть закрытым каталогом")
    for path in directory.glob("*.txt"):
        try:
            if path.lstat().st_mtime <= cutoff.timestamp():
                path.unlink()
        except FileNotFoundError:
            continue


def main() -> int:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--loop", action="store_true")
    args = parser.parse_args()
    inbox_path = os.getenv("TUTORFLOW_LOCAL_INBOX")
    if inbox_path and os.getenv("TUTORFLOW_APP_ENV") != "development":
        parser.error("Очистка локального inbox разрешена только в dev")
    engine = create_engine(
        os.environ["TUTORFLOW_DATABASE_URL"], poolclass=NullPool, hide_parameters=True
    )
    while True:
        try:
            now = datetime.now(UTC)
            with engine.begin() as db:
                prune(db, now, SESSION_IDLE_HOURS)
            if inbox_path:
                prune_pickup(Path(inbox_path), now - timedelta(minutes=CHALLENGE_MINUTES))
            if args.loop:
                Path("/tmp/tutorflow-maintenance-alive").touch()
        except Exception as error:
            logger.error("cleanup_failed error=%s", type(error).__name__)
            if not args.loop:
                return 1
        if not args.loop:
            return 0
        sleep(60)


if __name__ == "__main__":
    raise SystemExit(main())
