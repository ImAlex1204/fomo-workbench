import { useEffect, useState } from 'react'
import { fetchBrief, fetchWatchlist, runBrief, saveWatchlist, type BriefItem, type BriefStatus } from '../../api'
import type { Lang, Strings } from '../../i18n'

const dir = (p: string | null | undefined) => /down/i.test(p ?? '') ? 'down' : /up/i.test(p ?? '') ? 'up' : 'flat'
/** BUY/SELL counts of the first basket, plus a per-basket breakdown for the tooltip. */
const tally = (item: BriefItem) => {
  const baskets = item.finrl?.baskets
  if (!baskets?.length) return null
  const count = (b: typeof baskets[number]) => ({
    buy: b.signals.filter(x => x.action === 'BUY').length,
    sell: b.signals.filter(x => x.action === 'SELL').length,
  })
  const all = baskets.map(b => ({ label: b.basket, ...count(b) }))
  return { ...all[0], detail: all.map(a => `${a.label}: ${a.buy}B / ${a.sell}S`).join('\n') }
}

export default function DailyBrief({ lang, s, onSelect }: { lang: Lang; s: Strings; onSelect: (symbol: string) => void }) {
  const [st, setSt] = useState<BriefStatus | null>(null)
  const [watch, setWatch] = useState<string[]>([])
  const [add, setAdd] = useState('')

  useEffect(() => {
    let alive = true
    const load = () => { fetchBrief().then(b => { if (alive) setSt(b) }).catch(() => { if (alive) setSt({ running: false, progress: null, brief: null }) }) }
    load(); fetchWatchlist().then(setWatch).catch(() => {})
    const id = setInterval(load, 30_000)  // cheap; keeps the progress counter moving during a run
    return () => { alive = false; clearInterval(id) }
  }, [])

  const save = (next: string[]) => saveWatchlist(next).then(setWatch).catch(() => {})
  const run = () => runBrief().then(() => setSt(p => p && { ...p, running: true, progress: [0, watch.length] })).catch(() => {})

  const brief = st?.brief ?? null
  const summary = brief?.summary?.[lang] ?? brief?.summary?.en ?? null
  const items = new Map((brief?.items ?? []).map(i => [i.ticker, i]))

  return (
    <section className="panel p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.brief}{brief && <span className="ml-2 font-mono text-xs font-normal text-ink-3">{s.asOf} {brief.as_of}</span>}</h2>
        <div className="flex items-center gap-3 text-xs">
          {brief?.generated_at && <span className="text-ink-3">{s.briefGenerated} {brief.generated_at.slice(0, 16).replace('T', ' ')}</span>}
          {st?.running
            ? <span className="animate-pulse text-accent">{s.briefRunning}{st.progress ? ` ${st.progress[0]}/${st.progress[1]}` : ''}…</span>
            : <button className="text-accent hover:underline" onClick={run} disabled={!st}>{s.briefRun}</button>}
        </div>
      </div>
      {!st ? <p className="text-sm text-ink-3">…</p> : !brief && !st.running ? <p className="text-sm text-ink-3">{s.briefNone}</p> : null}
      {summary && <p className="mb-3 text-sm leading-relaxed text-ink">{summary.overview}</p>}
      <ul className="divide-y divide-line/60">
        {watch.map(t => {
          const it = items.get(t)
          const p = it?.fingpt?.prediction
          const d = dir(p)
          const tl = it ? tally(it) : null
          return (
            <li key={t} className="flex items-center gap-3 py-1.5 text-sm">
              <button onClick={() => onSelect(t)} className="num w-14 shrink-0 text-left font-semibold text-ink hover:text-accent">{t}</button>
              <span className={`num w-28 shrink-0 text-xs ${d === 'up' ? 'text-up' : d === 'down' ? 'text-down' : 'text-ink-3'}`} title={it?.fingpt?.analysis}>
                {it ? (p ?? (it.error ? '—' : '…')) : s.briefNext}
              </span>
              <span className="num w-20 shrink-0 text-xs text-ink-3" title={it?.finrl?.error ?? tl?.detail}>
                {tl ? <><span className="text-up">{tl.buy}B</span> / <span className="text-down">{tl.sell}S</span></> : it?.finrl?.error ? '—' : ''}
              </span>
              <span className="min-w-0 flex-1 truncate text-ink-2" title={summary?.tickers[t]}>{summary?.tickers[t] ?? ''}</span>
              <button onClick={() => save(watch.filter(x => x !== t))} className="shrink-0 px-1 text-ink-3 hover:text-down" title="remove">×</button>
            </li>
          )
        })}
      </ul>
      <form className="mt-2 flex gap-2" onSubmit={e => { e.preventDefault(); if (add.trim()) { save([...watch, add]); setAdd('') } }}>
        <input value={add} onChange={e => setAdd(e.target.value)} placeholder={s.ticker} className="w-28 rounded-md border border-line bg-bg px-2 py-1 font-mono text-xs uppercase outline-none focus:border-accent" />
        <button className="rounded-md border border-line px-2 py-1 text-xs text-ink-2 hover:text-ink">{s.briefAdd}</button>
      </form>
      <p className="mt-2 text-[11px] text-ink-3">{s.briefNote}</p>
    </section>
  )
}
