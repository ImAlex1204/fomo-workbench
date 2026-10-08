"""Run from agent/: ../envs/fingpt/bin/python -m pytest"""
import pytest
import requests

from tools import http


class Resp:
    def __init__(self, status):
        self.status_code, self.reason, self.url = status, "x", "http://local/x"
        self.ok = 200 <= status < 400


@pytest.fixture(autouse=True)
def no_waiting(monkeypatch):
    monkeypatch.setattr(http.time, "sleep", lambda _: None)


def fake_get(responses):
    """Replays `responses` (status codes or exceptions), recording how many calls were made."""
    calls = []

    def _get(url, params=None, timeout=None):
        calls.append(url)
        r = responses[min(len(calls) - 1, len(responses) - 1)]
        if isinstance(r, Exception):
            raise r
        return Resp(r)

    return _get, calls


def test_a_blip_is_retried_and_the_second_answer_is_used(monkeypatch):
    # the 2026-09-28..30 shape: openbb-api answers 500, then works
    _get, calls = fake_get([500, 200])
    monkeypatch.setattr(http.requests, "get", _get)
    assert http.get("http://local/x").status_code == 200
    assert len(calls) == 2


def test_gives_up_after_three_attempts_and_raises(monkeypatch):
    _get, calls = fake_get([503])
    monkeypatch.setattr(http.requests, "get", _get)
    with pytest.raises(requests.HTTPError):
        http.get("http://local/x")
    assert len(calls) == http.ATTEMPTS == 3


def test_retries_the_yfinance_400_too(monkeypatch):
    _get, calls = fake_get([400, 200])
    monkeypatch.setattr(http.requests, "get", _get)
    assert http.get("http://local/x").ok
    assert len(calls) == 2


def test_connection_errors_are_retried(monkeypatch):
    _get, calls = fake_get([requests.ConnectionError("reset"), 200])
    monkeypatch.setattr(http.requests, "get", _get)
    assert http.get("http://local/x").ok
    assert len(calls) == 2


def test_passthrough_status_is_returned_not_retried(monkeypatch):
    # a FinRL 404 means "this ticker is in no basket" — an answer, not a failure
    _get, calls = fake_get([404])
    monkeypatch.setattr(http.requests, "get", _get)
    assert http.get("http://local/x", passthrough=(404,)).status_code == 404
    assert len(calls) == 1


def test_a_status_outside_the_retry_set_comes_straight_back(monkeypatch):
    _get, calls = fake_get([404])
    monkeypatch.setattr(http.requests, "get", _get)
    assert http.get("http://local/x").status_code == 404
    assert len(calls) == 1
