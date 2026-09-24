"""Run from openbb-backend/: ../envs/finrl/bin/uvicorn is the server; tests use ../envs/finrl/bin/python -m pytest.
Importing widgets.finrl_signal loads the five trained agents from finrl-work/ (a few seconds)."""
from datetime import datetime, date

import pandas as pd
import pytest

from widgets import finrl_signal
from widgets.finrl_signal import complete_sessions


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


def test_signal_rejects_ticker_in_no_basket():
    with pytest.raises(finrl_signal.HTTPException) as e:
        finrl_signal.finrl_signal("XOM")  # in neither dow30 nor tech30 (NVDA/TSLA are, so they would compute)
    assert e.value.status_code == 404


def test_baskets_are_configured_and_frozen():
    """Every basket must expose exactly the 30 tickers its models were trained on."""
    ids = [b["id"] for b in finrl_signal.BASKETS]
    assert "dow30" in ids, "the Phase 2 baseline models are missing"
    for b in finrl_signal.BASKETS:
        assert len(b["tickers"]) == len(set(b["tickers"])) == 30
        assert len(b["models"]) == 5


def _bars(rows):
    return pd.DataFrame([{"date": d, "tic": t, "close": c} for d, t, c in rows])


def test_complete_sessions_drops_a_partial_day_not_the_tickers():
    """The 2026-09-22 case: one session carried 11 of 30 tickers, and clean_data would have
    dropped the other 19 tickers outright, shrinking the observation below the model's."""
    df = _bars([("2026-09-21", t, 10.0) for t in "ABC"] +
               [("2026-09-22", "A", 11.0)] +  # partial session
               [("2026-09-23", t, 12.0) for t in "ABC"])
    out = complete_sessions(df, 3)
    assert sorted(out["date"].unique()) == ["2026-09-21", "2026-09-23"]
    assert sorted(out["tic"].unique()) == ["A", "B", "C"]


def test_complete_sessions_treats_a_null_close_as_missing():
    df = _bars([("2026-09-21", t, 10.0) for t in "AB"] +
               [("2026-09-22", "A", 11.0), ("2026-09-22", "B", None)])
    assert list(complete_sessions(df, 2)["date"].unique()) == ["2026-09-21"]
