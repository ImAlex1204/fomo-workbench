"""Run from openbb-backend/: ../envs/finrl/bin/uvicorn is the server; tests use ../envs/finrl/bin/python -m pytest.
Importing widgets.finrl_signal loads the five trained agents from finrl-work/ (a few seconds)."""
from datetime import datetime, date

import pytest

from widgets import finrl_signal


class _FixedNow:
    def __init__(self, dt):
        self.dt = dt

    def now(self, tz):
        return self.dt.replace(tzinfo=tz)


@pytest.mark.parametrize("et_now, expected", [
    (datetime(2026, 9, 21, 15, 59), date(2026, 9, 20)),
    (datetime(2026, 9, 21, 16, 0), date(2026, 9, 21)),
    (datetime(2026, 9, 19, 10, 0), date(2026, 9, 18)),
])
def test_last_complete_session(monkeypatch, et_now, expected):
    monkeypatch.setattr(finrl_signal, "datetime", _FixedNow(et_now))
    assert finrl_signal.last_complete_session() == expected


def test_signal_rows_reject_non_dow30():
    with pytest.raises(finrl_signal.HTTPException) as e:
        finrl_signal.finrl_signal("TSLA")  # NVDA is in the DOW 30 since 2024-11
    assert e.value.status_code == 404
