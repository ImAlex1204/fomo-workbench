"""Train the five FinRL agents on one basket from openbb-backend/baskets.json (Phase 17).

    ../envs/finrl/bin/python train_basket.py tech30

Mirrors FinRL/examples/FinRL_StockTrading_2026_{1,2}*.py exactly — same downloader, feature
pipeline, env_kwargs and agent hyperparameters — so that models from different baskets differ
only in their constituents and training window. The upstream scripts hardcode the DOW 30 and
write to the current directory, so this is a separate script rather than an edit to them.

The one deliberate difference: upstream's FeatureEngineer.clean_data pivots closes and calls
dropna(axis=1), so any ticker with a gap in the window — a member that IPO'd after train_start —
is silently removed from the basket, and you get a smaller model than you asked for with no error
anywhere. Here that is a hard error instead.
"""
import json
import sys
from pathlib import Path

import itertools
import pandas as pd

from finrl.agents.stablebaselines3.models import DRLAgent
from finrl.config import INDICATORS
from finrl.meta.env_stock_trading.env_stocktrading import StockTradingEnv
from finrl.meta.preprocessor.preprocessors import FeatureEngineer, data_split
from finrl.meta.preprocessor.yahoodownloader import YahooDownloader

ROOT = Path(__file__).resolve().parents[1]
BASKETS = ROOT / "openbb-backend" / "baskets.json"
TIMESTEPS = 20_000  # upstream default

# Agents in upstream's order. None = DRLAgent's config defaults; the dicts are the overrides the
# upstream training script applies inline (note: its PPO/SAC batch_size differs from config.py).
AGENTS = {
    "a2c": None,
    "ddpg": None,
    "ppo": {"n_steps": 2048, "ent_coef": 0.01, "learning_rate": 0.00025, "batch_size": 128},
    "td3": {"batch_size": 100, "buffer_size": 1_000_000, "learning_rate": 0.001},
    "sac": {"batch_size": 128, "buffer_size": 100_000, "learning_rate": 0.0001, "learning_starts": 100, "ent_coef": "auto_0.1"},
}


def load_basket(basket_id):
    for b in json.loads(BASKETS.read_text())["baskets"]:
        if b["id"] == basket_id:
            return b
    sys.exit(f"no basket {basket_id!r} in {BASKETS}")


def build_training_frame(basket):
    """Download + feature-engineer the basket, failing loudly if any member is missing or short."""
    raw = YahooDownloader(start_date=basket["train_start"], end_date=basket["train_end"],
                          ticker_list=basket["tickers"]).fetch_data()
    fe = FeatureEngineer(use_technical_indicator=True, tech_indicator_list=INDICATORS,
                         use_vix=True, use_turbulence=True, user_defined_feature=False)
    processed = fe.preprocess_data(raw)

    # clean_data has already dropped any member that does not span the whole window; catch that.
    dropped = sorted(set(basket["tickers"]) - set(processed["tic"].unique()))
    if dropped:
        firsts = raw[raw["tic"].isin(dropped)].groupby("tic")["date"].min().to_dict()
        sys.exit(f"{basket['id']}: {dropped} do not span {basket['train_start']}..{basket['train_end']} "
                 f"and were dropped by clean_data (first dates: {firsts}). Start the window later or "
                 f"remove them — training a silently smaller basket is worse than failing here.")

    # Upstream then reindexes onto the full date x ticker grid and fills gaps with 0; we only
    # reindex and assert the grid is complete, so a partial gap can never become a price of 0.
    dates, tics = processed["date"].unique(), processed["tic"].unique()
    grid = pd.DataFrame(list(itertools.product(dates, tics)), columns=["date", "tic"])
    full = grid.merge(processed, on=["date", "tic"], how="left").sort_values(["date", "tic"])
    missing = full[full["close"].isna()]
    if not missing.empty:
        worst = missing.groupby("tic").size().sort_values(ascending=False)
        sys.exit(f"{len(missing)} missing ticker-days in {basket['id']}; worst: {worst.head(5).to_dict()}")
    assert len(tics) == len(basket["tickers"])
    print(f"{basket['id']}: {len(dates)} sessions x {len(tics)} tickers, {dates.min()} -> {dates.max()}")
    return data_split(full, basket["train_start"], basket["train_end"])


def train(basket, train_df):
    n = len(train_df["tic"].unique())
    env_kwargs = {  # identical to the upstream training script
        "hmax": 100, "initial_amount": 1_000_000, "num_stock_shares": [0] * n,
        "buy_cost_pct": [0.001] * n, "sell_cost_pct": [0.001] * n,
        "state_space": 1 + 2 * n + len(INDICATORS) * n, "stock_dim": n,
        "tech_indicator_list": INDICATORS, "action_space": n, "reward_scaling": 1e-4,
    }
    env, _ = StockTradingEnv(df=train_df, **env_kwargs).get_sb_env()
    out = ROOT / basket["model_dir"]
    out.mkdir(parents=True, exist_ok=True)
    for name, kwargs in AGENTS.items():
        print(f"--- {basket['id']} / {name} ---")
        agent = DRLAgent(env=env)
        model = agent.get_model(name, model_kwargs=kwargs, seed=basket.get("seed"))
        agent.train_model(model=model, tb_log_name=name, total_timesteps=TIMESTEPS).save(out / f"agent_{name}")
    return env_kwargs, out


def main(basket_id):
    basket = load_basket(basket_id)
    train_df = build_training_frame(basket)
    env_kwargs, out = train(basket, train_df)
    (out / "manifest.json").write_text(json.dumps({
        "basket": basket_id, "tickers": basket["tickers"], "seed": basket.get("seed"),
        "train_start": basket["train_start"], "train_end": basket["train_end"],
        "sessions": int(train_df.index.nunique()), "state_space": env_kwargs["state_space"],
        "timesteps": TIMESTEPS, "trained_at": pd.Timestamp.now().isoformat(timespec="minutes"),
    }, indent=1) + "\n")
    print(f"saved to {out}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__))
