from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.modules.students.domain.student import Invitation, InvitationPurpose


def test_pending_invitation_expires_at_exact_deadline():
    start = datetime(2026, 11, 18, tzinfo=UTC)
    deadline = start + timedelta(hours=72)
    invitation = Invitation(
        uuid4(), uuid4(), InvitationPurpose.STUDENT, start, deadline, None, None, None, None, None
    )
    assert invitation.status(deadline - timedelta(microseconds=1)) == "pending"
    assert invitation.status(deadline) == "expired"


def test_acceptance_is_terminal_after_deadline():
    start = datetime(2026, 11, 18, tzinfo=UTC)
    deadline = start + timedelta(hours=72)
    invitation = Invitation(
        uuid4(),
        uuid4(),
        InvitationPurpose.PARENT,
        start,
        deadline,
        None,
        start + timedelta(hours=1),
        uuid4(),
        uuid4(),
        "acceptance-digest",
    )
    assert invitation.status(deadline) == "accepted"
