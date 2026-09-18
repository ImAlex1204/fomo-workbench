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

export async function fetchProfile(ticker: string): Promise<Profile> {
  return (await json<{ results: Profile[] }>(`${OPENBB}/api/v1/equity/profile?symbol=${ticker}&provider=yfinance`)).results[0]
}
export async function fetchMetrics(ticker: string): Promise<Metrics> {
  return (await json<{ results: Metrics[] }>(`${OPENBB}/api/v1/equity/fundamental/metrics?symbol=${ticker}&provider=yfinance`)).results[0]
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
