import { useEffect, useState } from 'react'
import type { Bar, Quote, Tick } from '../api'
import type { Lang, Strings } from '../i18n'

export default function TopBar({ ticker, quote, bars, tick, lang, s, online, view, onTicker, onHome, onLang }:
  { ticker: string; quote: Quote | null; bars: Bar[]; tick: Tick | null; lang: Lang; s: Strings; online: number; view: 'market' | 'stock'; onTicker: (t: string) => void; onHome: () => void; onLang: (l: Lang) => void }) {
  const [draft, setDraft] = useState(ticker)
  useEffect(() => setDraft(ticker), [ticker])  // ticker can also change from the heatmap / movers
  // Price/change come from the daily bars: the yfinance quote endpoint returns last_price/prev_close only intermittently.
  // With a live tick, use its price and Yahoo's change vs. previous regular close (covers pre/post-market too).
  const last = tick?.price ?? bars.at(-1)?.close, prev = bars.at(-2)?.close
  const pct = tick?.change_percent ?? (last !== undefined && prev ? ((last - prev) / prev) * 100 : null)
  const up = (pct ?? 0) >= 0
  const session = tick?.market_hours === 1 ? s.live : tick?.market_hours === 0 ? s.pre : tick?.market_hours === 2 || tick?.market_hours === 3 ? s.post : null
  return (
    <header className="flex flex-wrap items-center gap-4 px-5 py-3">
      <button onClick={onHome} className="text-base font-bold tracking-tight hover:text-accent" title={s.backToMarket}>{s.title}</button>
      {view === 'stock' && <button onClick={onHome} className="text-xs text-ink-3 hover:text-ink-2">← {s.backToMarket}</button>}
      <form onSubmit={e => { e.preventDefault(); onTicker(draft.trim().toUpperCase()) }}>
        <input value={draft} onChange={e => setDraft(e.target.value)} aria-label={s.ticker}
          className="num w-28 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm uppercase outline-none focus:border-accent" />
      </form>
      {view === 'stock' && last !== undefined && (
        <div className="flex items-baseline gap-3">
          {quote?.name && <span className="text-sm text-ink-2">{quote.name}</span>}
          <span className={`num text-xl font-semibold ${up ? 'text-up glow-up' : 'text-down glow-down'}`}>{last.toFixed(2)}</span>
          {pct !== null && <span className={`num text-sm ${up ? 'text-up' : 'text-down'}`}>{up ? '+' : ''}{pct.toFixed(2)}%</span>}
          {session && <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${tick?.market_hours === 1 ? 'bg-up/20 text-up' : 'bg-panel-2 text-ink-3'}`}><span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${tick?.market_hours === 1 ? 'animate-pulse bg-up' : 'bg-ink-3'}`} />{session}</span>}
        </div>
      )}
      <div className="ml-auto flex items-center gap-4 text-xs text-ink-3">
        <span><span className={`mr-1 inline-block h-2 w-2 rounded-full ${online === 3 ? 'bg-up' : 'bg-down'}`} />{online}/3 {s.services} {s.online}</span>
        <button className="rounded-md border border-line px-2 py-1 hover:border-accent" onClick={() => onLang(lang === 'en' ? 'zh' : 'en')}>{lang === 'en' ? '繁中' : 'EN'}</button>
      </div>
    </header>
  )
}
