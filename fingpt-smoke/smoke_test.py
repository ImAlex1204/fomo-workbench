"""Phase 3 smoke test: FinGPT-Forecaster (Llama-2-7b-chat + LoRA) on Apple Silicon (MPS).

Upstream app.py loads the gated meta-llama model and Finnhub at import time, so it can't be
imported directly. The prompt template strings below are copied verbatim from
FinGPT/fingpt/FinGPT_Forecaster/app.py; the news text is hand-written (no Finnhub needed).
"""
import re
import sys
import time

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

BASE_MODEL = "NousResearch/Llama-2-7b-chat-hf"  # ungated mirror of meta-llama/Llama-2-7b-chat-hf
LORA_MODEL = "FinGPT/fingpt-forecaster_dow30_llama2-7b_lora"

# --- copied from upstream app.py ---
B_INST, E_INST = "[INST]", "[/INST]"
B_SYS, E_SYS = "<<SYS>>\n", "\n<</SYS>>\n\n"
SYSTEM_PROMPT = "You are a seasoned stock market analyst. Your task is to list the positive developments and potential concerns for companies based on relevant news and basic financials from the past weeks, then provide an analysis and prediction for the companies' stock price movement for the upcoming week. " \
    "Your answer format should be as follows:\n\n[Positive Developments]:\n1. ...\n\n[Potential Concerns]:\n1. ...\n\n[Prediction & Analysis]\nPrediction: ...\nAnalysis: ..."
# --- end upstream ---

SYMBOL, CURDAY, NEXT_WEEK = "AAPL", "2026-09-17", "2026-09-24"

COMPANY = "[Company Introduction]:\n\nApple Inc is a leading entity in the Technology sector. Incorporated and publicly traded since 1980-12-12, the company has established its reputation as one of the key players in the market. As of today, Apple Inc has a market capitalization of 4900000.00 in USD, with 14900.00 shares outstanding.\n\nApple Inc operates primarily in the US, trading under the ticker AAPL on the NASDAQ NMS - GLOBAL MARKET. As a dominant force in the Technology space, the company continues to innovate and drive progress within the industry."

WEEK = "From 2026-09-10 to 2026-09-17, AAPL's stock price increased from 325.10 to 332.41. Company news during this period are listed below:\n\n"
NEWS = [
    "[Headline]: Apple unveils iPhone 18 lineup with on-device AI features\n[Summary]: Apple introduced the iPhone 18 series with a new neural engine and expanded Apple Intelligence features; pre-orders open Friday.\n",
    "[Headline]: Apple services revenue hits record as subscriptions grow\n[Summary]: The company reported services revenue growth of 14% year over year, driven by App Store, iCloud and Apple TV+ subscriptions.\n",
    "[Headline]: EU regulators open new probe into App Store fees\n[Summary]: The European Commission said it is examining whether Apple's revised App Store terms comply with the Digital Markets Act.\n",
]
BASICS = "[Basic Financials]:\n\nNo basic financial reported."

body = COMPANY + "\n\n" + WEEK + "\n".join(NEWS) + "\n" + BASICS
body += f"\n\nBased on all the information before {CURDAY}, let's first analyze the positive developments and potential concerns for {SYMBOL}. Come up with 2-4 most important factors respectively and keep them concise. Most factors should be inferred from company related news. " \
    f"Then make your prediction of the {SYMBOL} stock price movement for next week ({CURDAY} to {NEXT_WEEK}). Provide a summary analysis to support your prediction."
prompt = B_INST + B_SYS + SYSTEM_PROMPT + E_SYS + body + E_INST

device = "mps" if torch.backends.mps.is_available() else "cpu"
print(f"device={device}", flush=True)

t0 = time.time()
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
base = AutoModelForCausalLM.from_pretrained(BASE_MODEL, dtype=torch.float16, device_map={"": device})
model = PeftModel.from_pretrained(base, LORA_MODEL).eval()
print(f"model loaded in {time.time() - t0:.0f}s", flush=True)

inputs = tokenizer(prompt, return_tensors="pt").to(device)
print(f"prompt tokens={inputs['input_ids'].shape[1]}", flush=True)

t0 = time.time()
with torch.no_grad():
    out = model.generate(**inputs, max_new_tokens=500, do_sample=True, eos_token_id=tokenizer.eos_token_id, use_cache=True)
dt = time.time() - t0
new_tokens = out.shape[1] - inputs["input_ids"].shape[1]
answer = re.sub(r".*\[/INST\]\s*", "", tokenizer.decode(out[0], skip_special_tokens=True), flags=re.DOTALL)

print(f"\ngenerated {new_tokens} tokens in {dt:.0f}s ({new_tokens / dt:.1f} tok/s)\n")
print("=" * 60)
print(answer)
print("=" * 60)
sections = ["[Positive Developments]", "[Potential Concerns]", "[Prediction & Analysis]"]
missing = [s for s in sections if s not in answer]
print("PASS: all three sections present" if not missing else f"FAIL: missing {missing}")
sys.exit(1 if missing else 0)
