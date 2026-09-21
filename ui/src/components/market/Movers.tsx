import { useEffect, useState } from 'react'
import { fetchMovers, type Mover } from '../../api'
import type { Strings } from '../../i18n'

const vol = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1e3).toFixed(0)}K`

function List({ title, rows, onSelect }: { title: string; rows: Mover[] | null; onSelect: (s: string) => void }) {
  return (
    <div className="panel p-4">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">{title}</h3>
      {!rows ? <p className="text-sm text-ink-3">…</p> : (
        <ul className="divide-y divide-line/60">
          {rows.map(m => (
            <li key={m.symbol}>
              <button onClick={() => onSelect(m.symbol)} className="flex w-full items-center gap-2 py-1.5 text-left text-sm hover:bg-panel-2/60">
                <span className="num w-14 shrink-0 font-semibold text-ink">{m.symbol}</span>
                <span className="min-w-0 flex-1 truncate text-ink-2">{m.name}</span>
                <span className="num shrink-0 text-ink-2">{m.price.toFixed(2)}</span>
                <span className={`num w-16 shrink-0 text-right ${m.percent_change >= 0 ? 'text-up' : 'text-down'}`}>{m.percent_change >= 0 ? '+' : ''}{m.percent_change.toFixed(2)}%</span>
                <span className="num w-14 shrink-0 text-right text-ink-3">{vol(m.volume)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Movers({ s, onSelect }: { s: Strings; onSelect: (symbol: string) => void }) {
  const [g, setG] = useState<Mover[] | null>(null), [l, setL] = useState<Mover[] | null>(null), [a, setA] = useState<Mover[] | null>(null)
  useEffect(() => {
    const load = () => { fetchMovers('gainers').then(setG).catch(() => setG([])); fetchMovers('losers').then(setL).catch(() => setL([])); fetchMovers('active').then(setA).catch(() => setA([])) }
    load(); const id = setInterval(load, 120_000); return () => clearInterval(id)
  }, [])
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.movers}</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <List title={s.gainers} rows={g} onSelect={onSelect} /><List title={s.losers} rows={l} onSelect={onSelect} /><List title={s.active} rows={a} onSelect={onSelect} />
      </div>
    </section>
  )
}
