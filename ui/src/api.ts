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

export async function fetchHistory(ticker: string): Promise<Bar[]> {
  const start = new Date(Date.now() - 365 * 86400e3).toISOString().slice(0, 10)
  const d = await json<{ results: Bar[] }>(`${OPENBB}/api/v1/equity/price/historical?symbol=${ticker}&provider=yfinance&start_date=${start}`)
  return d.results
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
