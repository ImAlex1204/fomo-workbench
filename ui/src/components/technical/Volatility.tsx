import { useEffect, useRef } from 'react'
import { LineSeries, LineStyle } from 'lightweight-charts'
import type { Bar, Technical } from '../../api'
import type { Strings } from '../../i18n'
import { ACCENT, MUTED, SMA20, mountChart } from './chart'

export default function Volatility({ bars, tech, beta, s }: { bars: Bar[]; tech: Technical | null; beta: number | undefined; s: Strings }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!box.current || !tech || bars.length === 0) return
    const [c, dispose] = mountChart(box.current)
    const band = { lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false }
    c.addSeries(LineSeries, { ...band, color: MUTED, lineStyle: LineStyle.Dashed }).setData(tech.bbU)
    c.addSeries(LineSeries, { ...band, color: SMA20 }).setData(tech.bbM)
    c.addSeries(LineSeries, { ...band, color: MUTED, lineStyle: LineStyle.Dashed }).setData(tech.bbL)
    c.addSeries(LineSeries, { color: ACCENT, lineWidth: 2, priceLineVisible: false }).setData(bars.map(b => ({ time: b.date, value: b.close })))
    c.timeScale().fitContent()
    return dispose
  }, [bars, tech])

  return (
    <section className="panel flex h-[360px] flex-col p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.bbands}</h2>
        <div className="flex items-baseline gap-2"><span className="text-[11px] tracking-wide text-ink-3 uppercase">{s.beta}</span><span className="num text-xl font-semibold text-ink">{beta == null ? '—' : beta.toFixed(2)}</span></div>
      </div>
      {tech ? <div ref={box} className="min-h-0 flex-1" /> : <p className="text-sm text-ink-3">…</p>}
    </section>
  )
}
