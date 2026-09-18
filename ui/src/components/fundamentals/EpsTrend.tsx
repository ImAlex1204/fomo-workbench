import { useEffect, useRef, useState } from 'react'
import { LineSeries, LineStyle, createChart } from 'lightweight-charts'
import { fetchEpsTrend, type EpsTrend as EpsTrendData } from '../../api'
import type { Strings } from '../../i18n'

const ACCENT = '#4f8cff', EST = '#9aa3b5'
const plusDays = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * 86400e3).toISOString().slice(0, 10)

export default function EpsTrend({ ticker, s }: { ticker: string; s: Strings }) {
  const box = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<EpsTrendData | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => { setData(null); setErr(false); fetchEpsTrend(ticker).then(setData).catch(() => setErr(true)) }, [ticker])

  useEffect(() => {
    if (!box.current || !data || data.actual.length === 0) return
    const c = createChart(box.current, {
      layout: { background: { color: 'transparent' }, textColor: '#9aa3b5', fontFamily: 'JetBrains Mono, monospace', attributionLogo: false },
      grid: { vertLines: { color: '#1a2030' }, horzLines: { color: '#1a2030' } },
      rightPriceScale: { borderColor: '#232a38' }, timeScale: { borderColor: '#232a38', rightOffset: 2 },
      crosshair: { vertLine: { color: ACCENT, labelBackgroundColor: ACCENT }, horzLine: { color: ACCENT, labelBackgroundColor: ACCENT } },
      autoSize: true,
    })
    const actual = c.addSeries(LineSeries, { color: ACCENT, lineWidth: 2, pointMarkersVisible: true, pointMarkersRadius: 4, lastValueVisible: false, priceLineVisible: false, title: s.actual, priceFormat: { type: 'price', precision: 2, minMove: 0.01 } })
    actual.setData(data.actual.map(a => ({ time: a.date, value: a.eps })))
    // Estimate line starts at the last actual point so the two segments join; +1q has no date from yfinance -> previous + 91 days.
    let prev = data.actual[data.actual.length - 1].date
    const est = data.estimates.map(e => { const date = e.date ?? plusDays(prev, 91); prev = date; return { time: date, value: e.eps } })
    if (est.length) {
      const estimate = c.addSeries(LineSeries, { color: EST, lineWidth: 2, lineStyle: LineStyle.Dashed, pointMarkersVisible: true, pointMarkersRadius: 4, lastValueVisible: false, priceLineVisible: false, title: s.estimate, priceFormat: { type: 'price', precision: 2, minMove: 0.01 } })
      estimate.setData([{ time: data.actual[data.actual.length - 1].date, value: data.actual[data.actual.length - 1].eps }, ...est])
    }
    c.timeScale().fitContent()
    // The tab may be hidden (display:none) at mount, so re-fit whenever the container gets a real size.
    const ro = new ResizeObserver(() => c.timeScale().fitContent())
    ro.observe(box.current)
    return () => { ro.disconnect(); c.remove() }
  }, [data, s])

  return (
    <section className="panel flex h-[340px] flex-col p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.epsTrend} · {ticker}</h2>
        <div className="flex gap-4 text-xs text-ink-3">
          <span><span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: ACCENT }} />{s.actual}</span>
          <span><span className="mr-1 inline-block h-0.5 w-4 border-t-2 border-dashed align-middle" style={{ borderColor: EST }} />{s.estimate}{data?.estimates[0] ? ` · ${data.estimates[0].analysts} ${s.analysts}` : ''}</span>
        </div>
      </div>
      {err ? <p className="text-sm text-ink-3">{s.noData}</p> : <div ref={box} className="min-h-0 flex-1" />}
    </section>
  )
}
