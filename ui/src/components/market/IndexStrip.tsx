import { useEffect, useState } from 'react'
import { fetchIndices, type IndexQuote } from '../../api'

function Spark({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return <svg className="h-8 w-full" />
  const min = Math.min(...values), max = Math.max(...values), W = 100, H = 32
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - ((v - min) / (max - min || 1)) * (H - 4) - 2}`).join(' ')
  return <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-8 w-full"><polyline fill="none" stroke={up ? '#26a69a' : '#ef5350'} strokeWidth={1.5} points={pts} /></svg>
}

export default function IndexStrip() {
  const [q, setQ] = useState<IndexQuote[] | null>(null)
  useEffect(() => {
    const load = () => fetchIndices().then(setQ).catch(() => {})
    load(); const id = setInterval(load, 60_000); return () => clearInterval(id)
  }, [])
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {(q ?? []).map(i => {
        const pct = i.prevClose ? ((i.last - i.prevClose) / i.prevClose) * 100 : 0, up = pct >= 0
        const isYield = i.symbol === '^TNX'
        return (
          <div key={i.symbol} className="panel p-3">
            <div className="flex items-baseline justify-between"><span className="text-xs text-ink-2">{i.name}</span><span className={`num text-xs ${up ? 'text-up' : 'text-down'}`}>{up ? '+' : ''}{pct.toFixed(2)}%</span></div>
            <div className={`num mt-0.5 text-lg font-semibold ${up ? 'text-up' : 'text-down'}`}>{isYield ? `${i.last.toFixed(3)}%` : i.last.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            <Spark values={i.spark} up={up} />
          </div>
        )
      })}
      {!q && <p className="col-span-full text-sm text-ink-3">…</p>}
    </section>
  )
}
