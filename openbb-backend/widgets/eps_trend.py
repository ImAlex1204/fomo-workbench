"""GET /fundamentals/eps_trend/{ticker}: quarterly EPS history (actual vs. estimate) plus analyst
consensus for the next two quarters.

openbb-api's yfinance provider exposes neither EPS history (historical_eps needs fmp/alpha_vantage)
nor EPS estimates (estimates/consensus only has price targets), so this widget uses the yfinance
package directly — the "fix the one missing piece with yfinance" exception from CLAUDE.md.
"""
import math

import yfinance as yf
from fastapi import APIRouter, HTTPException

ACTUAL_QUARTERS = 8
router = APIRouter()


def _num(v):
    return None if v is None or (isinstance(v, float) and math.isnan(v)) else round(float(v), 2)


@router.get("/fundamentals/eps_trend/{ticker}")
def eps_trend(ticker: str):
    t = yf.Ticker(ticker.upper())
    dates = t.get_earnings_dates(limit=ACTUAL_QUARTERS + 4)  # includes a few future rows with no reported EPS
    if dates is None or dates.empty:
        raise HTTPException(404, f"no earnings history for {ticker.upper()}")
    reported = dates[dates["Reported EPS"].notna()].sort_index().tail(ACTUAL_QUARTERS)
    actual = [{"date": d.strftime("%Y-%m-%d"), "eps": _num(r["Reported EPS"]), "estimate": _num(r["EPS Estimate"])}
              for d, r in reported.iterrows()]

    est = t.earnings_estimate  # rows 0q, +1q, 0y, +1y
    upcoming = dates[dates["Reported EPS"].isna()].sort_index()
    next_dates = [d.strftime("%Y-%m-%d") for d in upcoming.index[:2]]
    estimates = []
    for i, period in enumerate(["0q", "+1q"]):
        if est is not None and period in est.index:
            estimates.append({"period": period, "date": next_dates[i] if i < len(next_dates) else None,
                              "eps": _num(est.loc[period, "avg"]), "low": _num(est.loc[period, "low"]),
                              "high": _num(est.loc[period, "high"]), "analysts": int(est.loc[period, "numberOfAnalysts"])})
    return {"ticker": ticker.upper(), "actual": actual, "estimates": estimates}
