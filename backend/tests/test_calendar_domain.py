"""Проверки границы значений времени между API и кабинетом."""

from datetime import datetime

import pytest

from app.modules.identity.domain.values import ProfileChange
from app.modules.scheduling.domain.calendar import CalendarError, resolve_start


@pytest.mark.br_002
def test_system_timezone_is_rejected():
    with pytest.raises(ValueError, match="часовой пояс"):
        ProfileChange({"timezone": "localtime"})


@pytest.mark.br_004
def test_calendar_rejects_utc_overflow():
    with pytest.raises(CalendarError):
        resolve_start(datetime.min, "Etc/GMT-7")
