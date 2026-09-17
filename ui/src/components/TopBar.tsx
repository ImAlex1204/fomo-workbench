import { useState } from 'react'
import type { Bar, Quote } from '../api'
import type { Lang, Strings } from '../i18n'

export default function TopBar({ ticker, quote, bars, lang, s, online, onTicker, onLang }:
  { ticker: string; quote: Quote | null; bars: Bar[]; lang: Lang; s: Strings; online: number; onTicker: (t: string) => void; onLang: (l: Lang) => void }) {
  const [draft, setDraft] = useState(ticker)
  // Price/change come from the daily bars: the yfinance quote endpoint returns last_price/prev_close only intermittently.
  const last = bars.at(-1)?.close, prev = bars.at(-2)?.close
  const pct = last !== undefined && prev ? ((last - prev) / prev) * 100 : null
  const up = (pct ?? 0) >= 0
  return (
    <header className="flex flex-wrap items-center gap-4 px-5 py-3">
      <span className="text-base font-bold tracking-tight">{s.title}</span>
      <form onSubmit={e => { e.preventDefault(); onTicker(draft.trim().toUpperCase()) }}>
        <input value={draft} onChange={e => setDraft(e.target.value)} aria-label={s.ticker}
          className="num w-28 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm uppercase outline-none focus:border-accent" />
      </form>
      {last !== undefined && (
        <div className="flex items-baseline gap-3">
          {quote?.name && <span className="text-sm text-ink-2">{quote.name}</span>}
          <span className={`num text-xl font-semibold ${up ? 'text-up glow-up' : 'text-down glow-down'}`}>{last.toFixed(2)}</span>
          {pct !== null && <span className={`num text-sm ${up ? 'text-up' : 'text-down'}`}>{up ? '+' : ''}{pct.toFixed(2)}%</span>}
        </div>
      )}
      <div className="ml-auto flex items-center gap-4 text-xs text-ink-3">
        <span><span className={`mr-1 inline-block h-2 w-2 rounded-full ${online === 3 ? 'bg-up' : 'bg-down'}`} />{online}/3 {s.services} {s.online}</span>
        <button className="rounded-md border border-line px-2 py-1 hover:border-accent" onClick={() => onLang(lang === 'en' ? 'zh' : 'en')}>{lang === 'en' ? '繁中' : 'EN'}</button>
      </div>
    </header>
  )
}
