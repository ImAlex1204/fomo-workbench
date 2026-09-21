"""GET /finrl/signal/{ticker}: today's trade signal for one DOW 30 ticker from the five Phase 2 agents.

Data comes from the local openbb-api (adjusted OHLCV + ^VIX), then goes through the same
FeatureEngineer / StockTradingEnv setup as FinRL/examples/FinRL_StockTrading_2026_{1,3}*.py.
"""
from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import requests
from fastapi import APIRouter, HTTPException
from stable_baselines3 import A2C, DDPG, PPO, SAC, TD3

from finrl.config import INDICATORS
from finrl.config_tickers import DOW_30_TICKER
from finrl.meta.env_stock_trading.env_stocktrading import StockTradingEnv
from finrl.meta.preprocessor.preprocessors import FeatureEngineer

OPENBB_API = "http://127.0.0.1:6900/api/v1"
MODEL_DIR = Path(__file__).resolve().parents[2] / "finrl-work" / "trained_models"
HISTORY_DAYS = 400  # calendar days; turbulence needs >252 trading days of history
EPISODE_DAYS = 60  # trading days the agent simulates (starting from cash) before deciding today
ET = ZoneInfo("America/New_York")
MARKET_CLOSE = time(16, 0)

MODELS = {name: cls.load(MODEL_DIR / f"agent_{name}") for name, cls in
          [("a2c", A2C), ("ddpg", DDPG), ("ppo", PPO), ("td3", TD3), ("sac", SAC)]}

router = APIRouter()
_cache: dict = {}  # {as_of: {"window": df, "agents": {name: {"trade": {tic: shares}, "position": {tic: shares}}}}}


def fetch_prices(symbols, start):
    r = requests.get(f"{OPENBB_API}/equity/price/historical", timeout=60, params={
        "symbol": ",".join(symbols), "provider": "yfinance", "start_date": start,
        "adjustment": "splits_and_dividends"})
    r.raise_for_status()
    return pd.DataFrame(r.json()["results"])


def last_complete_session():
    """Latest ET date whose daily bar is final: today after the close, otherwise yesterday.
    During the session yfinance already returns an in-progress bar for today; the agents were
    trained on complete bars, so that bar (and the VIX one) must not feed the indicators."""
    now = datetime.now(ET)
    return now.date() if now.time() >= MARKET_CLOSE else now.date() - timedelta(days=1)


def build_window(as_of: date):
    start = (as_of - timedelta(days=HISTORY_DAYS)).isoformat()
    df = fetch_prices(DOW_30_TICKER, start).rename(columns={"symbol": "tic"})
    df = df[df["date"] <= as_of.isoformat()]
    df["day"] = pd.to_datetime(df["date"]).dt.dayofweek
    df = df[["date", "open", "high", "low", "close", "volume", "tic", "day"]]
    # use_vix=False: FeatureEngineer.add_vix would call yfinance directly; we take ^VIX from openbb-api instead
    fe = FeatureEngineer(use_technical_indicator=True, tech_indicator_list=INDICATORS, use_vix=False, use_turbulence=True)
    df = fe.preprocess_data(df)
    vix = fetch_prices(["^VIX"], start)[["date", "close"]].rename(columns={"close": "vix"})
    df = df.merge(vix, on="date")

    dates = sorted(df["date"].unique())
    window = df[df["date"] >= dates[-EPISODE_DAYS]].sort_values(["date", "tic"]).reset_index(drop=True)
    window.index = window["date"].factorize()[0]
    return window


def run_agents(window):
    n = len(window["tic"].unique())
    env_kwargs = {  # identical to FinRL_StockTrading_2026_3_Backtest.py
        "hmax": 100, "initial_amount": 1_000_000, "num_stock_shares": [0] * n,
        "buy_cost_pct": [0.001] * n, "sell_cost_pct": [0.001] * n,
        "state_space": 1 + 2 * n + len(INDICATORS) * n, "stock_dim": n,
        "tech_indicator_list": INDICATORS, "action_space": n, "reward_scaling": 1e-4,
    }
    tics = sorted(window["tic"].unique())  # env state/action order
    out = {}
    for name, model in MODELS.items():
        env = StockTradingEnv(df=window, turbulence_threshold=70, risk_indicator_col="vix", **env_kwargs)
        # Same loop as DRLAgent.DRL_prediction, but stopped one step early: after the last real
        # day the VecEnv would auto-reset and lose the holdings. obs now reflects today's close.
        vec, obs = env.get_sb_env()
        vec.reset()
        for _ in range(len(window.index.unique()) - 1):
            action, _ = model.predict(obs, deterministic=True)
            obs, _, _, _ = vec.step(action)
        action, _ = model.predict(obs, deterministic=True)
        # Raw intent, scaled like env.step does but NOT clipped by cash/holdings (the env's own
        # actions_memory records executed shares, which is 0 when e.g. selling with no position).
        trade = (action[0] * env.hmax).astype(int)
        if env.turbulence >= env.turbulence_threshold:  # env.step's risk override
            trade = np.full(n, -env.hmax)
        position = np.array(env.state[1 + n:1 + 2 * n]).astype(int)
        out[name] = {"trade": dict(zip(tics, trade.tolist())), "position": dict(zip(tics, position.tolist()))}
    return out


def signals_for_today():
    as_of = last_complete_session()
    if as_of not in _cache:
        _cache.clear()
        window = build_window(as_of)
        _cache[as_of] = {"window": window, "agents": run_agents(window)}
    return _cache[as_of]


@router.get("/finrl/signal/{ticker}")
@router.get("/finrl/signal")
def finrl_signal(ticker: str = "AAPL"):
    ticker = ticker.upper()
    if ticker not in DOW_30_TICKER:
        raise HTTPException(404, f"{ticker} is not in the DOW 30 the FinRL agents were trained on")
    data = signals_for_today()
    last = data["window"][data["window"]["tic"] == ticker].iloc[-1]
    rows = []
    for agent, a in data["agents"].items():
        shares = a["trade"][ticker]
        rows.append({"ticker": ticker, "as_of": last["date"], "close": round(float(last["close"]), 2),
                     "agent": agent, "action": "BUY" if shares > 0 else "SELL" if shares < 0 else "HOLD",
                     "shares": shares, "position": a["position"][ticker]})
    return rows
