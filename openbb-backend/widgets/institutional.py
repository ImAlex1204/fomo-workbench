"""GET /ownership/institutional/{ticker}: top institutional holders with quarter-over-quarter change.

openbb-api only offers this through the fmp provider (API key), so this widget uses the yfinance
package directly (same exception as eps_trend.py). Data comes from 13F filings via Yahoo.
"""
import math

import yfinance as yf
from fastapi import APIRouter, HTTPException

TOP_N = 5
router = APIRouter()


def _num(v):
    return None if v is None or (isinstance(v, float) and math.isnan(v)) else float(v)


@router.get("/ownership/institutional/{ticker}")
def institutional(ticker: str):
    df = yf.Ticker(ticker.upper()).institutional_holders
    if df is None or df.empty:
        raise HTTPException(404, f"no institutional holders for {ticker.upper()}")
    df = df.sort_values("Shares", ascending=False).head(TOP_N)
    return [{
        "holder": r["Holder"], "shares": int(r["Shares"]), "value": _num(r["Value"]),
        "pct_held": _num(r["pctHeld"]), "pct_change": _num(r["pctChange"]),  # fractions, e.g. 0.0797 / 0.016
        "date_reported": r["Date Reported"].strftime("%Y-%m-%d") if hasattr(r["Date Reported"], "strftime") else str(r["Date Reported"])[:10],
    } for _, r in df.iterrows()]
