"""Run from openbb-backend/: ../envs/finrl/bin/python -m pytest"""
from widgets.news import to_items

# epoch seconds -> 2026-10-09T09:46:00Z / 08:15:00Z
NEWER, OLDER = 1791539160, 1791533700


def row(**kw):
    base = {"providerPublishTime": NEWER, "title": "t", "link": "u", "publisher": "p", "relatedTickers": ["AAPL"]}
    return {**base, **kw}


def test_keeps_only_stories_that_name_the_ticker():
    rows = [row(title="about apple"), row(title="unrelated", relatedTickers=["MSFT"]), row(title="no tickers", relatedTickers=None)]
    assert [n["title"] for n in to_items(rows, "AAPL")] == ["about apple"]


def test_is_case_insensitive_about_the_query():
    assert len(to_items([row()], "aapl")) == 1


def test_emits_utc_with_an_explicit_z_and_sorts_newest_first():
    out = to_items([row(title="older", providerPublishTime=OLDER, link="u2"), row(title="newer")], "AAPL")
    assert [n["title"] for n in out] == ["newer", "older"]
    assert out[0]["date"] == "2026-10-09T09:46:00Z"      # not a naive string the browser would read as local
    assert out[1]["date"] == "2026-10-09T08:15:00Z"


def test_drops_rows_missing_a_timestamp_title_or_link():
    rows = [row(providerPublishTime=None), row(title=None), row(link=None), row(title="good")]
    assert [n["title"] for n in to_items(rows, "AAPL")] == ["good"]


def test_applies_the_limit_after_filtering():
    rows = [row(title=f"t{i}", link=f"u{i}", providerPublishTime=NEWER - i) for i in range(5)]
    rows += [row(title="other", relatedTickers=["MSFT"])]
    assert len(to_items(rows, "AAPL", limit=3)) == 3


def test_shape_matches_what_the_ui_expects():
    assert set(to_items([row()], "AAPL")[0]) == {"date", "title", "url", "source"}
