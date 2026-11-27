"""Интервалы записи, перерывы, свободные остатки и конечные состояния резерва."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest

from app.modules.scheduling.domain.availability import (
    AvailabilityAudience,
    AvailabilityPublication,
    BookingMode,
    BusyInterval,
    TimeWindow,
    available_slots,
    free_intervals,
)
from app.modules.scheduling.domain.bookings import Booking, BookingState
from app.modules.scheduling.domain.exceptions import LessonError
from app.modules.scheduling.domain.values import LessonPrice


pytestmark = [
    pytest.mark.br_062,
    pytest.mark.br_063,
    pytest.mark.br_064,
    pytest.mark.br_065,
    pytest.mark.br_066,
    pytest.mark.br_067,
    pytest.mark.br_068,
    pytest.mark.br_069,
    pytest.mark.br_070,
]


def test_cells_preserve_free_remainder_and_respect_breaks_without_doubling():
    now = datetime(2026, 1, 1, tzinfo=UTC)
    start = now + timedelta(days=1)
    publication = AvailabilityPublication(
        uuid4(),
        uuid4(),
        (TimeWindow(start, start + timedelta(hours=4)),),
        "UTC",
        60,
        10,
        10,
        LessonPrice(Decimal(100)),
        BookingMode.INSTANT,
        AvailabilityAudience(),
    )
    busy = (BusyInterval(start, start + timedelta(hours=1), 10),)
    slots = available_slots(publication, start, start + timedelta(hours=4), now, busy, 100)

    assert slots[0].starts_at == start + timedelta(minutes=70)
    assert slots[-1].ends_at == start + timedelta(hours=4)

    with pytest.raises(LessonError, match="availability_limit"):
        available_slots(publication, start, start + timedelta(hours=4), now, (), 1)

    free = free_intervals(
        publication.windows,
        (TimeWindow(start + timedelta(hours=1), start + timedelta(hours=2)),),
        start,
        start + timedelta(hours=4),
        100,
    )

    assert [(w.starts_at, w.ends_at) for w in free] == [
        (start, start + timedelta(hours=1)),
        (start + timedelta(hours=2), start + timedelta(hours=4)),
    ]


def test_reservation_is_single_decision_and_expires_before_start():
    now = datetime(2026, 1, 1, tzinfo=UTC)
    start = now + timedelta(hours=1)
    publication = AvailabilityPublication(
        uuid4(),
        uuid4(),
        (TimeWindow(start, start + timedelta(hours=1)),),
        "UTC",
        60,
        60,
        0,
        LessonPrice(Decimal(100)),
        BookingMode.APPROVAL,
        AvailabilityAudience(),
    )
    booking = Booking.create(uuid4(), publication, uuid4(), uuid4(), start, now, timedelta(days=1))

    assert booking.expires_at == start

    accepted = booking.decide(BookingState.ACCEPTED, publication.teacher_id, now, uuid4())

    with pytest.raises(LessonError, match="booking_conflict"):
        accepted.decide(BookingState.REJECTED, publication.teacher_id, now)

    with pytest.raises(LessonError, match="booking_conflict"):
        booking.decide(BookingState.REJECTED, publication.teacher_id, start)

    with pytest.raises(LessonError, match="invalid_availability"):
        booking.decide(BookingState.ACCEPTED, publication.teacher_id, now)

    with pytest.raises(LessonError, match="availability_conflict"):
        replace(publication, version=2).require_version(1)


def test_availability_limits_and_invalid_audiences_are_explicit():
    now = datetime(2026, 1, 1, tzinfo=UTC)
    windows = (
        TimeWindow(now, now + timedelta(hours=1)),
        TimeWindow(now + timedelta(hours=2), now + timedelta(hours=3)),
    )

    with pytest.raises(LessonError, match="availability_limit"):
        free_intervals(windows, (), now, now + timedelta(days=1), 1)

    with pytest.raises(LessonError, match="invalid_availability"):
        AvailabilityAudience(True, (uuid4(),))

    with pytest.raises(LessonError, match="invalid_availability"):
        TimeWindow(now, now)
