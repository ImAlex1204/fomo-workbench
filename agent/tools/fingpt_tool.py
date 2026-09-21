"""fingpt_forecast(ticker): FinGPT-Forecaster (Llama-2-7b-chat + LoRA on MPS) fed with OpenBB data.

Prompt layout follows FinGPT/fingpt/FinGPT_Forecaster/app.py (get_all_prompts_online). Template
strings are copied from there; the company intro drops the IPO date (not in the yfinance profile)
and market cap / shares are expressed in millions like Finnhub reports them.
Data (profile, weekly prices, news, metrics) comes from the local openbb-api, never from Finnhub.
"""
import re
import threading
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

import requests
import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

OPENBB_API = "http://127.0.0.1:6900/api/v1"
ET = ZoneInfo("America/New_York")
MARKET_CLOSE = time(16, 0)
BASE_MODEL = "NousResearch/Llama-2-7b-chat-hf"
LORA_MODEL = "FinGPT/fingpt-forecaster_dow30_llama2-7b_lora"
N_WEEKS = 2  # past weeks of price moves + news in the prompt (upstream default 3)
NEWS_PER_WEEK = 5
METRIC_KEYS = ["pe_ratio", "forward_pe", "peg_ratio", "price_to_book", "enterprise_value_to_ebitda",
               "profit_margin", "return_on_equity", "revenue_growth", "earnings_growth", "debt_to_equity"]

# --- copied from upstream app.py ---
B_INST, E_INST = "[INST]", "[/INST]"
B_SYS, E_SYS = "<<SYS>>\n", "\n<</SYS>>\n\n"
SYSTEM_PROMPT = "You are a seasoned stock market analyst. Your task is to list the positive developments and potential concerns for companies based on relevant news and basic financials from the past weeks, then provide an analysis and prediction for the companies' stock price movement for the upcoming week. " \
    "Your answer format should be as follows:\n\n[Positive Developments]:\n1. ...\n\n[Potential Concerns]:\n1. ...\n\n[Prediction & Analysis]\nPrediction: ...\nAnalysis: ..."
# --- end upstream ---

_model = _tokenizer = None
_lock = threading.Lock()  # one load/generate at a time: concurrent runs fight for MPS (and would load the 13GB model twice)


def _get(path, **params):
    r = requests.get(f"{OPENBB_API}/{path}", params={"provider": "yfinance", **params}, timeout=60)
    r.raise_for_status()
    return r.json()["results"]


def last_complete_session():
    """Same rule as openbb-backend/widgets/finrl_signal.py (separate venv, hence duplicated): the
    latest ET date whose daily bar is final. yfinance returns today's in-progress bar during the
    session, which would otherwise become the latest week's end price."""
    now = datetime.now(ET)
    return now.date() if now.time() >= MARKET_CLOSE else now.date() - timedelta(days=1)


def _load():
    global _model, _tokenizer
    if _model is None:
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        _tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
        base = AutoModelForCausalLM.from_pretrained(BASE_MODEL, dtype=torch.float16, device_map={"": device})
        _model = PeftModel.from_pretrained(base, LORA_MODEL).eval()
    return _model, _tokenizer


def _company_prompt(p):
    return ("[Company Introduction]:\n\n{name} is a leading entity in the {industry} sector. The company has established its reputation as one of the key players in the market. As of today, {name} has a market capitalization of {mcap:.2f} in {currency}, with {shares:.2f} shares outstanding."
            "\n\n{name} operates primarily in the {country}, trading under the ticker {ticker} on the {exchange}. As a dominant force in the {industry} space, the company continues to innovate and drive progress within the industry."
            ).format(name=p["name"], industry=p.get("industry_category") or p.get("sector"), mcap=(p.get("market_cap") or 0) / 1e6,
                     currency=p.get("currency", "USD"), shares=(p.get("shares_outstanding") or 0) / 1e6,
                     country=p.get("hq_country", "US"), ticker=p["symbol"], exchange=p.get("stock_exchange", ""))


def _weekly_blocks(ticker, today):
    """[(start, end, start_price, end_price, [news_str])] for the past N_WEEKS, like upstream get_stock_data + get_news."""
    steps = [today - timedelta(days=7 * n) for n in range(N_WEEKS, -1, -1)]
    prices = _get("equity/price/historical", symbol=ticker, start_date=(steps[0] - timedelta(days=5)).isoformat())
    cutoff = last_complete_session().isoformat()  # drop today's in-progress bar during the session
    closes = {row["date"]: row["close"] for row in prices if row["date"] <= cutoff}
    dates = sorted(closes)
    bounds = []
    for step in steps[:-1]:  # first trading day on/after each boundary
        bounds.append(next(d for d in dates if d >= step.isoformat()))
    bounds.append(dates[-1])

    news = _get("news/company", symbol=ticker, limit=NEWS_PER_WEEK * N_WEEKS)
    blocks = []
    for i, (start, end) in enumerate(zip(bounds[:-1], bounds[1:])):
        # news windows are calendar weeks ending at `today` (upstream get_news), independent of the price
        # cutoff: during the session today's headlines count even though the last complete bar is yesterday's
        lo, hi = steps[i].isoformat(), steps[i + 1].isoformat()
        items = [n for n in news if lo <= n["date"][:10] <= hi][:NEWS_PER_WEEK]
        blocks.append((start, end, closes[start], closes[end],
                       ["[Headline]: {}\n[Summary]: {}\n".format(n["title"], n.get("summary") or n.get("text") or "") for n in items]))
    return blocks


def build_prompt(ticker, today):
    profile = _get("equity/profile", symbol=ticker)[0]
    blocks = _weekly_blocks(ticker, today)
    body = _company_prompt(profile)
    for start, end, p0, p1, news in blocks:
        term = "increased" if p1 > p0 else "decreased"
        body += f"\n\nFrom {start} to {end}, {ticker}'s stock price {term} from {p0:.2f} to {p1:.2f}. Company news during this period are listed below:\n\n"
        body += "\n".join(news) if news else "No relative news reported."

    metrics = _get("equity/fundamental/metrics", symbol=ticker)[0]
    basics = {k: metrics[k] for k in METRIC_KEYS if metrics.get(k) is not None}
    if basics:
        body += f"\n\nSome recent basic financials of {ticker} are presented below:\n\n[Basic Financials]:\n\n" + "\n".join(f"{k}: {v}" for k, v in basics.items())
    else:
        body += "\n\n[Basic Financials]:\n\nNo basic financial reported."

    curday, next_week = today.isoformat(), (today + timedelta(days=7)).isoformat()
    body += f"\n\nBased on all the information before {curday}, let's first analyze the positive developments and potential concerns for {ticker}. Come up with 2-4 most important factors respectively and keep them concise. Most factors should be inferred from company related news. " \
        f"Then make your prediction of the {ticker} stock price movement for next week ({curday} to {next_week}). Provide a summary analysis to support your prediction."
    return B_INST + B_SYS + SYSTEM_PROMPT + E_SYS + body + E_INST, blocks


def forecast(ticker: str) -> dict:
    """Run FinGPT-Forecaster for one ticker using OpenBB data. Takes ~1 minute on Apple Silicon."""
    ticker = ticker.upper()
    today = datetime.now(ET).date()
    prompt, blocks = build_prompt(ticker, today)
    with _lock:
        model, tokenizer = _load()
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        with torch.no_grad():
            out = model.generate(**inputs, max_new_tokens=500, do_sample=True, eos_token_id=tokenizer.eos_token_id, use_cache=True)
    answer = re.sub(r".*\[/INST\]\s*", "", tokenizer.decode(out[0], skip_special_tokens=True), flags=re.DOTALL)
    m = re.search(r"Prediction:\s*(.+)", answer)
    return {
        "ticker": ticker, "as_of": today.isoformat(),
        "weeks": [{"start": s, "end": e, "start_price": round(p0, 2), "end_price": round(p1, 2), "news_used": len(n)} for s, e, p0, p1, n in blocks],
        "prediction": m.group(1).strip() if m else None,
        "analysis": answer.strip(),
    }
