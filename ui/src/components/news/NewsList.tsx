import { useEffect, useState } from 'react'
import { fetchNews, type NewsItem } from '../../api'
import type { Strings } from '../../i18n'

// Browser-local time, e.g. 09/18 23:57 (source dates are UTC).
const fmt = (iso: string) => { const d = new Date(iso); return `${d.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}` }

export default function NewsList({ ticker, s }: { ticker: string; s: Strings }) {
  const [items, setItems] = useState<NewsItem[] | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => { setItems(null); setErr(false); fetchNews(ticker).then(setItems).catch(() => setErr(true)) }, [ticker])

  return (
    <section className="panel p-4">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.news} · {ticker}</h2>
      {err ? <p className="text-sm text-ink-3">{s.noData}</p> : !items ? <p className="text-sm text-ink-3">…</p> : (
        <ul className="divide-y divide-line/60">
          {items.map(n => (
            <li key={n.url}>
              <a href={n.url} target="_blank" rel="noopener noreferrer" className="flex gap-3 py-2 text-sm hover:bg-panel-2/60">
                <span className="num shrink-0 text-ink-3">{fmt(n.date)}</span>
                <span className="min-w-0 flex-1 text-ink">{n.title}</span>
                <span className="shrink-0 text-ink-3">{n.source ?? ''}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-ink-3">{s.newsSource}</p>
    </section>
  )
}
