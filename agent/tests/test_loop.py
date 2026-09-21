"""Pure-function tests for the agent. Run from agent/: ../envs/fingpt/bin/python -m pytest"""
from datetime import datetime, date

import pytest

from loop import _gemini_schema
from tools import fingpt_tool


def test_gemini_schema_drops_provider_and_collapses_nullable_types():
    schema = {
        "type": "object",
        "properties": {
            "symbol": {"type": "string", "description": "Ticker"},
            "provider": {"type": "string", "enum": ["yfinance", "fmp"]},
            "start_date": {"anyOf": [{"type": "string", "format": "date"}, {"type": "null"}], "description": "Start", "default": None},
            "limit": {"type": "integer", "minimum": 1, "title": "Limit"},
        },
        "required": ["symbol", "provider"],
    }
    out = _gemini_schema(schema)
    assert out == {
        "type": "object",
        "properties": {
            "symbol": {"type": "string", "description": "Ticker"},
            "start_date": {"type": "string", "format": "date", "description": "Start"},
            "limit": {"type": "integer"},  # keys Gemini doesn't accept (minimum, title, default) are dropped
        },
        "required": ["symbol"],
    }


def test_gemini_schema_omits_required_when_only_provider_was_required():
    out = _gemini_schema({"type": "object", "properties": {"provider": {"type": "string"}}, "required": ["provider"]})
    assert out == {"type": "object", "properties": {}}


class _FixedNow:
    def __init__(self, dt):
        self.dt = dt

    def now(self, tz):
        return self.dt.replace(tzinfo=tz)


@pytest.mark.parametrize("et_now, expected", [
    (datetime(2026, 9, 21, 15, 59), date(2026, 9, 20)),  # Monday, one minute before the close -> yesterday
    (datetime(2026, 9, 21, 16, 0), date(2026, 9, 21)),   # at the close -> today
    (datetime(2026, 9, 21, 20, 30), date(2026, 9, 21)),  # evening -> today
    (datetime(2026, 9, 19, 10, 0), date(2026, 9, 18)),   # Saturday morning -> Friday
    (datetime(2026, 9, 20, 18, 0), date(2026, 9, 20)),   # Sunday evening -> the (bar-less) calendar day; price filter still ends on Friday
])
def test_last_complete_session(monkeypatch, et_now, expected):
    monkeypatch.setattr(fingpt_tool, "datetime", _FixedNow(et_now))
    assert fingpt_tool.last_complete_session() == expected
