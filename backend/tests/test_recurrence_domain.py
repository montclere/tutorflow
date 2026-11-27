"""Календарные границы повторений, счёт и явное разрешение переходов часов."""

from datetime import UTC, date, datetime, time

import pytest

from app.modules.scheduling.domain.recurrence import Frequency, RecurrenceRule, WeeklySlot


@pytest.mark.br_037
@pytest.mark.br_038
def test_monthly_rule_skips_missing_day_without_consuming_count():
    rule = RecurrenceRule(date(2030, 1, 31), time(10), "UTC", Frequency.MONTHLY, count=3)
    result = rule.expand(datetime(2030, 1, 1, tzinfo=UTC), datetime(2030, 6, 1, tzinfo=UTC), 100)

    assert [item.local_date for item in result.occurrences] == [
        date(2030, 1, 31),
        date(2030, 3, 31),
        date(2030, 5, 31),
    ]


@pytest.mark.br_037
@pytest.mark.br_038
def test_weekly_slots_keep_local_time_and_individual_duration():
    rule = RecurrenceRule(
        date(2030, 1, 7),
        time(10),
        "Europe/Berlin",
        Frequency.WEEKLY,
        interval=2,
        weekly_slots=(WeeklySlot(0, time(10), 45), WeeklySlot(2, time(12), 90)),
        count=4,
    )
    result = rule.expand(datetime(2030, 1, 1, tzinfo=UTC), datetime(2030, 2, 1, tzinfo=UTC), 100)

    assert [
        (item.local_date.day, item.starts_at.hour, item.duration_minutes)
        for item in result.occurrences
    ] == [(7, 9, 45), (9, 11, 90), (21, 9, 45), (23, 11, 90)]


@pytest.mark.br_037
def test_dst_requires_resolution_and_never_silently_shifts_time():
    start, end = datetime(2030, 3, 30, tzinfo=UTC), datetime(2030, 4, 2, tzinfo=UTC)
    rule = RecurrenceRule(date(2030, 3, 30), time(2, 30), "Europe/Berlin", Frequency.DAILY)
    unresolved = rule.expand(start, end, 100)

    assert [(item.local_date, item.code) for item in unresolved.conflicts] == [
        (date(2030, 3, 31), "nonexistent_local_time")
    ]
    assert [item.local_date.day for item in unresolved.occurrences] == [30, 1]

    fall = RecurrenceRule(
        date(2030, 10, 27), time(2, 30), "Europe/Berlin", Frequency.DAILY, count=1
    )
    result = fall.expand(
        datetime(2030, 10, 27, tzinfo=UTC), datetime(2030, 10, 28, tzinfo=UTC), 100
    )

    assert result.occurrences == ()
    assert result.conflicts[0].code == "ambiguous_local_time"

    chosen = RecurrenceRule(
        date(2030, 10, 27),
        time(2, 30),
        "Europe/Berlin",
        Frequency.DAILY,
        count=1,
        ambiguous_time="later",
    )

    assert (
        chosen.expand(datetime(2030, 10, 27, tzinfo=UTC), datetime(2030, 10, 28, tzinfo=UTC), 100)
        .occurrences[0]
        .starts_at.hour
        == 1
    )


@pytest.mark.br_038
def test_until_is_inclusive_and_expansion_budget_rejects_partial_results():
    from app.modules.scheduling.domain.exceptions import LessonError


    rule = RecurrenceRule(
        date(2030, 1, 1), time(10), "UTC", Frequency.DAILY, until=date(2030, 1, 3)
    )
    start, end = datetime(2030, 1, 1, tzinfo=UTC), datetime(2030, 1, 10, tzinfo=UTC)

    assert len(rule.expand(start, end, 10).occurrences) == 3

    with pytest.raises(LessonError, match="series_expansion_limit"):
        rule.expand(start, end, 2)

    with pytest.raises(LessonError, match="invalid_series_rule"):
        RecurrenceRule(
            date(2030, 1, 1), time(10), "UTC", Frequency.DAILY, until=date(2030, 1, 3), count=3
        )


@pytest.mark.br_037
def test_unresolved_time_outside_requested_hours_does_not_block_calendar():
    rule = RecurrenceRule(date(2030, 10, 27), time(2, 30), "Europe/Berlin", Frequency.DAILY)
    result = rule.expand(
        datetime(2030, 10, 27, 12, tzinfo=UTC), datetime(2030, 10, 27, 14, tzinfo=UTC), 10
    )

    assert result.occurrences == () and result.conflicts == ()
