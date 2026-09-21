"""finrl_signal(ticker): today's FinRL trade signals from the local openbb-backend (port 8001).

Thin client for openbb-backend/widgets/finrl_signal.py so the agent can cite the quant engine
next to FinGPT. The interpretation notes in the docstring are what Gemini sees as the tool description.
"""
import requests

BACKEND = "http://127.0.0.1:8001"


def signal(ticker: str) -> dict:
    """Get today's FinRL deep-RL trade signals for one DOW 30 stock (AAPL, MSFT, NVDA, JPM, ...).
    Five agents (A2C, DDPG, PPO, TD3, SAC) trained on the DOW 30 each give: action BUY/SELL/HOLD,
    `shares` = the agent's raw intent today (positive buy, negative sell, up to 100; NOT clipped by
    cash or holdings, so SELL -100 with position 0 means "bearish but nothing to sell"), and
    `position` = shares it would hold after simulating the last 60 sessions from cash. `as_of` is the
    last completed trading day. The agents are independent and often disagree; report each one,
    do not invent a consensus. Non-DOW-30 tickers return an error. Not investment advice."""
    r = requests.get(f"{BACKEND}/finrl/signal/{ticker.upper()}", timeout=60)
    if r.status_code == 404:
        return {"error": r.json().get("detail", f"{ticker.upper()} is not in the DOW 30")}
    r.raise_for_status()
    rows = r.json()
    return {"ticker": ticker.upper(), "as_of": rows[0]["as_of"], "close": rows[0]["close"],
            "signals": [{k: row[k] for k in ("agent", "action", "shares", "position")} for row in rows]}
