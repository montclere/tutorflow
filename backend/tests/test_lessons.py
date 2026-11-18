"""Правила календаря, независимые от HTTP."""

from datetime import UTC, datetime

from app.modules.lessons.domain.calendar import weekly_intervals


def test_series_keeps_local_time_across_dst():
    intervals = weekly_intervals(datetime(2027, 3, 21, 17), "Europe/Berlin", 2, 60)
    assert [start for start, _ in intervals] == [
        datetime(2027, 3, 21, 16, tzinfo=UTC),
        datetime(2027, 3, 28, 15, tzinfo=UTC),
    ]


def test_series_requires_explicit_choice_for_repeated_local_time():
    intervals = weekly_intervals(datetime(2027, 10, 31, 2, 30), "Europe/Berlin", 1, 60, "later")
    assert intervals[0][0] == datetime(2027, 10, 31, 1, 30, tzinfo=UTC)
