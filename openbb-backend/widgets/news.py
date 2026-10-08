"""GET /news/{ticker}: recent company headlines, read from yfinance's search endpoint.

openbb-api's yfinance news provider goes through `Ticker.news`, which Yahoo stopped populating in
early October 2026: it returns an empty list, openbb answers 204 No Content, and both consumers —
the News tab and the news section of FinGPT's prompt — silently see nothing (the briefs from
2026-10-05 on recorded eight `Expecting value: line 1 column 1` errors a day, which is `.json()`
on an empty body). `yf.Search` still carries the same stories, so this reads them directly: the
same "fix the one missing piece with yfinance" exception as eps_trend / institutional / live_quote.

Headline, link, publisher and timestamp only; article text is never copied (see CLAUDE.md).
"""
from datetime import datetime, timezone

import yfinance as yf
from fastapi import APIRouter

LIMIT = 10
router = APIRouter()


def to_items(rows, ticker, limit=LIMIT):
    """Search rows -> the UI's NewsItem shape, newest first.

    Search takes a text query, so it also returns stories that merely mention the company; keeping
    rows that name the ticker in relatedTickers is what makes this company news again. Timestamps
    are epoch seconds, emitted as UTC with a Z so the browser reads them as UTC and not as local
    time (openbb's naive strings were parsed as local, shifting every headline by the offset).
    """
    out = []
    for r in rows:
        if ticker.upper() not in (r.get("relatedTickers") or []):
            continue
        ts, title, url = r.get("providerPublishTime"), r.get("title"), r.get("link")
        if not (ts and title and url):
            continue
        out.append({"date": datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "title": title, "url": url, "source": r.get("publisher")})
    out.sort(key=lambda n: n["date"], reverse=True)
    return out[:limit]


@router.get("/news/{ticker}")
def news(ticker: str, limit: int = LIMIT):
    rows = yf.Search(ticker.upper(), news_count=max(limit, LIMIT), enable_fuzzy_query=False).news
    return to_items(rows, ticker, limit)
