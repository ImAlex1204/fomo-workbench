"""One retry policy for the agent's calls to the local services.

openbb-api's yfinance provider drops requests that land together — a brief fires four of them per
ticker — and answers 400 or 500 rather than queueing. Without a retry a single blip costs that
ticker's whole forecast: the briefs for 2026-09-28..30 lost 30 tickers' worth of engine output to
exactly these, while the dashboard rode them out because `fetchHistory` and `firstResult` retry.
"""
import time

import requests

ATTEMPTS = 3
BACKOFF = (2, 5)  # seconds before attempts 2 and 3
# 400 is on this list because the yfinance provider returns it for its own hiccups, not just for
# bad parameters; ours are fixed strings, so a retried 400 costs two requests and nothing else.
RETRY_STATUS = {400, 408, 425, 429, 500, 502, 503, 504}


def get(url, *, params=None, timeout=60, passthrough=()):
    """GET, retrying the transient statuses. Returns the Response.

    `passthrough` statuses are handed back instead of retried — a 404 from the FinRL endpoint means
    the ticker is in no basket, which no amount of retrying will change.
    """
    last = None
    for attempt in range(ATTEMPTS):
        try:
            r = requests.get(url, params=params, timeout=timeout)
            if r.ok or r.status_code in passthrough or r.status_code not in RETRY_STATUS:
                return r
            last = requests.HTTPError(f"{r.status_code} {r.reason} for {r.url}", response=r)
        except requests.RequestException as e:  # connection reset, read timeout
            last = e
        if attempt < ATTEMPTS - 1:
            time.sleep(BACKOFF[attempt])
    raise last
