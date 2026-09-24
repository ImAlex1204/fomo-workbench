"""GET /finrl/signal/{ticker}: today's trade signal for one ticker from every model basket that
contains it, and GET /finrl/baskets: what those baskets are.

Baskets are defined in ../baskets.json (Phase 17): the original DOW 30 models from Phase 2, a
DOW 30 set retrained on the shorter window, and a tech-weighted set on that same window — so a
ticker in more than one basket shows how differently-trained agents see the same stock.

Data comes from the local openbb-api (adjusted OHLCV + ^VIX), then goes through the same
FeatureEngineer / StockTradingEnv setup as FinRL/examples/FinRL_StockTrading_2026_{1,3}*.py.
"""
import json
from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import requests
from fastapi import APIRouter, HTTPException
from stable_baselines3 import A2C, DDPG, PPO, SAC, TD3

from finrl.config import INDICATORS
from finrl.meta.env_stock_trading.env_stocktrading import StockTradingEnv
from finrl.meta.preprocessor.preprocessors import FeatureEngineer

OPENBB_API = "http://127.0.0.1:6900/api/v1"
ROOT = Path(__file__).resolve().parents[2]
HISTORY_DAYS = 400  # calendar days; turbulence needs >252 trading days of history
EPISODE_DAYS = 60  # trading days the agent simulates (starting from cash) before deciding today
ET = ZoneInfo("America/New_York")
MARKET_CLOSE = time(16, 0)
ALGOS = {"a2c": A2C, "ddpg": DDPG, "ppo": PPO, "td3": TD3, "sac": SAC}


def _load_baskets():
    """Baskets whose five model files are all present; an untrained one is skipped, not fatal.

    Every basket has 30 stocks, so all the models share one observation/action space and SB3 would
    happily load another basket's weights: check the manifest train_basket.py writes. The Phase 2
    dow30 models predate it and have none, so the check is skipped when it is absent."""
    out = []
    for b in json.loads((ROOT / "openbb-backend" / "baskets.json").read_text())["baskets"]:
        d = ROOT / b["model_dir"]
        if not all((d / f"agent_{n}.zip").exists() for n in ALGOS):
            print(f"finrl_signal: basket {b['id']} has no models in {d}, skipping")
            continue
        manifest = d / "manifest.json"
        if manifest.exists():
            m = json.loads(manifest.read_text())
            if m["basket"] != b["id"] or m["tickers"] != b["tickers"]:
                raise RuntimeError(f"{manifest} was trained for basket {m['basket']} with a different "
                                   f"ticker list; retrain {b['id']} or fix its model_dir")
        out.append({**b, "models": {n: cls.load(d / f"agent_{n}") for n, cls in ALGOS.items()}})
    return out


BASKETS = _load_baskets()
router = APIRouter()
_windows: dict = {}  # {(as_of, tickers_key): df} — depends only on the constituents, so baskets sharing a list share a window
_signals: dict = {}  # {(as_of, basket_id): {"trade": {tic: shares}, "position": {...}, "equity": [...]}}


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


def complete_sessions(df: pd.DataFrame, n_tickers: int) -> pd.DataFrame:
    """Keep only dates where every basket member has a usable bar.

    yfinance sometimes publishes a session for part of a basket (2026-09-22 had 11 of the DOW 30) or
    a bar with close: null. FeatureEngineer.clean_data reacts by dropping every *ticker* with a gap,
    which silently shrinks the basket until the observation no longer fits the model. Dropping the
    incomplete *session* instead costs one day of the 60-day replay and keeps all 30 columns."""
    df = df[df["close"].notna()]
    per_date = df.groupby("date")["tic"].nunique()
    return df[df["date"].isin(per_date[per_date == n_tickers].index)]


def build_window(tickers, as_of: date):
    start = (as_of - timedelta(days=HISTORY_DAYS)).isoformat()
    df = fetch_prices(tickers, start).rename(columns={"symbol": "tic"})
    df = df[df["date"] <= as_of.isoformat()]
    before = df["date"].nunique()
    df = complete_sessions(df, len(tickers))
    if (dropped := before - df["date"].nunique()):
        print(f"finrl_signal: dropped {dropped} incomplete session(s) before {as_of}")
    df["day"] = pd.to_datetime(df["date"]).dt.dayofweek
    df = df[["date", "open", "high", "low", "close", "volume", "tic", "day"]]
    # use_vix=False: FeatureEngineer.add_vix would call yfinance directly; we take ^VIX from openbb-api instead
    fe = FeatureEngineer(use_technical_indicator=True, tech_indicator_list=INDICATORS, use_vix=False, use_turbulence=True)
    df = fe.preprocess_data(df)
    vix = fetch_prices(["^VIX"], start)[["date", "close"]].rename(columns={"close": "vix"})
    df = df.merge(vix, on="date")

    if (got := df["tic"].nunique()) != len(tickers):
        raise HTTPException(503, f"only {got} of {len(tickers)} basket tickers survived preprocessing; "
                                 f"the price data is incomplete right now")
    dates = sorted(df["date"].unique())
    window = df[df["date"] >= dates[-EPISODE_DAYS]].sort_values(["date", "tic"]).reset_index(drop=True)
    window.index = window["date"].factorize()[0]
    return window


def run_agents(basket, window):
    n = len(window["tic"].unique())
    env_kwargs = {  # identical to FinRL_StockTrading_2026_3_Backtest.py
        "hmax": 100, "initial_amount": 1_000_000, "num_stock_shares": [0] * n,
        "buy_cost_pct": [0.001] * n, "sell_cost_pct": [0.001] * n,
        "state_space": 1 + 2 * n + len(INDICATORS) * n, "stock_dim": n,
        "tech_indicator_list": INDICATORS, "action_space": n, "reward_scaling": 1e-4,
    }
    tics = sorted(window["tic"].unique())  # env state/action order
    out = {}
    for name, model in basket["models"].items():
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
        # env.asset_memory: total assets after each simulated day (initial cash first, today's close last).
        # Portfolio-level (the whole basket), so it is the same curve for every ticker of that agent.
        out[name] = {"trade": dict(zip(tics, trade.tolist())), "position": dict(zip(tics, position.tolist())),
                     "equity": [round(float(v)) for v in env.asset_memory]}
    return out


def basket_signals(basket, as_of: date):
    """Cached per (session, basket); the price window is shared by baskets with the same tickers."""
    wkey = (as_of, ",".join(basket["tickers"]))
    if wkey not in _windows:
        for cache in (_windows, _signals):  # keep only the current session (several baskets share it)
            for stale in [k for k in cache if k[0] != as_of]:
                del cache[stale]
        _windows[wkey] = build_window(basket["tickers"], as_of)
    skey = (as_of, basket["id"])
    if skey not in _signals:
        _signals[skey] = run_agents(basket, _windows[wkey])
    return _windows[wkey], _signals[skey]


@router.get("/finrl/baskets")
def baskets():
    return [{k: b[k] for k in ("id", "label_en", "label_zh", "short", "note_en", "note_zh",
                               "train_start", "train_end", "seed", "tickers")} for b in BASKETS]


@router.get("/finrl/signal/{ticker}")
@router.get("/finrl/signal")
def finrl_signal(ticker: str = "AAPL"):
    ticker = ticker.upper()
    matches = [b for b in BASKETS if ticker in b["tickers"]]
    if not matches:
        raise HTTPException(404, f"{ticker} is not in any FinRL model basket "
                                 f"({', '.join(b['id'] for b in BASKETS)})")
    out = []
    for basket in matches:
        window, agents = basket_signals(basket, last_complete_session())
        last = window[window["tic"] == ticker].iloc[-1]
        rows = []
        for agent, a in agents.items():
            shares = a["trade"][ticker]
            rows.append({"agent": agent, "action": "BUY" if shares > 0 else "SELL" if shares < 0 else "HOLD",
                         "shares": shares, "position": a["position"][ticker],
                         "equity": a["equity"], "return_pct": round((a["equity"][-1] / a["equity"][0] - 1) * 100, 2)})
        out.append({k: basket[k] for k in ("id", "label_en", "label_zh", "short", "note_en", "note_zh", "train_start", "train_end")}
                   | {"as_of": last["date"], "close": round(float(last["close"]), 2), "signals": rows})
    return {"ticker": ticker, "baskets": out}
