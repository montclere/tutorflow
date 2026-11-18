"""Очистка истёкших технических данных и закрытого dev inbox."""

import argparse
import logging
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from time import sleep

from sqlalchemy import Connection, Engine, create_engine, delete, func, or_, select, update
from sqlalchemy.pool import NullPool

from app.config import CHALLENGE_MINUTES, SESSION_IDLE_HOURS
from app.modules.identity.infrastructure.models import challenges, sessions
from app.modules.lessons.domain.calendar import Calendar, instant
from app.modules.lessons.infrastructure.repository import lesson_calendars
from app.modules.students.infrastructure.persistence.models import (
    audit_events,
    invitations,
    parent_applications,
    student_cards,
)
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
    db.execute(
        delete(parent_applications).where(
            func.coalesce(parent_applications.c.decided_at, parent_applications.c.expires_at)
            <= now - timedelta(days=30)
        )
    )
    db.execute(
        update(parent_applications)
        .where(
            parent_applications.c.expires_at <= now,
            parent_applications.c.token_digest.is_not(None),
        )
        .values(token_digest=None)
    )
    db.execute(delete(audit_events).where(audit_events.c.occurred_at <= now - timedelta(days=90)))


def prepare_calendars(engine: Engine, now: datetime) -> None:
    with engine.connect() as db:
        candidates = list(
            db.execute(
                select(lesson_calendars.c.card_id, lesson_calendars.c.teacher_id)
                .join(student_cards, student_cards.c.student_card_id == lesson_calendars.c.card_id)
                .where(student_cards.c.status == "active")
            )
        )
    for card_id, teacher_id in candidates:
        with engine.begin() as db:
            active = db.scalar(
                select(student_cards.c.status)
                .where(student_cards.c.student_card_id == card_id)
                .with_for_update(skip_locked=True)
            )
            if active != "active":
                continue
            key = int.from_bytes(teacher_id.bytes[:8], signed=True)
            if not db.scalar(select(func.pg_try_advisory_xact_lock(key))):
                continue
            payload = db.scalar(
                select(lesson_calendars.c.payload).where(lesson_calendars.c.card_id == card_id)
            )
            if payload is None:
                continue
            calendar = Calendar(str(card_id), **payload)
            changed = calendar.prepare(now)
            for replay_key, entry in list(calendar.keys.items()):
                if entry.get("until") and instant(entry["until"]) <= now:
                    del calendar.keys[replay_key]
                    changed = True
            if changed:
                db.execute(
                    update(lesson_calendars)
                    .where(lesson_calendars.c.card_id == card_id)
                    .values(payload=calendar.data())
                )


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
            prepare_calendars(engine, now)
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
