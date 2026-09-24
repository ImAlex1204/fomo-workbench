"""Daily brief: run FinRL + FinGPT over the watchlist once per completed session, then have Gemini
write a short overview. The QuantBrief-style "scheduled insight brief" from the project brief,
done with the two engines already wired into the agent.

Storage (both git-ignored): watchlist.json = ["AAPL", ...]; briefs/<as_of>.json = the brief.
Scheduling: the loop in `scheduler()` runs a brief whenever the last completed session (see
fingpt_tool.last_complete_session) is a weekday with no brief file yet. That covers both the
nightly run (the key flips to today at 16:00 ET) and catch-up after the machine was off.
FinGPT calls take the same lock as the chat tool, so a brief never fights the dashboard for MPS.
"""
import asyncio
import json
import os
from datetime import datetime
from pathlib import Path

from google import genai
from google.genai import types

from tools import fingpt_tool, finrl_tool

DIR = Path(__file__).parent
WATCHLIST_FILE = DIR / "watchlist.json"
BRIEF_DIR = DIR / "briefs"
DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "AMZN", "JPM", "V", "UNH", "CAT"]
MAX_TICKERS = 15  # ~1.5 min of FinGPT per ticker
CHECK_EVERY_S = 60

SUMMARY_PROMPT = """You are writing the morning brief for a personal stock research workbench. Below are today's
outputs of two local models for each watchlist stock: FinGPT-Forecaster (news-driven one-week outlook,
"Prediction: Up/Down by X%") and FinRL, whose five deep-RL agents vote BUY/SELL/HOLD — given here as
tallies per model basket, where a basket is a separate set of agents trained on its own stocks and
period, so a stock may have several readings. Write:
- "overview": 2-4 sentences on the watchlist as a whole: where the two engines agree, where they
  conflict, anything notable. Do not add your own forecasts.
- "tickers": for each ticker, one sentence (max 25 words) stating FinGPT's direction and whether the
  FinRL agents lean the same way; name the basket only when baskets disagree with each other.
Return JSON: {"en": {"overview": str, "tickers": {TICKER: str}}, "zh": {same, in Traditional Chinese}}.
Model outputs are opinions, not advice; do not add disclaimers, the UI shows one.

DATA:
"""

_state: dict = {"running": False, "progress": None}  # progress = [done, total] while running


def load_watchlist() -> list[str]:
    if WATCHLIST_FILE.exists():
        return json.loads(WATCHLIST_FILE.read_text())
    return list(DEFAULT_WATCHLIST)


def save_watchlist(tickers: list[str]) -> list[str]:
    clean = []
    for t in tickers:
        t = t.strip().upper()
        if t and t.isalnum() and t not in clean:
            clean.append(t)
    clean = clean[:MAX_TICKERS]
    WATCHLIST_FILE.write_text(json.dumps(clean))
    return clean


def latest_brief() -> dict | None:
    files = sorted(BRIEF_DIR.glob("????-??-??.json"))
    return json.loads(files[-1].read_text()) if files else None


def status() -> dict:
    return {**_state, "brief": latest_brief()}


def _save(brief: dict):
    BRIEF_DIR.mkdir(exist_ok=True)
    (BRIEF_DIR / f"{brief['as_of']}.json").write_text(json.dumps(brief, ensure_ascii=False, indent=1))


def _finrl_tallies(finrl):
    """{basket label: "3 BUY / 2 SELL"} — the five rows per basket are too much for the summary prompt."""
    if not finrl or "baskets" not in finrl:
        return finrl and finrl.get("error")
    out = {}
    for b in finrl["baskets"]:
        acts = [s["action"] for s in b["signals"]]
        out[b["basket"]] = f'{acts.count("BUY")} BUY / {acts.count("SELL")} SELL / {acts.count("HOLD")} HOLD'
    return out


async def _summarize(items: list[dict]) -> dict | None:
    data = [{"ticker": i["ticker"], "fingpt": i["fingpt"] and {"prediction": i["fingpt"]["prediction"], "analysis": i["fingpt"]["analysis"]},
             "finrl": _finrl_tallies(i["finrl"])} for i in items]
    client = genai.Client()
    model = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
    for wait in (5, 30, None):
        try:
            resp = await client.aio.models.generate_content(
                model=model, contents=SUMMARY_PROMPT + json.dumps(data, ensure_ascii=False),
                config=types.GenerateContentConfig(response_mime_type="application/json"))
            return json.loads(resp.text)
        except Exception as e:
            # a daily-quota 429 will not clear by waiting, and retrying it burns the rest of the quota
            if wait is None or "PerDay" in str(e):
                return None
            await asyncio.sleep(wait)


async def run_brief() -> dict:
    """Run both engines for every watchlist ticker, save progressively, then add Gemini's summary."""
    if _state["running"]:
        return status()
    _state["running"] = True
    tickers = load_watchlist()
    brief = {"as_of": fingpt_tool.last_complete_session().isoformat(), "generated_at": None,
             "tickers": tickers, "items": [], "summary": None}
    try:
        for n, t in enumerate(tickers):
            _state["progress"] = [n, len(tickers)]
            item = {"ticker": t, "finrl": None, "fingpt": None, "error": None}
            try:
                item["finrl"] = await asyncio.to_thread(finrl_tool.signal, t)
            except Exception as e:
                item["finrl"] = {"error": str(e)}
            try:
                item["fingpt"] = await asyncio.to_thread(fingpt_tool.forecast, t)
            except Exception as e:
                item["error"] = str(e)
            brief["items"].append(item)
            _save(brief)
        _state["progress"] = [len(tickers), len(tickers)]
        brief["summary"] = await _summarize(brief["items"])
        brief["generated_at"] = datetime.now().astimezone().isoformat(timespec="minutes")
        _save(brief)
    finally:
        _state["running"] = False
        _state["progress"] = None
    return status()


async def scheduler():
    """Background task: run a brief when the last completed weekday session has no finished one yet
    (a file without generated_at is a run the agent was restarted in the middle of)."""
    while True:
        as_of = fingpt_tool.last_complete_session()
        f = BRIEF_DIR / f"{as_of.isoformat()}.json"
        done = f.exists() and json.loads(f.read_text()).get("generated_at")
        if as_of.weekday() < 5 and not done and not _state["running"]:
            try:
                await run_brief()
            except Exception:
                pass  # next tick retries; per-ticker errors are already recorded in the brief
        await asyncio.sleep(CHECK_EVERY_S)
