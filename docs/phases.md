# 施工紀錄：Phase 1–16

> 從 `CLAUDE.md` 搬出來的逐 Phase 紀錄（2026-09-21 拆分，內容原樣保留）。每一段是當時的任務簡報 + 完成後的狀態、決策與踩到的坑。
> 日常開發需要知道的結論已蒸餾到 `CLAUDE.md` 的「目前狀態」與「已知的坑」兩節；這份檔案是要追溯「為什麼當初這樣做」時才看。

## 前置檢查

開始動工前，請先確認並回報以下環境資訊：

- [x] 作業系統：macOS（Apple Silicon）
- [x] Python 版本：3.10–3.12（`openbb` 4.7.2 要求 ≥3.10）。本專案統一用 **3.12**（`uv python install 3.12`，各 Phase 的 venv 都以此建立）
- [x] 已安裝 `git`、`uv`（用 `uv venv` 建環境；沒有 conda）
- [x] **硬體**：macOS，24GB 統一記憶體（無獨立顯卡）——Phase 3 的硬體分流已依此設定好，細節見該節

## Phase 1：建立 OpenBB 資料層（ODP）

1. 建立獨立的 Python 虛擬環境（例如 `python3 -m venv envs/openbb` 或對應的 conda 環境），避免跟後面 FinRL/FinGPT 的依賴衝突。
2. 安裝 OpenBB：`pip install "openbb[all]"`
3. 啟動本機資料伺服器：`openbb-api`
   - 這會在 `http://127.0.0.1:6900` 啟動一個 FastAPI/Uvicorn 伺服器,這是整個工作台的資料心臟，之後每次開發都需要讓它保持執行。
   - 驗證方式：瀏覽器打開 `http://127.0.0.1:6900`，應該看到基本回應；也可以直接呼叫一個實際端點（例如查詢一支股票的歷史價格）確認資料真的抓得到。
4. ~~登入 OpenBB Workspace 設定 Data Connector~~——**這一步目前跳過**，原因見上方「近況更新」（`pro.openbb.co` 註冊已關閉，公司收攤中）。不需要等這個，直接進 Phase 2。
5. 使用者的電腦是 macOS，且已決定日後統一用 **ODP Desktop**（官方桌面小工具，`https://github.com/OpenBB-finance/OpenBB/releases`，tag 為 `ODP`）當作啟動入口，不用每次手動下 `openbb-api` 指令。這一步在 Phase 1 先用手動指令跑通即可（確認架構真的可行），實際切換成 ODP Desktop 管理的動作留到 **Phase 8** 統一處理。ODP Desktop 本身只是管理本機背景服務的工具，不需要 Workspace 帳號，不受近況更新影響。

**Phase 1 完成判準**：本機 `openbb-api` 伺服器可穩定啟動，且能透過瀏覽器或指令列直接查到至少一筆真實資料（不透過 Workspace）。

**狀態：已於 2026-09-17 完成**。環境在 `envs/openbb`（Python 3.12，`openbb==4.7.2`），啟動設定在 `.claude/launch.json`，套件版本釘在 `requirements/openbb.lock.txt`。

## Phase 2：驗證 FinRL（量化訊號引擎）

1. 在獨立環境中執行：
   ```
   git clone https://github.com/AI4Finance-Foundation/FinRL.git
   cd FinRL
   python3 -m venv venv && source venv/bin/activate
   pip install -e .
   ```
2. 依序執行官方教學腳本作為 smoke test（純 CPU 即可，不需要 GPU）：
   - `python examples/FinRL_StockTrading_2026_1_data.py`（下載資料、加技術指標）
   - `python examples/FinRL_StockTrading_2026_2_train.py`（訓練 5 個 DRL agent：A2C/DDPG/PPO/TD3/SAC）
   - `python examples/FinRL_StockTrading_2026_3_Backtest.py`（回測並比較 MVO/道瓊指數）
3. 確認 `trained_models/` 目錄有產出模型檔，回測腳本能正常印出績效比較。

**Phase 2 完成判準**：三支腳本都能跑完不報錯，你理解一個 FinRL agent 從訓練到產生交易訊號的輸出格式長什麼樣（這個格式會在 Phase 4 被包裝成一個 API 端點）。

**狀態：已於 2026-09-17 完成**。環境 `envs/finrl`（3.12，FinRL commit `2334a5f`，SB3 2.9.0），lockfile `requirements/finrl.lock.txt`。三支腳本都在 `finrl-work/` 執行（腳本把輸出寫在當前目錄，這樣上游 clone 保持乾淨），產出 `finrl-work/train_data.csv`、`trade_data.csv`、`trained_models/agent_{a2c,ddpg,ppo,td3,sac}.zip`、`backtest_result.png`。`TA-lib` 沒裝（要系統 C 函式庫，三支腳本用不到）。

**Phase 4 要用的訊號格式**（來自 `DRLAgent.DRL_prediction(model, env)`，回傳 `(df_account_value, df_actions)`）：
- `df_actions`：index 是交易日 `date`，欄是 DOW 30 的 ticker，值是**整數股數**，正=買、負=賣、0=不動（`hmax=100` 上限）。例：PPO 在 2026-01-02 對 MSFT 是 `+15`、NVDA `+6`、AAPL `0`。
- `df_account_value`：`date`、`account_value` 兩欄，逐日總資產。
- 重建 env 需要跟 `FinRL_StockTrading_2026_3_Backtest.py` 一樣的 `env_kwargs`（`hmax=100`、`initial_amount=1e6`、`turbulence_threshold=70`、`risk_indicator_col="vix"`、`INDICATORS`），且輸入的 df 必須先經過同一套 `FeatureEngineer`（技術指標 + vix + turbulence）——這是 Phase 4 端點的主要工作。
- 模型是**針對 30 檔一起決策**的（action_space=30），不是單一 ticker 模型；Phase 4 的 `/finrl/signal/{ticker}` 是從 30 欄裡取出該 ticker 那一欄。

## Phase 3：驗證 FinGPT Forecaster（財經文本洞見引擎，7B）

**先確認用哪個模型**：FinGPT 底下有多個模型，這裡指定用 **Forecaster（7B，LoRA on Llama-2-7b-chat-hf）**，輸出格式是 `[Positive Developments]` / `[Potential Concerns]` / `[Prediction & Analysis]` 三段式分析，已經涵蓋「正負面摘要＋預測方向」。**不要**用 FinGPT 的 Sentiment 模型（13B，fp16 約 26GB）——這台 24GB 機器裝不下，而且 Forecaster 的輸出已經滿足這個專案需要的洞見層，不需要再多裝一個模型。

1. 在另一個獨立環境中執行：
   ```
   git clone https://github.com/AI4Finance-Foundation/FinGPT.git
   cd FinGPT
   pip install -r requirements.txt
   pip install -e .
   ```
   - 先試 Python 3.12；`fingpt/FinGPT_Forecaster/requirements.txt` 內部釘死 `torch==2.0.1`、`transformers==4.32.0`，沒有 3.12 wheel。如果這些套件裝不起來，把**這一個環境**（只影響 Phase 3，不動 Phase 1/2/4/5 用的環境）降到 Python 3.11 再重試。
   - 基礎模型改用 **`NousResearch/Llama-2-7b-chat-hf`**（跟官方 `meta-llama/Llama-2-7b-chat-hf` 同一份權重的非 gated 鏡像），可以跳過 HuggingFace 帳號審核＋`HF_TOKEN` 的流程。下載約 13.5GB。
2. **硬體分流（已知：macOS，24GB 統一記憶體）**：
   - fp16 權重 13.5GB＋LoRA＋KV cache，理論上塞得進 24GB 機器 MPS 預設上限（約 16GB）。**先不要動 `sudo sysctl iogpu.wired_limit_mb` 調整記憶體上限**——這需要 `sudo`，屬於你要自己動手執行的操作，Claude Code 無法代為執行；真的塞不下再考慮。
   - 設定 `export PYTORCH_ENABLE_MPS_FALLBACK=1`（讓 MPS 尚未實作的運算子自動退回 CPU，跟記憶體大小無關，留著無害）。
   - **不要**直接跑上游 `app.py`——那是寫死 gated 模型＋`HF_TOKEN`＋`FINNHUB_API_KEY` 的 Gradio demo，依範疇守則 #4 不修改上游原始碼。在專案內另外寫一支自己的 smoke test 腳本，import 上游 `prompt.py` 裡的 helper function 組 prompt，把換成 NousResearch 版的 base model＋LoRA adapter 載到 `mps` 裝置推論。
   - **速度心理準備**：Apple Silicon 這個記憶體頻寬量級大約估 5-8 tok/s，Forecaster 一次回答約 300-500 tokens，單次呼叫大概 1-2 分鐘。Phase 3 的 smoke test 可以接受，但 Phase 5 包成 agent 工具時要讓使用者知道這個延遲。
   - 資料來源：這一步**不需要 Finnhub 金鑰**——手動餵一小段新聞文字進去測試就好（上游完整資料管線才需要 Finnhub；Phase 5 之後新聞改由 OpenBB 提供，跟 Finnhub 無關）。
3. **雲端備援（不是環境變數開關）**：FinGPT repo 沒有「一鍵切雲端」的機制——`FINGPT_LLM_PROVIDER` 這個變數只存在於 repo 內 `finogrid/`（一個帶 GCP Pub/Sub、Postgres、BigQuery 依賴的獨立子專案），`FinGPT_Forecaster/` 完全不會讀它，**不要**安裝 `finogrid`（依範疇守則 #3，避免多裝不必要的重型依賴）。正確做法：自己的薄膠水層沿用上游 `prompt.py` 的 Forecaster 系統提示與輸出格式，改呼叫雲端 LLM API（例如 OpenAI 或其他你偏好的供應商）產生同樣結構的三段式輸出——這樣不論本地或雲端跑，Phase 5 拿到的輸出格式都一致。若第 2 點的本地路線跑起來記憶體不足或太慢，直接切這條雲端備援，不要花時間硬調本地環境。

**Phase 3 完成判準**：能用本地或雲端路線之一，對一段輸入的財經新聞文字成功呼叫，拿到 `[Positive Developments]` / `[Potential Concerns]` / `[Prediction & Analysis]` 三段式結構化輸出，理解這個格式（會在 Phase 5 被包裝成 agent 工具的回傳格式）。

**狀態：已於 2026-09-17 完成，本地 MPS 路線可用，不需要雲端備援**。
- 環境 `envs/fingpt`（**3.12 直接可用，沒有降 3.11**：torch 2.14、transformers 5.17、peft 0.21、numpy 1.26），FinGPT commit `cefb3a2`，lockfile `requirements/fingpt.lock.txt`。
- 模型在 HF cache（`~/.cache/huggingface`，13 GB）：`NousResearch/Llama-2-7b-chat-hf`（只抓 safetensors）+ `FinGPT/fingpt-forecaster_dow30_llama2-7b_lora`。
- 實測（`fingpt-smoke/smoke_test.py`）：fp16 載到 `mps` 8 秒、625-token prompt、生成 333 tokens 55 秒 = **6.0 tok/s**，沒動 `sysctl`。單次呼叫約 1 分鐘，符合預期。
- prompt 組法：上游 `app.py` 一 import 就載 gated 模型、`prompt.py` 的 helper 吃 Finnhub 資料列，兩者都不能直接 import；所以 `SYSTEM_PROMPT`／`[INST]`／`<<SYS>>` 標記和結尾指令字串從 `app.py` **原樣複製**到自己的腳本（檔頭註明來源）。Phase 5 的 `fingpt_tool.py` 沿用這個做法。
- 輸出格式確認：`[Positive Developments]:` 編號清單 / `[Potential Concerns]:` 編號清單 / `[Prediction & Analysis]:` 含 `Prediction: Up/Down by X-Y%` 一行 + `Analysis:` 段落。Phase 5 可用正則切這三段。
- 注意：模型只在 DOW 30 上微調過，且 `do_sample=True`（上游預設）每次輸出會不同。

## Phase 4：把 FinRL 訊號包裝成一個本機 API 端點

1. 建立資料夾 `openbb-backend/`，結構如下（每個資料源獨立一個檔案，方便之後擴充）：
   ```
   openbb-backend/
     main.py            # FastAPI app 入口（也負責 serve Phase 6 建置好的靜態 UI）
     widgets.json        # widget 註冊清單（見下方說明）
     widgets/
       finrl_signal.py   # 讀取 Phase 2 訓練好的模型，輸出交易訊號
   ```
2. `main.py` 需要：
   - 建立 FastAPI app
   - 提供一個 `GET` 端點回傳 FinRL 訊號（例如 `/finrl/signal/{ticker}`）
   - 不需要 CORS 設定：Phase 6 的 dashboard 建置後是靜態檔，由這個 FastAPI 直接 serve（同源）。之後如果 Workspace 情況明朗、真的要接進去，再補 `pro.openbb.co` 的 CORS
3. `widgets.json` 還是照 OpenBB 官方規格寫（name、description、category、endpoint、回傳格式）——這份設定檔**現階段不會被用到**（Workspace 現在連不上），但寫好放著幾乎零成本，之後 Workspace 情況明朗時可以直接拿來用，不算是現階段的額外工作量。
4. 本機啟動這個 backend（例如 `uvicorn main:app --port 8001`），直接用瀏覽器或 `curl` 呼叫端點確認能拿到正確格式的訊號資料——**不需要透過 Workspace 驗證**，Phase 6 的自建 dashboard 會是真正的消費端。

**Phase 4 完成判準**：`http://localhost:8001/finrl/signal/{ticker}` 能回傳正確格式的 FinRL 訊號。

**狀態：已於 2026-09-17 完成**。跑在 `envs/finrl`（加裝 fastapi、uvicorn，lockfile 已更新）；啟動：`cd openbb-backend && ../envs/finrl/bin/uvicorn main:app --port 8001`（也在 `.claude/launch.json`）。
- 資料流：`openbb-api` → DOW 30 還原權息 OHLCV（`adjustment=splits_and_dividends`，對應 FinRL 訓練資料）+ `^VIX` → 上游 `FeatureEngineer`（`use_vix=False`，VIX 改由 openbb-api 提供，其餘同 script 1）→ 最近 60 個交易日的 `StockTradingEnv`（`env_kwargs` 同 script 3）→ 5 個模型。
- **訊號語意（重要）**：agent 幾乎都在 episode 開頭建倉、之後長抱，所以「今天的 action」單獨看幾乎都是 0。端點因此回傳兩個欄位：`shares` = 模型今天的**原始意圖**（`model.predict` × hmax，未被現金/持股裁切；例如 `SELL -100` 但 `position 0` 表示看空但無股可賣），`position` = 模擬組合裡目前持股。這跟上游 `DRL_prediction` 回傳的 `df_actions`（已執行股數）不同，所以自己寫了 8 行 env 迴圈而不是呼叫 `DRL_prediction`（後者跑完 VecEnv 會自動 reset，持倉會消失）。`EPISODE_DAYS=60` 是設計參數，改它會改變訊號。
- 回傳格式：list of 5 rows，每列 `{ticker, as_of, close, agent, action(BUY/SELL/HOLD), shares, position}`；同時支援 `/finrl/signal/{ticker}` 與 `/finrl/signal?ticker=`（後者給 `widgets.json` 用）。非 DOW 30 回 404。
- 效能：每天第一次呼叫約 4 秒（抓資料 + 特徵 + 5 個 agent 各 60 步），之後同日快取，6 ms。**2026-09-21 修正**：快取 key 與資料截止改用「最後一個已收盤的交易日」（ET 16:00 前 = 前一日），因為盤中 yfinance 會回傳當天未完成的日 K，原本會拿半根 K 算指標並快取一整天（實測 PPO 股數因此不同）。
- `widgets.json` 照 OpenBB 規格寫了，但**沒有 Workspace 可驗證**。

## Phase 5：把 FinGPT 洞見包裝成 Agent 工具（簡單路線）

**決策（2026-09-17）：不用 `openbb-agent-server`**。它是 OpenBB 員工的個人 repo（v0.1.1，不在 OpenBB-finance 組織下），存在目的是講 OpenBB Workspace 專屬的 custom-agent SSE 協定，並帶 25 個必要依賴（LangChain DeepAgents、LangGraph、alembic、sqlite-vec…）。Workspace 用不到之後，它唯一不可取代的價值也沒了；它的 `mcp_local` 工具源底層就是 spawn `openbb-mcp-server`，而這個指令（`openbb-mcp`）已隨 `openbb[all]` 裝在 `envs/openbb`。所以改成自己寫一層薄的 agent，資料仍然全部來自 OpenBB。它內建的多 profile、對話記憶、RAG 不在垂直切片內，需要時再逐項加到自己的 agent 上。

1. 資料工具源：用 `openbb-mcp`（OpenBB-finance 官方 MCP server 擴充，已安裝）提供 OpenBB Platform 的完整資料存取，agent 透過 MCP client 呼叫它。這樣 FinGPT 分析的輸入資料直接來自 OpenBB，不自己重寫一套抓取邏輯。
2. 建立資料夾 `agent/`，結構：
   ```
   agent/
     main.py              # FastAPI app，提供 agent 對話端點（SSE 串流），port 8010
     loop.py              # LLM tool-use 迴圈：把 openbb-mcp 的工具 + fingpt_tool 交給 LLM
     tools/
       fingpt_tool.py     # 把 Phase 3 驗證過的 FinGPT 呼叫包裝成一個 tool
   ```
   目標是 100–200 行內，沒有框架。
3. LLM 供應商：一把雲端 API 金鑰（由使用者自行設定成環境變數，Claude Code 不經手金鑰值；供應商到時候再選）。
4. 啟動：在 `agent/` 目錄下 `uvicorn main:app --port 8010`。
5. 直接用 `curl` 或簡單的測試腳本呼叫 `http://localhost:8010` 確認 agent 能正常回應——不需要 Workspace。Phase 6 的 dashboard 會是真正的消費端。

**Phase 5 完成判準**：能對 `http://localhost:8010` 送出一個問題（例如「幫我看一下 AAPL 最近的新聞」），拿到引用 OpenBB 資料（經 `openbb-mcp`）、FinGPT 風格三段式分析的回應。

**狀態：已於 2026-09-17 完成**。LLM 供應商 = **Google Gemini**（免費額度；`gemini-2.5-flash` 對新用戶已下架，預設改 `gemini-3.6-flash`，可用 `GEMINI_MODEL` 覆蓋）。金鑰在 `agent/.env`（`GEMINI_API_KEY=`，已 gitignore，由使用者自行放入）。
- 跑在 `envs/fingpt`（加裝 google-genai、mcp、fastapi、uvicorn、python-dotenv；lockfile 已更新）。啟動順序：`openbb-api`(6900) → `openbb-mcp`(8005，`--allowed-categories equity,news,index`) → `cd agent && ../envs/fingpt/bin/uvicorn main:app --port 8010`。三者都在 `.claude/launch.json`。
- 給 Gemini 的工具只有 6 個：openbb-mcp 的 `equity_profile / equity_price_quote / equity_price_historical / news_company / equity_fundamental_metrics`（schema 去掉 `provider`，呼叫時固定注入 `yfinance`，避免 LLM 選到付費供應商）+ 本機 `fingpt_forecast(ticker)`。
- `fingpt_forecast` 自己從 `openbb-api` 抓 profile／2 週價格／新聞／基本面組 prompt（格式照上游 `app.py` `get_all_prompts_online`），Gemini 不經手新聞內容。限制：yfinance 新聞只有最新 ~10 則、無日期範圍，所以通常只有最近一週有新聞。單次約 60–90 秒。 **2026-09-21 修正**：(a) 價格序列改以「最後一個已收盤的交易日」截止（同 Phase 4 的修正），新聞窗口則照上游用日曆週到今天為止——兩者要分開，否則盤中查詢時當天的新聞（yfinance 常常 10 則全是當天）會整批被切掉；(b) 加了 `threading.Lock` 包住載模型＋生成，同時兩個請求不再搶 MPS（也避免首次呼叫同時載兩份 13GB 模型）。
- 端點：`POST /chat {"message"}` → SSE，事件 `tool_call` / `tool_result`（preview 300 字）/ `text`（最終回答）/ `error`。無狀態、無對話記憶（垂直切片不需要）。
- 驗收：「幫我看一下 AAPL 最近的新聞，FinGPT 怎麼說？」→ Gemini 依序呼叫 `news_company`、`fingpt_forecast`，1 分 46 秒回傳繁中摘要 + FinGPT 三段式報告並標注資料來源工具。

## Phase 6：自建 Web Dashboard（暫代目前無法使用的 Workspace）

目標：做一個單頁 dashboard，把原始市場資料、Phase 4 的 FinRL 訊號、Phase 5 的 FinGPT agent 兜在同一個畫面。**不用 Streamlit**（模板感太重），視覺目標是 OKX / Robinhood 那種深色、高對比、有科技感的介面。

技術棧（2026-09-17 決定）：**React + Vite + TypeScript + Tailwind**（跟 ODP Desktop 同一套），K 線圖用 **TradingView Lightweight Charts**（Apache-2.0，交易所風格的圖就是這個系統）。

1. 建立 `ui/`（Vite 專案），一個頁面：輸入股票代號 → 三個區塊並排：
   - 市場資料：呼叫 `openbb-api`（`127.0.0.1:6900`）拿歷史價格，畫 K 線
   - FinRL 訊號：呼叫 `http://localhost:8001/finrl/signal/{ticker}`
   - FinGPT 分析：呼叫 `http://localhost:8010` 的 agent 端點，串流顯示
   一個元件一個檔，之後加區塊 = 加元件檔。
2. 開發時 `npm run dev`（Vite dev server）；完成後 `npm run build` 產出靜態檔，由 Phase 4 的 `openbb-backend/main.py` 直接 serve——**正式使用時不需要 Node 服務**，Phase 8 少管一個服務。
3. **誠實預期**：畫面質感可以做到，但「每秒跳動的即時報價」需要 WebSocket 即時資料源，OpenBB 免費層（yfinance）給的是日線／延遲資料。作品集階段用日線級資料是合理取捨，之後要即時再接付費源。
4. **維護技能提醒**：React/TypeScript 不是使用者原本熟的技術（原本熟 Streamlit），之後改 UI 會比較依賴 Claude Code；結構切乾淨（一元件一檔）是為了降低這個成本。

**Phase 6 完成判準**：開瀏覽器連到 backend 的位址（`http://localhost:8001`），輸入一支股票代號，能同時看到 K 線、FinRL 訊號、FinGPT 分析——這是目前真正的「一站式看板」。

**狀態：已於 2026-09-17 完成**。`ui/`（Vite 8 + React 19 + TypeScript + Tailwind v4 + lightweight-charts 5 + react-markdown）。
- 檔案：`src/App.tsx`（版面與狀態）、`src/api.ts`（三個後端的 fetch + SSE 解析）、`src/i18n.ts`（EN／繁中字串，`localStorage` 記住選擇）、`src/components/{TopBar,PriceChart,FinrlSignals,AgentChat}.tsx`（一元件一檔）。
- 開發：`cd ui && npm run dev`（5173，在 `.claude/launch.json` 叫 `ui-dev`）；正式：`npm run build` → `ui/dist`，由 `openbb-backend/main.py` 用 `StaticFiles` 掛在 `/`（**`http://localhost:8001/` 就是 dashboard**）。改 UI 後要重新 build。
- UI 直接呼叫 `127.0.0.1:6900`（openbb-api 的 CORS 是 `*`）、`8001`、`8010`；backend 與 agent 各加了一行 `CORSMiddleware`（只允許 `localhost/127.0.0.1` 任意埠），所以 Phase 4 原本寫的「不需要 CORS」已修正。
- **已知的資料源怪癖**：openbb-api 的 yfinance `equity/price/quote` 每次回傳欄位不一致（`last_price`／`prev_close` 時有時無），所以頂欄價格與漲跌改由日 K 線最後兩根計算，quote 只拿公司名稱。
- 版面：視窗 ≥1024px 為左右兩欄、整頁鎖在視窗高度內（聊天在面板內捲動）；<1024px 改上下堆疊、整頁可捲動，聊天面板固定 520px（2026-09-17 修正：原本堆疊模式聊天面板會被壓成只剩輸入框）。
- 聊天框：顯示 `tool_call` 步驟（單行截斷、hover 看全文）→ 最終回答以 Markdown 渲染；「FinGPT → {ticker}」快捷鈕直接問模型本週看法；無對話記憶。
- 驗收畫面：AAPL／NVDA 切換後 K 線、報價、FinRL 五列都更新；NVDA 的 FinGPT 快捷問答約 1.5 分鐘回覆並渲染。

## Phase 7：端到端驗收

用一個具體情境走一遍全流程（例如：「幫我看一下 AAPL，FinRL 訊號怎麼說、FinGPT 對最近新聞怎麼解讀」），確認：

- Phase 6 的自建 dashboard 一次能看到：原始市場資料、FinRL 訊號、FinGPT 的對話式分析。
- 三者資料來源一致（都源自 OpenBB 的資料層），沒有各自兜自己的資料造成版本不一致。

**狀態：已於 2026-09-17 完成**。
- 服務：`6900`(openbb-api) 200、`8005`(openbb-mcp) 400（無 MCP 標頭的 GET 會 400，代表活著）、`8001`(backend+UI) 200、`8010`(agent) 200。
- 資料一致性（AAPL，2026-09-17）：UI 頂欄／K 線最後一根 = **337.00**；FinRL 端點 `close` = **337.00**；FinGPT prompt 本週結尾價 = **337.00**——三者都來自 `openbb-api` 的 yfinance provider、同一天。注意：K 線圖用未還原價格（一般圖表慣例），FinRL／FinGPT 用 `adjustment=splits_and_dividends`（與訓練資料一致），所以**歷史**價格兩者會因除息略有差異，只有最新一天相同。
- 情境：dashboard 上按「FinGPT → AAPL」，Gemini 呼叫 `fingpt_forecast`，回傳「Down by 1-2%」與三段式摘要，K 線 + FinRL 五列 + FinGPT 回答同框。
- **延遲提醒**：agent server 重啟後第一次 FinGPT 呼叫要先載模型（+8 秒），且若前一個生成還沒結束、新請求會同時搶 MPS，整體可能拉到 3–4 分鐘；正常單次 1–1.5 分鐘。可選的改善（未做）：在 agent 啟動時就預載模型。

## Phase 8：打包成雙擊啟動的本機 App（macOS，使用官方 ODP Desktop）

目標：把 Phase 1、4、5 累積下來、原本要開三個終端機視窗分別啟動的東西（`openbb-api`、`openbb-backend/`（含 Phase 6 建置好的靜態 UI）、`agent/`），整合成用 **ODP Desktop** 這一個桌面小工具統一管理，達到「開一個 App、按 Start，三個服務一起就緒」的體驗。已查過 ODP Desktop 原始碼（`desktop/src/routes/backends.tsx`）：「Backends」畫面可登記任意 `command` + `port`，所以自訂服務可行。選這條路而不是自己寫啟動腳本，是因為 ODP Desktop 是 OpenBB 官方維護的工具（且只管理本機服務，不涉及 Workspace 帳號，不受近況更新影響），穩定性跟長期支援比自己寫的 shell script 更有保障。

1. ⚠️ **以下這步需要使用者本人操作**：從 `https://github.com/OpenBB-finance/OpenBB/releases`（tag `ODP`）下載 macOS 版 ODP Desktop 並安裝，第一次開啟時它會建立預設的 `openbb` 環境。
2. 在 ODP Desktop 的「Environments」畫面，確認 Phase 1 用的那個 Python 環境（或另外建一個給 ODP Desktop 管理的環境）已經安裝了 `openbb[all]`、Phase 4 的 `openbb-backend/` 依賴、以及 Phase 5 的 `agent/` 依賴。**注意**：ODP Desktop 用 Miniforge 管 conda 環境，本專案的 `envs/*` 是 uv venv，「Environments」畫面大概看不到它們——到時候二選一：登記的 command 直接用絕對路徑指到 venv 裡的執行檔，或另建一個由 ODP Desktop 管理的 conda 環境重裝。
3. ⚠️ **以下這步需要使用者本人操作（GUI 設定，Claude Code 只能提供指令文字，無法代為點擊）**：在 ODP Desktop 的「背景服務」管理畫面裡，登記三個要常駐的服務：
   - 內建的 `openbb-api`（通常是預設項目）
   - 自訂腳本：在 `openbb-backend/` 目錄下執行 `uvicorn main:app --port 8001`
   - 自訂腳本：在 `agent/` 目錄下執行 `uvicorn main:app --port 8010`
4. 按下 ODP Desktop 的 Start 按鈕，確認三個服務都顯示為執行中。
5. 開瀏覽器連到 `http://localhost:8001`（Phase 6 的 dashboard，由 backend serve），確認功能跟 Phase 7 驗收時完全一致（位址不變，只是啟動方式換了）。

**誠實的心理預期**：這不是「雙擊一個圖示、瀏覽器自動跳出來、什麼都不用管」的全自動體驗——你還是要按一次 Start、自己開瀏覽器連 dashboard。它解決的是「不用再手動開三個終端機視窗、記三條指令」這件事，把啟動流程收斂成一個桌面小工具操作。如果之後想要更進一步（例如登入時自動啟動、自動開瀏覽器），那是額外的加強，可以晚點再談，不影響現在的架構。

**Phase 8 完成判準**：關閉所有手動開的終端機視窗，只靠 ODP Desktop 按 Start，三個服務都正常啟動，dashboard 功能跟 Phase 7 驗收時完全一致。

**狀態：已於 2026-09-17 完成**。ODP Desktop v1.0.2（`Open-Data-Platform_latest_aarch64.dmg`，裝在 /Applications），首次啟動建的 conda 環境在 `~/OpenBB/conda/envs/openbb`（Python 3.12，擴充全選）。
- 實際登記了**四個** Backends（比原規劃多一個 openbb-mcp，因為 Phase 5 改簡單路線後 MCP 是獨立服務）：
  | 名稱 | Command | Port |
  |---|---|---|
  | OpenBB API（內建，**Phase 15 改成 3 worker**） | `uvicorn openbb_platform_api.main:app --host 127.0.0.1 --port 6900 --workers 3` | 6900 |
  | OpenBB MCP（內建，**已改**：原預設 port 8001 跟 backend 撞，改成 8005 + 類別限制） | `openbb-mcp --transport streamable-http --host 127.0.0.1 --port 8005 --allowed-categories equity,news,index --default-categories equity,news,index` | 8005 |
  | openbb-backend | `/Users/alexchiang/Desktop/Coding/FinGPT/envs/finrl/bin/uvicorn main:app --port 8001 --app-dir /Users/alexchiang/Desktop/Coding/FinGPT/openbb-backend` | 8001 |
  | agent | `/Users/alexchiang/Desktop/Coding/FinGPT/envs/fingpt/bin/uvicorn main:app --port 8010 --app-dir /Users/alexchiang/Desktop/Coding/FinGPT/agent` | 8010 |
- API／MCP 跑在 ODP 的 conda 環境；backend／agent 用絕對路徑指到專案的 uv venv（`--app-dir` 取代 `cd`），已用 `lsof` 確認四個埠的程序都是 ODP Desktop 的子程序。啟動順序：API → MCP → backend → agent。
- 驗收：`http://localhost:8001/` dashboard 3/3 online、FinRL 訊號正確；agent 問「幫我看一下 AAPL，FinGPT 對最近新聞怎麼解讀？」→ 呼叫 `fingpt_forecast` + `equity_price_quote`，回傳繁中報告（Down by 0-1%）。
- 途中修正：Gemini 免費層偶發 503/429，`agent/loop.py` 加了 4 次重試（5/15/30 秒退避），避免 FinGPT 跑完 1.5 分鐘後被一個暫時性錯誤作廢。**改 `agent/` 或 `openbb-backend/` 的程式後，要在 ODP Desktop 把該服務 Stop → Start**（沒有 auto-reload）；改 `ui/` 要 `npm run build`。
- `.claude/launch.json` 仍保留給 Claude Code session 開發用；日常使用只靠 ODP Desktop。

## Phase 9：Dashboard「基本面」分頁（三張卡）

任務簡報來源：`phase9-fundamentals-cards.md`（使用者提供，原文以 Streamlit 寫成，已依 Phase 6 的 React 架構翻譯）。範圍：新增「基本面」分頁，內含公司概況、關鍵指標、EPS 趨勢三張卡；美股。股利卡／財報行事曆／分析師評等分布、其他分頁（技術面／消息面／籌碼面／財務報表）不在此範圍。

**狀態：已於 2026-09-18 完成**。

**分頁機制**：`ui/src/App.tsx` 加了 `tab` 狀態與分頁列（`AI Analysis` / `Fundamentals`，走 `i18n.ts`）；原本三個面板原封不動包進 AI 分頁。**兩個分頁都保持掛載、用 `hidden` 切換**（不是條件渲染），這樣切分頁時聊天紀錄與圖不會消失。之後加分頁 = `Tab` 型別加一個值、分頁列陣列加一項、加一個 `<main>`。

**卡片與資料（都先實際呼叫印過 schema 再寫）**：
| 卡 | 檔案 | 資料 | 備註 |
|---|---|---|---|
| 公司概況 | `ui/src/components/fundamentals/CompanyProfile.tsx` | `openbb-api /equity/profile`（yfinance） | `name, sector, industry_category, long_description, employees, hq_*, stock_exchange, market_cap`；簡介取前兩句（句尾判定以「. 」且相隔 ≥40 字，避免 "Apple Inc." 被當句尾） |
| 關鍵指標 | `KeyMetrics.tsx` | `/equity/fundamental/metrics`（P/E、殖利率、Beta）+ `/equity/fundamental/income?period=quarter`（EPS TTM） | **`dividend_yield` 已是百分比**（AAPL 0.32、KO 2.41），不要再 ×100。yfinance metrics **沒有 EPS 欄位**，EPS TTM = 近四季 `diluted_earnings_per_share` 加總（AAPL 8.72 vs yfinance trailingEps 8.83，差在股數口徑；KO 3.33 相同） |
| EPS 趨勢 | `EpsTrend.tsx` + **`openbb-backend/widgets/eps_trend.py`** | `GET /fundamentals/eps_trend/{ticker}` → 8 季實際（含當季分析師預估）+ 未來 2 季共識預估 | **這張卡的資料不經 openbb-api**（例外，見下）。Lightweight Charts 兩條 LineSeries：實際實線（accent）、預估虛線（`LineStyle.Dashed`），預估線從最後一個實際點接出；`+1q` 沒有日期 → 前一點 +91 天畫在時間軸 |

**為什麼卡三直接用 `yfinance` 套件（2026-09-18 決策 A）**：openbb-api 的 yfinance provider 沒有 EPS 歷史（`/fundamental/historical_eps` 只支援 alpha_vantage/fmp，要金鑰）也沒有 EPS 預估（`/estimates/consensus` 的 yfinance 版只有目標價與評等；`/estimates/forward_eps` 只支援 fmp/intrinio/seeking_alpha）。但 yfinance 套件本身的 `earnings_dates` / `earnings_estimate` 有完整資料。依「延伸與維護原則」的「ODP 缺的那一小塊直接用 yfinance 抓」處理，獨立成一個 widget 檔。其他兩張卡仍全部經 openbb-api。

**yfinance 版本**：`envs/finrl`（backend 的環境）原本解析到 0.2.58，其 `earnings_dates` 資料停在 2025-05；升到 1.7.0 會讓 FinRL 的 `YahooDownloader` 壞掉（1.x 移除 `proxy` 參數，守則 #4 不改上游）。**釘在 0.2.66**：財報資料完整且 `YahooDownloader` 正常，lockfile 已更新。

**圖表在隱藏分頁掛載的問題**：Lightweight Charts 在 `display:none` 容器裡建立時 `fitContent` 算到寬度 0，切回來時間軸是塌的；`EpsTrend.tsx` 與 `PriceChart.tsx` 各加了 `ResizeObserver → fitContent()`。

**驗收**：AAPL／KO 兩支在 EN／繁中下三張卡都正確；AI 分頁功能不變；正式版（`npm run build` → 8001）已確認。改了 backend 需在 ODP Desktop 重啟 `openbb-backend`（已做）。

## Phase 10A：價格圖區間切換 + 盤中分鐘級更新

**狀態：已於 2026-09-18 完成**。使用者問「能不能即時走勢與月／年 K」，討論後決定分兩步：A（本節，全部經 openbb-api）先做；B（秒級跳動，用 yfinance 套件的 `WebSocket` 串流轉 SSE，屬 eps_trend 那種例外）保留為可選。

- **區間列**（`ui/src/components/RangeBar.tsx`，在價格面板標題右側）：`1D · 1W · 1M · 3M · 1Y · 5Y · MAX`，每個區間對應一組 yfinance `interval`（表在 `api.ts` 的 `RANGES`）：1D=1 分K（yfinance 只保留約 7 天，取最後一個交易日）、1W=5 分K（約 60 天上限）、1M/3M/1Y=日K、5Y=週K、MAX=月K。選擇記在 `localStorage`。
- **盤中更新**：1D／1W 每 60 秒重抓一次（`App.tsx` 的 effect），並同時重抓日 K 給頂欄；分鐘級「準即時」，只在美股盤中（台灣時間 21:30–04:00，冬令 22:30–05:00）有變化。實測最後一根 K 的時間戳 = 當下 ET 時間。
- **頂欄價格改用獨立的日 K 序列**（`daily` state，不隨區間變），漲跌 = 今日（進行中）收盤 vs 昨收；否則 1D 模式下會變成「vs 前一分鐘」。
- **`PriceChart.tsx` 重構**：圖只建立一次，資料用 `setData` 更新；只有在「新的 ticker:range 第一批資料」時 `fitContent`，輪詢刷新不重設使用者縮放。盤中 K 棒的時間是 ET 牆鐘時間字串（`YYYY-MM-DDTHH:MM:SS`），把它當 UTC 丟給 Lightweight Charts，軸上就顯示美東市場時間。
- **踩到的坑**：切換區間時 React 會先用「舊資料 + 新 key」渲染一次，導致圖用舊資料 fit 了新 key、真資料進來不再 fit（1D→5Y 只顯示最後 75 週）。解法是把 bars 和它所屬的 `ticker:range` key 放在**同一個 state**（`series`），並用 `alive` 旗標丟掉過期的 fetch。
- 驗收：1D／5Y／MAX 都正確填滿；1D 縮放後等 70 秒，價格與最後一根 K 更新、視圖不動。

## Phase 10B：秒級即時報價（Yahoo 串流 → SSE）

**狀態：已於 2026-09-18 完成（盤後驗證；正規盤的 K 棒即時更新邏輯已寫好但尚未在盤中實看）**。使用者問「是否要付費 API」→ 答：不用，先走免費的 yfinance `WebSocket`（Yahoo 串流，非官方協定），壞掉再換免費官方 WebSocket（Alpaca IEX／Finnhub／Tiingo 免費層，要金鑰）。

- **Backend** `openbb-backend/widgets/live_quote.py`：`GET /live/{ticker}` 回 SSE；每個連線各開一個 `yf.AsyncWebSocket` 訂閱該檔，tick 轉成 `data: {price, time(ms), change, change_percent, market_hours, day_volume?}`，15 秒沒資料送 `: keep-alive` 註解；客戶端斷線就關 WS。跟 eps_trend／institutional 同類的「不經 openbb-api」例外（openbb-api 沒有串流）。`market_hours`：0 盤前、1 正規盤、2 盤後、3 延長。
- **UI**：`api.ts` 的 `subscribeLive()`（`EventSource`，斷線自動重連）與 `applyTick()`（把 tick 折進最後一根 K：更新 close/high/low；分鐘 K 遇到新的一分鐘就補一根 volume 0 的新棒，60 秒輪詢仍保留當成交量與校正來源）。`App.tsx` 每次換 ticker／區間重新訂閱；**只有 `market_hours === 1` 才折進 K 棒**（圖表維持正規盤資料），盤前／盤後 tick 只更新頂欄。`TopBar` 有 tick 時優先顯示 tick 價格與 Yahoo 的 `change_percent`（相對前一正規收盤，盤前／盤後也正確），並顯示 LIVE（綠、脈動）／PRE／POST 標籤。
- **實測特性**：Yahoo 訂閱後**約 20 秒才送第一筆**（standalone 腳本也一樣，不是我們的延遲），之後盤後每 2–10 秒一筆；瀏覽器 `EventSource` 30 秒收到 3 筆 NVDA。盤後頂欄正確顯示 335.26 −0.26% 盤後。
- 改 backend 後已在 ODP Desktop 重啟。若 Yahoo 改協定，`EventSource` 會一直重連失敗但不影響其他功能，UI 仍靠 60 秒輪詢。

## Phase 11：Dashboard「技術面」分頁（三張卡）

任務簡報來源：`phase9-technical-cards.md`（使用者提供，Streamlit 寫法，已翻譯）。**狀態：已於 2026-09-18 完成**。零新依賴（md 說要加 plotly，但 Lightweight Charts 本來就畫蠟燭圖，不需要）。

**指標計算（2026-09-18 決策 A）**：把 UI 已持有的日 K `POST` 給 `openbb-api /api/v1/technical/{sma,stoch,macd,bbands}`（body = bars 陣列），拿回 OpenBB（pandas-ta）算好的欄位——這就是 md 的 `obb.technical`，本機、無外部 API。實際欄位名：`close_SMA_20`／`close_SMA_60`、`STOCHk_14_3_3`／`STOCHd_14_3_3`、`close_MACD_12_26_9`／`close_MACDs_12_26_9`／`close_MACDh_12_26_9`、`close_BBU_20_2.0`／`BBM`／`BBL`。參數：SMA 20/60（md）、KD 14,3,3 與 MACD 12,26,9（OpenBB 預設）、布林 20／2σ（OpenBB 預設是 50，改用慣例）。`api.ts` 的 `fetchTechnical(bars)` 一次發 5 個 POST（SMA 兩個長度），`Technical.tsx` 算一次後三張卡共用。

**共用資料、不重抓（md 原則）**：
- `App.tsx` 的 `daily` 序列從 1M 改成 **1Y 日 K**（頂欄邏輯不變），技術面分頁直接用它——AI 分頁的 K 線隨區間變（1D 是分鐘 K），不能拿來算 SMA60。
- `metrics`（P/E／殖利率／Beta）的抓取從 `KeyMetrics.tsx` 提到 `App.tsx`，`KeyMetrics` 改成接 prop；波動區間卡的 Beta 沿用同一份。這是這次唯一改到的 Phase 9 檔案（3 行）。

**卡片**（`ui/src/components/technical/`，共用 `chart.ts` 的 `mountChart()`：深色主題 + ResizeObserver 重 fit）：
| 卡 | 檔案 | 內容 |
|---|---|---|
| K 線走勢 | `CandleSma.tsx` | 蠟燭 + SMA20（橘）/SMA60（紫），成交量在 **Lightweight Charts v5 第二個 pane**（`addSeries(…, 1)` + `setStretchFactor` 3:1），共用時間軸 |
| 動能指標 | `Momentum.tsx` | 左 KD（K 藍／D 橘，`createPriceLine` 70/30 虛線，`autoscaleInfoProvider` 鎖 0–100）、右 MACD（DIF／Signal 線 + 正綠負紅柱） |
| 波動區間 | `Volatility.tsx` | 收盤線 + 布林上中下軌（上下虛線），Beta 在標題列右側 |

**yfinance 端點不穩定的第二個案例**：頁面同時打 7–8 個 yfinance 請求時，`equity/profile` 偶爾只回 10 欄（缺 sector／員工數／簡介），單獨呼叫都完整。`api.ts` 加了 `firstResult()`：關鍵欄位缺就等 1.5 秒重抓一次（profile 看 `sector`，metrics 看 `pe_ratio`/`beta`）。

**驗收**：AAPL 三張卡正確（SMA20 322.6 與 API 一致、KD 89/88、MACD 5.34/3.78、布林 340/323/305、Beta 1.08）；基本面與 AI 分頁不受影響；正式版 8001 已確認。

## Phase 12：Dashboard「消息面」分頁（兩張卡）

任務簡報來源：`phase9-news-cards.md`（使用者提供，Streamlit 寫法，已翻譯）。**狀態：已於 2026-09-18 完成**。零新依賴、免金鑰。

| 卡 | 檔案 | 資料（都經 openbb-api） | 顯示 |
|---|---|---|---|
| 個股新聞 | `ui/src/components/news/NewsList.tsx` | `news/company?provider=yfinance&limit=10`；欄位 `date`(UTC)、`title`、`url`、`source`（另有 `summary`/`text`，**依版權原則不顯示**，`NewsItem` 型別乾脆不宣告） | 每則一列：本地時間 `MM/DD HH:mm` + 標題 + 來源，整列開新分頁；yfinance 回來的順序不是時間序，UI 依 `date` 由新到舊排 |
| 8-K 重大訊息 | `Filings.tsx` | `equity/fundamental/filings?provider=sec&form_type=8-K&limit=10`（SEC EDGAR 官方，免費）；欄位 `filing_date`、`primary_doc_description`（8-K／8-K/A）、`items`（"2.02,9.01"）、`report_url` | 每筆 `[申報日] 8-K · Items 代碼…`，連到 EDGAR 原文件；item 代碼滑鼠移上去顯示 **SEC 官方 item 名稱**（`ITEMS` 靜態表 14 條，2026-09-18 決策 A1：是官方分類名稱、不是判讀，不違反分工原則） |

- 分工原則落實：這個分頁只有事實（標題／日期／連結），沒有情緒標籤或摘要；解讀留在 AI 分頁（FinGPT 用的也是同一個 yfinance 新聞端點，資料一致）。
- 既有檔只改 `App.tsx`（`Tab` 加 `news`、分頁列、一個 `<main>`）與 `api.ts`／`i18n.ts`（型別／字串）。
- 驗收：AAPL 10 則新聞（GuruFocus、IBD、Yahoo…）與 8 筆 8-K；20 個連結都是 `target=_blank rel=noopener`；正式版 8001 已 build。

## Phase 13：Dashboard「籌碼面」分頁（三張卡）

任務簡報來源：`phase9-ownership-cards.md`（使用者提供，Streamlit 寫法，已翻譯）。**狀態：已於 2026-09-18 完成**。md 預警可能要 FMP 金鑰，實測**三張卡都不用**：

| 卡 | 檔案 | 資料 | 備註 |
|---|---|---|---|
| 前五大機構持股 | `ui/src/components/ownership/Holders.tsx` + **`openbb-backend/widgets/institutional.py`** | `GET /ownership/institutional/{ticker}`：yfinance 套件 `institutional_holders`（13F），`holder / shares / value / pct_held / pct_change / date_reported`，比例是小數（0.0797） | openbb-api 的 `ownership/major_holders`、`ownership/institutional` **只有 fmp provider**（要金鑰），所以走 eps_trend 那種例外（2026-09-18 決策 A）。改 backend 後已在 ODP Desktop 重啟 |
| 內部人交易 | `Insiders.tsx` | openbb-api `ownership/insider_trading?provider=sec`（SEC Form 4 官方，免費）；欄位 `transaction_date / owner_name / owner_title / acquisition_or_disposition / transaction_type（SEC 長文字）/ securities_transacted / transaction_price / filing_url` | 顯示 取得／處分 + 短標籤（公開市場買進／賣出、RSU 歸屬／選擇權執行、繳稅扣股、其他；由 SEC `transaction_type` 前綴對映，原文在 tooltip）；`sec` provider 不理 `limit`，UI 端切 10 筆；`$0` 價格不顯示 |
| 放空與暗池 | `ShortsDarkPool.tsx` | 放空比率／回補天數：`ownership/share_statistics?provider=yfinance`（`short_percent_of_float` 是小數、`days_to_cover`、`date`）。暗池：`darkpool/otc?provider=finra`（FINRA ATS 週資料，只有分子 `share_quantity`） | **暗池佔比 = 最新一週 ATS 股數 ÷ 該週日 K 成交量加總**（用 App 共用的 1Y 日 K，零額外 API）；FINRA 資料延遲約兩週，tile 下方標示週別。三格 tile 樣式同基本面關鍵指標卡。**2026-09-21 修正**：openbb 的 finra provider 只回 `lastUpdateDate`（發布日）、沒帶 `weekStartDate`，原本把發布日當資料週起點，週一盤中分母只有一天 → 曾顯示 149.8%。實測 T1 ATS 的資料週 = 發布日往前 21 天所在週的週一（08-31→09-21、08-17→09-08 遇假日順延也符合），UI 改依此對應，AAPL 修正後 15.7%（週別 08-31） |

- 不能用的：`shorts/fails_to_deliver`（SEC 的 dcm.sec.gov 連不上）、`shorts/short_volume`（stockgrid 回空）、FINRA `shorts/short_interest`（可用但回 2021 至今整段、很慢，不需要）。
- 既有檔只改 `App.tsx`（`Tab` 加 `ownership`、分頁列、`<main>`）、`api.ts`／`i18n.ts`、`openbb-backend/main.py`（一行掛載）。
- 驗收：AAPL 五大機構（BlackRock 7.97% ▲+1.60% …，截至 2026-06-30）、10 筆 Form 4、放空 0.96%／回補 2.97 天／暗池 13.2%（週別 2026-09-14）；KO／MSFT 端點 200；正式版 8001 已 build。

## Phase 14：Dashboard「財務報表」分頁（三張卡）— 五大面向完成

任務簡報來源：`phase9-financials-cards.md`（使用者提供，Streamlit 寫法，已翻譯）。**狀態：已於 2026-09-18 完成**。分頁列定案：**AI 綜合分析 · 基本面 · 技術面 · 消息面 · 籌碼面 · 財務報表**（`App.tsx` 的 `Tab` 型別六個值）。零新依賴、免金鑰。

**資料**：`equity/fundamental/{income,balance,cash}?provider=yfinance&period=annual&limit=5`。**yfinance 實際只給 4 個完整會計年度**——第 5 列（最舊）主要欄位是 null，`fetchStatement` 依各報表要畫的欄位（`STATEMENT_KEYS`）過濾掉全空年份，並依 `period_ending` 由舊到新排序；年份標籤 `FY` + 年（AAPL 會計年度 9/30 結束）。

| 卡 | 檔案 | 欄位 | 備註 |
|---|---|---|---|
| 損益表 | `ui/src/components/financials/IncomeCard.tsx` | `total_revenue`、`gross_profit`、`operating_income`、`net_income` | 每年一組四條 |
| 資產負債表 | `BalanceCard.tsx` | `total_assets`、`total_liabilities_net_minority_interest`、`total_equity_non_controlling_interests`（三檔驗過欄位名一致） | Lightweight Charts 三條線；**流動比率**自算 = 最新一期 `total_current_assets` ÷ `current_liabilities`（AAPL 0.89），**銀行股兩欄是 null → 顯示「—」**（JPM 驗過） |
| 現金流量表 | `CashFlowCard.tsx` | `operating_cash_flow`、`investing_cash_flow`、`financing_cash_flow` 長條（零線為基準）+ **自由現金流**疊線 | FCF 自算 = OCF + `capital_expenditure`（**yfinance 的資本支出是負數**），結果與 yfinance 自己的 `free_cash_flow` 完全一致（AAPL 98,767M） |

**分組長條圖用純 SVG 自畫**（`BarChart.tsx`，2026-09-18 決策 A）：Lightweight Charts 是時間序列庫、畫不出「同一年份一組多條」；SVG 元件約 70 行，含零線、1/2/5 進位的整數刻度、hover 提示（年份 · 項目 · 金額）、可疊一條線。沒有引入 Recharts。

- 既有檔只改 `App.tsx`、`api.ts`、`i18n.ts`。
- 驗收：AAPL 四年損益分組長條、資產負債三線 + 流動比率 0.89、現金流三色長條 + FCF 線；JPM 流動比率「—」；hover 提示正確；正式版 8001 已 build。

## Phase 15：市場總覽首頁（全市場資訊）

**狀態：已於 2026-09-21 完成**。使用者希望「開網頁先看全市場」。決策：市場總覽是**預設首頁**（`App.tsx` 的 `view: 'market' | 'stock'`），輸入代號、點熱力圖或排行才進入個股六分頁；頂欄的標題／「← 市場總覽」回首頁。**個股面板在第一次開啟某檔後才掛載**（`stockOpened`），首頁不會先打 30 個 AAPL 請求。四張卡（`ui/src/components/market/`）：

| 卡 | 檔案 | 資料（都經 openbb-api，免金鑰） | 備註 |
|---|---|---|---|
| 指數列 | `IndexStrip.tsx` | `equity/price/historical?symbol=^GSPC,^DJI,^IXIC,^RUT,^VIX,^TNX&interval=5m`（**一次批次**，0.8s） | 現價、漲跌%、當日 5 分 K sparkline；昨收 = 前一交易日最後一根 5 分 K；60 秒輪詢。**不要用 `index/price/historical` 多 symbol**——它逐檔抓、6 檔要 12 秒 |
| S&P 500 熱力圖 | `Heatmap.tsx` + `squarify.ts` | `equity/screener?provider=finviz&index=sp500&limit=600` → 503 檔含 sector／industry／市值／`Change %`（小數） | 純 SVG squarified treemap：先 sector 後個股，方塊 = 市值、顏色 = 當日漲跌（±3% 飽和），hover 顯示名稱／產業／市值／漲跌，**點擊進個股**；5 分鐘輪詢；finviz 有重複 symbol，UI 端去重 |
| 板塊輪動 | `SectorRotation.tsx` | `equity/compare/groups?provider=finviz&group=sector&metric=performance` | 11 個 sector 的 1D／1W／1M 漲跌橫條 + 相對成交量；**資金流向的代理指標，卡片下方明示「非實際資金流入／流出資料」**（真正的 fund flow 是付費資料） |
| 今日焦點 | `Movers.tsx` | `equity/discovery/{gainers,losers,active}?provider=yfinance&limit=10` | 三欄，點擊進個股 |

**重要的基礎設施發現與修正**：finviz screener（約 10 秒）會**卡住整個 openbb-api**（OpenBB 的 finviz provider 在 async 端點裡做同步抓取，期間連 `/` 都要等 6 秒，所有分頁一起停擺）。解法：openbb-api 改成 **uvicorn 3 個 worker**——`openbb-api` 啟動器的 `--workers` 有 bug（字串傳給 uvicorn 會 TypeError），改直接起 `uvicorn openbb_platform_api.main:app --host 127.0.0.1 --port 6900 --workers 3`（差別只是不產生 Workspace 用的 widgets.json）。**ODP Desktop 的「OpenBB API」command 已改成這條**，`.claude/launch.json` 同步。實測：screener 10 秒期間，root 2ms、排行 1.1s、指數 1.6s。約多用 600 MB 記憶體。

- 驗收：首頁 4 秒內指數／板塊／排行載入、熱力圖約 10 秒；點 NVDA 進個股（盤中，頂欄綠色「即時」——同時驗證了 Phase 10B 的正規盤即時更新）；「← 市場總覽」返回；正式版 8001 已 build。
- 既有檔改動：`App.tsx`（view 狀態、lazy mount、服務探測改每 60 秒）、`TopBar.tsx`（首頁隱藏報價、返回鍵、輸入框跟隨 ticker）、`api.ts`／`i18n.ts`。

## Phase 16：板塊輪動泡泡圖（RRG 風格）

**狀態：已於 2026-09-21 完成**。使用者的構想「每個板塊是一顆球、隨資金流動變大並跑到某個象限」＝業界的 **相對輪動圖（Relative Rotation Graph, RRG）** 加上球體大小。決策：與橫條圖**並排**（市場總覽第三列，RRG 3fr｜橫條 2fr，熱力圖改全寬）；預設**日**視角，可切**週／季**；球體 = 成交金額 ÷ 20 日平均。

- **資料**：`equity/price/historical` 一次批次抓 **SPY + 11 檔 SPDR 板塊 ETF**（XLK/XLF/XLE/XLV/XLY/XLP/XLI/XLB/XLU/XLRE/XLC）三年日 K（9,180 列，1.5 秒，免金鑰），5 分鐘輪詢。板塊名稱對映到 finviz 的分類名，跟隔壁橫條卡一致（注意 SPDR 是 GICS 分類、finviz 是自家分類，名稱一致但成分略有差異）。
- **算法**（`ui/src/components/market/rrg.ts`，JdK 原版專有、這是公開近似版，作品集要註明）：`rs = ETF/SPY`（先做 `smooth` 日平滑）→ `RS-Ratio = 100 + 100·(rs/SMA_n(rs) − 1)` → `RS-Momentum = 100 + 100·(Ratio/SMA_m(Ratio) − 1)`。三個視角共用同一份日資料、只換參數：**日** n=20, m=10, 每日一點、尾巴 10 天、平滑 5；**週** n=50, m=10, 每 5 日一點、尾巴 8 週；**季** n=120, m=20, 每 21 日一點、尾巴 6 個月（兩季）。日視角原本尾巴抖到互相穿越，加 5 日平滑後才可讀。
- **球體大小**：**最後一個完整交易日**的成交金額 ÷ 前 20 日平均（半徑 ∝ √倍數，夾在 0.4–3×）。盤中時今天的量還沒累積完會讓球全部縮小，所以用 ET 時間判斷盤中則改用前一日。
- **繪圖**（`SectorRRG.tsx`，純 SVG）：四象限底色（右上領先綠／右下轉弱黃／左下落後紅／左上改善藍），座標範圍以「現在的點 + 最後 3 個尾巴點」對稱於 100 決定、更早的尾巴用 `clipPath` 裁掉；球內標 ETF 代碼（全名放 tooltip，避免左下角擁擠時標籤重疊）；hover 顯示板塊、象限、RS-Ratio／Momentum、量倍數、尾巴日期範圍，其他球淡出；切換視角時球用 CSS transform 過渡滑動。
- 卡片下方註明：「RRG 風格近似算法… 球體 = 活動熱度代理，非資金流」。
- 驗收：日視角 XLK 領先、XLE 轉弱、XLI 改善（與 finviz 當日板塊表現一致）；季視角 tooltip「Technology XLK · 領先 · 103.94／100.29 · 1.12×」；正式版 8001 已 build。

