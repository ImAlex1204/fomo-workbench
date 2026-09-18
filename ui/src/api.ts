// Backends: openbb-api (data), openbb-backend (FinRL), agent (FinGPT chat). All local.
export const OPENBB = 'http://127.0.0.1:6900'
export const BACKEND = 'http://127.0.0.1:8001'
export const AGENT = 'http://127.0.0.1:8010'

export type Bar = { date: string; open: number; high: number; low: number; close: number; volume: number }
export type Quote = { name?: string }  // other yfinance quote fields are unreliable; price comes from bars
export type Signal = { ticker: string; as_of: string; close: number; agent: string; action: 'BUY' | 'SELL' | 'HOLD'; shares: number; position: number }
export type ChatEvent =
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; preview: string }
  | { type: 'text'; text: string }
  | { type: 'error'; text: string }

async function json<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return r.json()
}

// Chart ranges -> yfinance interval + lookback. Intraday ranges are polled while the market is open.
export type Range = '1D' | '1W' | '1M' | '3M' | '1Y' | '5Y' | 'MAX'
export const RANGES: Record<Range, { interval: string; days: number; intraday?: boolean }> = {
  '1D': { interval: '1m', days: 6, intraday: true },   // yfinance keeps ~7 days of 1m; we show the last session
  '1W': { interval: '5m', days: 8, intraday: true },
  '1M': { interval: '1d', days: 31 },
  '3M': { interval: '1d', days: 93 },
  '1Y': { interval: '1d', days: 366 },
  '5Y': { interval: '1W', days: 5 * 366 },
  'MAX': { interval: '1M', days: 60 * 366 },
}

export async function fetchHistory(ticker: string, range: Range = '1Y'): Promise<Bar[]> {
  const { interval, days } = RANGES[range]
  const start = new Date(Date.now() - days * 86400e3).toISOString().slice(0, 10)
  const d = await json<{ results: Bar[] }>(`${OPENBB}/api/v1/equity/price/historical?symbol=${ticker}&provider=yfinance&start_date=${start}&interval=${interval}`)
  const bars = d.results
  if (range === '1D' && bars.length) {  // last trading session only
    const day = bars[bars.length - 1].date.slice(0, 10)
    return bars.filter(b => b.date.startsWith(day))
  }
  return bars
}

export async function fetchQuote(ticker: string): Promise<Quote> {
  const d = await json<{ results: Quote[] }>(`${OPENBB}/api/v1/equity/price/quote?symbol=${ticker}&provider=yfinance`)
  return d.results[0]
}

export async function fetchSignals(ticker: string): Promise<Signal[]> {
  return json<Signal[]>(`${BACKEND}/finrl/signal/${ticker}`)
}

export async function* chat(message: string): AsyncGenerator<ChatEvent> {
  const r = await fetch(`${AGENT}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) })
  if (!r.ok || !r.body) throw new Error(`${r.status}`)
  const reader = r.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 2)
      if (line.startsWith('data: ')) yield JSON.parse(line.slice(6))
    }
  }
}

// ---- Fundamentals tab (Phase 9) ----
export type Profile = { name?: string; sector?: string; industry_category?: string; long_description?: string; employees?: number;
  hq_address_city?: string; hq_state?: string; hq_country?: string; stock_exchange?: string; market_cap?: number; currency?: string }
export type Metrics = { pe_ratio?: number; dividend_yield?: number; beta?: number }  // dividend_yield is already a percent
export type EpsTrend = { ticker: string; actual: { date: string; eps: number; estimate: number | null }[];
  estimates: { period: string; date: string | null; eps: number; low: number; high: number; analysts: number }[] }

// yfinance's info-based endpoints (profile, metrics, quote) sometimes come back partial when the page fires
// several requests at once; if a key field is missing, wait briefly and try once more.
async function firstResult<T>(url: string, complete: (r: T) => boolean): Promise<T> {
  let r = (await json<{ results: T[] }>(url)).results[0]
  if (!complete(r)) { await new Promise(res => setTimeout(res, 1500)); r = (await json<{ results: T[] }>(url)).results[0] }
  return r
}
export function fetchProfile(ticker: string): Promise<Profile> {
  return firstResult<Profile>(`${OPENBB}/api/v1/equity/profile?symbol=${ticker}&provider=yfinance`, p => p?.sector != null)
}
export function fetchMetrics(ticker: string): Promise<Metrics> {
  return firstResult<Metrics>(`${OPENBB}/api/v1/equity/fundamental/metrics?symbol=${ticker}&provider=yfinance`, m => m?.pe_ratio != null || m?.beta != null)
}
/** Trailing-twelve-month EPS = sum of the last four quarterly diluted EPS (yfinance metrics has no EPS field). */
export async function fetchEpsTtm(ticker: string): Promise<number | null> {
  const d = await json<{ results: { period_ending: string; diluted_earnings_per_share?: number | null }[] }>(
    `${OPENBB}/api/v1/equity/fundamental/income?symbol=${ticker}&provider=yfinance&period=quarter`)
  const q = d.results.filter(r => r.diluted_earnings_per_share != null).sort((a, b) => b.period_ending.localeCompare(a.period_ending)).slice(0, 4)
  return q.length === 4 ? q.reduce((s, r) => s + (r.diluted_earnings_per_share as number), 0) : null
}
export async function fetchEpsTrend(ticker: string): Promise<EpsTrend> {
  return json<EpsTrend>(`${BACKEND}/fundamentals/eps_trend/${ticker}`)
}

// ---- Technical tab (Phase 11): indicators computed by openbb-api's technical router from bars we already hold ----
export type Technical = {
  sma20: { time: string; value: number }[]; sma60: { time: string; value: number }[]
  k: { time: string; value: number }[]; d: { time: string; value: number }[]
  macd: { time: string; value: number }[]; signal: { time: string; value: number }[]; hist: { time: string; value: number }[]
  bbU: { time: string; value: number }[]; bbM: { time: string; value: number }[]; bbL: { time: string; value: number }[]
}
type Row = Record<string, number | string | null>
async function technical(path: string, bars: Bar[], query = ''): Promise<Row[]> {
  const r = await fetch(`${OPENBB}/api/v1/technical/${path}?${query}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bars) })
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return (await r.json()).results
}
const col = (rows: Row[], key: string) => rows.filter(r => r[key] != null).map(r => ({ time: String(r.date).slice(0, 10), value: r[key] as number }))

export async function fetchTechnical(bars: Bar[]): Promise<Technical> {
  const [s20, s60, st, mc, bb] = await Promise.all([
    technical('sma', bars, 'length=20'), technical('sma', bars, 'length=60'),
    technical('stoch', bars), technical('macd', bars), technical('bbands', bars, 'length=20&std=2'),
  ])
  return {
    sma20: col(s20, 'close_SMA_20'), sma60: col(s60, 'close_SMA_60'),
    k: col(st, 'STOCHk_14_3_3'), d: col(st, 'STOCHd_14_3_3'),
    macd: col(mc, 'close_MACD_12_26_9'), signal: col(mc, 'close_MACDs_12_26_9'), hist: col(mc, 'close_MACDh_12_26_9'),
    bbU: col(bb, 'close_BBU_20_2.0'), bbM: col(bb, 'close_BBM_20_2.0'), bbL: col(bb, 'close_BBL_20_2.0'),
  }
}

// ---- News tab (Phase 12): raw facts only. NewsItem deliberately omits summary/text (copyright rule: title + link only). ----
export type NewsItem = { date: string; title: string; url: string; source?: string }
export type Filing = { filing_date: string; report_date?: string; primary_doc_description?: string; items?: string; report_url?: string; filing_detail_url?: string }

export async function fetchNews(ticker: string): Promise<NewsItem[]> {
  const d = await json<{ results: NewsItem[] }>(`${OPENBB}/api/v1/news/company?symbol=${ticker}&provider=yfinance&limit=10`)
  return d.results.map(({ date, title, url, source }) => ({ date, title, url, source })).sort((a, b) => b.date.localeCompare(a.date))
}
export async function fetchFilings(ticker: string): Promise<Filing[]> {
  return (await json<{ results: Filing[] }>(`${OPENBB}/api/v1/equity/fundamental/filings?symbol=${ticker}&provider=sec&form_type=8-K&limit=10`)).results
}

// ---- Ownership tab (Phase 13) ----
export type Holder = { holder: string; shares: number; value: number | null; pct_held: number | null; pct_change: number | null; date_reported: string }
export type InsiderTx = { transaction_date?: string; filing_date: string; owner_name?: string; owner_title?: string; acquisition_or_disposition?: string;
  transaction_type?: string; securities_transacted?: number; transaction_price?: number; filing_url?: string }
export type ShareStats = { date?: string; short_interest?: number; short_percent_of_float?: number; days_to_cover?: number; institution_ownership?: number; insider_ownership?: number }
export type OtcWeek = { update_date: string; share_quantity: number; trade_quantity: number }

export async function fetchHolders(ticker: string): Promise<Holder[]> {
  return json<Holder[]>(`${BACKEND}/ownership/institutional/${ticker}`)
}
export async function fetchInsiders(ticker: string): Promise<InsiderTx[]> {
  // the sec provider returns whole filings regardless of `limit`, so cap client-side
  return (await json<{ results: InsiderTx[] }>(`${OPENBB}/api/v1/equity/ownership/insider_trading?symbol=${ticker}&provider=sec&limit=10`)).results.slice(0, 10)
}
export function fetchShareStats(ticker: string): Promise<ShareStats> {
  return firstResult<ShareStats>(`${OPENBB}/api/v1/equity/ownership/share_statistics?symbol=${ticker}&provider=yfinance`, r => r?.days_to_cover != null)
}
export async function fetchOtc(ticker: string): Promise<OtcWeek[]> {
  return (await json<{ results: OtcWeek[] }>(`${OPENBB}/api/v1/equity/darkpool/otc?symbol=${ticker}&provider=finra`)).results
}

// ---- Financials tab (Phase 14): 5 fiscal years, yfinance ----
export type Statement = Record<string, number | string | null> & { period_ending: string }
export const STATEMENT_KEYS = {
  income: ['total_revenue', 'gross_profit', 'operating_income', 'net_income'],
  balance: ['total_assets', 'total_liabilities_net_minority_interest', 'total_equity_non_controlling_interests', 'total_current_assets', 'current_liabilities'],
  cash: ['operating_cash_flow', 'investing_cash_flow', 'financing_cash_flow', 'capital_expenditure'],
} as const
export async function fetchStatement(kind: keyof typeof STATEMENT_KEYS, ticker: string): Promise<Statement[]> {
  const d = await json<{ results: Statement[] }>(`${OPENBB}/api/v1/equity/fundamental/${kind}?symbol=${ticker}&provider=yfinance&period=annual&limit=5`)
  // yfinance pads to 5 rows but the oldest year usually lacks the headline items; keep years that have at least one of the fields we chart
  return d.results.filter(r => STATEMENT_KEYS[kind].some(k => typeof r[k] === 'number'))
    .sort((a, b) => a.period_ending.localeCompare(b.period_ending))  // oldest -> newest
}
