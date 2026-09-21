import { useEffect, useState } from 'react'
import { fetchSectors, type SectorPerf } from '../../api'
import type { Strings } from '../../i18n'

type Horizon = 'd1' | 'w1' | 'm1'

export default function SectorRotation({ s }: { s: Strings }) {
  const [rows, setRows] = useState<SectorPerf[] | null>(null)
  const [err, setErr] = useState(false)
  const [h, setH] = useState<Horizon>('d1')
  useEffect(() => {
    const load = () => fetchSectors().then(r => { setRows(r); setErr(false) }).catch(() => setErr(true))
    load(); const id = setInterval(load, 120_000); return () => clearInterval(id)
  }, [])
  const sorted = rows ? [...rows].sort((a, b) => (b[h] ?? 0) - (a[h] ?? 0)) : []
  const max = Math.max(0.01, ...sorted.map(r => Math.abs(r[h] ?? 0)))

  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.sectors}</h2>
        <div className="flex gap-0.5 rounded-md border border-line p-0.5">
          {(['d1', 'w1', 'm1'] as Horizon[]).map(k => <button key={k} onClick={() => setH(k)} className={`num rounded px-2 py-0.5 text-[11px] ${h === k ? 'bg-panel-2 text-ink' : 'text-ink-3 hover:text-ink-2'}`}>{k === 'd1' ? '1D' : k === 'w1' ? '1W' : '1M'}</button>)}
        </div>
      </div>
      {err ? <p className="text-sm text-ink-3">{s.noData}</p> : !rows ? <p className="text-sm text-ink-3">…</p> : (
        <ul className="space-y-1.5">
          {sorted.map(r => {
            const v = r[h] ?? 0, up = v >= 0, w = (Math.abs(v) / max) * 50
            return (
              <li key={r.name} className="flex items-center gap-2 text-xs">
                <span className="w-36 shrink-0 truncate text-ink-2">{r.name}</span>
                <div className="relative h-3 flex-1">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
                  <div className={`absolute inset-y-0 rounded-sm ${up ? 'bg-up/70' : 'bg-down/70'}`} style={up ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }} />
                </div>
                <span className={`num w-14 shrink-0 text-right ${up ? 'text-up' : 'text-down'}`}>{up ? '+' : ''}{v.toFixed(2)}%</span>
                <span className="num w-16 shrink-0 text-right text-ink-3" title={s.relVol}>{r.relVolume != null ? `${r.relVolume.toFixed(2)}×` : '—'}</span>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-ink-3">{s.sectorsNote}</p>
    </section>
  )
}
