import { useEffect, useRef } from 'react'
import { HistogramSeries, LineSeries, LineStyle } from 'lightweight-charts'
import type { Technical } from '../../api'
import type { Strings } from '../../i18n'
import { ACCENT, DOWN, MUTED, SMA20, UP, mountChart } from './chart'

const lineOpts = { lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false }

function Kd({ tech }: { tech: Technical }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!box.current) return
    const [c, dispose] = mountChart(box.current, { rightPriceScale: { scaleMargins: { top: 0.05, bottom: 0.05 } } })
    const fixed = { autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) }  // KD lives in 0-100
    const k = c.addSeries(LineSeries, { ...lineOpts, ...fixed, color: ACCENT }); k.setData(tech.k)
    c.addSeries(LineSeries, { ...lineOpts, ...fixed, color: SMA20 }).setData(tech.d)
    for (const price of [70, 30]) k.createPriceLine({ price, color: MUTED, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true })
    c.timeScale().fitContent()
    return dispose
  }, [tech])
  return <div ref={box} className="min-h-0 flex-1" />
}

function Macd({ tech }: { tech: Technical }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!box.current) return
    const [c, dispose] = mountChart(box.current)
    c.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }).setData(tech.hist.map(h => ({ ...h, color: h.value >= 0 ? 'rgba(38,166,154,.6)' : 'rgba(239,83,80,.6)' })))
    c.addSeries(LineSeries, { ...lineOpts, color: ACCENT }).setData(tech.macd)
    c.addSeries(LineSeries, { ...lineOpts, color: SMA20 }).setData(tech.signal)
    c.timeScale().fitContent()
    return dispose
  }, [tech])
  return <div ref={box} className="min-h-0 flex-1" />
}

export default function Momentum({ tech, s }: { tech: Technical | null; s: Strings }) {
  const legend = (items: [string, string][]) => (
    <div className="flex gap-3 text-xs text-ink-3">{items.map(([label, color]) => <span key={label}><span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: color }} />{label}</span>)}</div>
  )
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="panel flex h-[300px] flex-col p-4">
        <div className="mb-2 flex items-baseline justify-between"><h2 className="text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.kd}</h2>{legend([['K', ACCENT], ['D', SMA20]])}</div>
        {tech ? <Kd tech={tech} /> : <p className="text-sm text-ink-3">…</p>}
      </div>
      <div className="panel flex h-[300px] flex-col p-4">
        <div className="mb-2 flex items-baseline justify-between"><h2 className="text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.macd}</h2>{legend([['DIF', ACCENT], ['Signal', SMA20], ['Hist', UP + '/' + DOWN]])}</div>
        {tech ? <Macd tech={tech} /> : <p className="text-sm text-ink-3">…</p>}
      </div>
    </section>
  )
}
