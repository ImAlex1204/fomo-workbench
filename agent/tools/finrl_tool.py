"""finrl_signal(ticker): today's FinRL trade signals from the local openbb-backend (port 8001).

Thin client for openbb-backend/widgets/finrl_signal.py so the agent can cite the quant engine
next to FinGPT. The interpretation notes in the docstring are what Gemini sees as the tool
description. Equity curves are dropped here: only their return_pct matters to the model, and the
raw arrays would be 60 numbers per agent per basket.
"""
import requests

BACKEND = "http://127.0.0.1:8001"
KEEP = ("agent", "action", "shares", "position", "return_pct")


def signal(ticker: str) -> dict:
    """Get today's FinRL deep-RL trade signals for one stock, from every model basket that contains it.
    Each basket is a separate set of five agents (A2C, DDPG, PPO, TD3, SAC) trained together on that
    basket's stocks and training window — "DOW 30 · 2014", "DOW 30 · 2019" and "Tech 30 · 2019" — so a
    stock in more than one basket gets several independent readings; say which basket each came from,
    and when they disagree, note that the baskets differ in constituents and/or training period.
    Per agent: action BUY/SELL/HOLD, `shares` = its raw intent today (positive buy, negative sell, up
    to 100; NOT clipped by cash or holdings, so SELL -100 with position 0 means "bearish but nothing
    to sell"), `position` = shares held after simulating the last 60 sessions from cash, and
    `return_pct` = that simulated basket portfolio's 60-session return. The five agents are
    independent and often disagree; report each one, do not invent a consensus. Tickers in no basket
    return an error. Not investment advice."""
    r = requests.get(f"{BACKEND}/finrl/signal/{ticker.upper()}", timeout=120)
    if r.status_code == 404:
        return {"error": r.json().get("detail", f"{ticker.upper()} is in no FinRL model basket")}
    r.raise_for_status()
    d = r.json()
    return {"ticker": d["ticker"], "baskets": [
        {"basket": b["label_en"], "trained_on": f'{b["train_start"]}..{b["train_end"]}',
         "as_of": b["as_of"], "close": b["close"],
         "signals": [{k: s[k] for k in KEEP} for s in b["signals"]]}
        for b in d["baskets"]]}
