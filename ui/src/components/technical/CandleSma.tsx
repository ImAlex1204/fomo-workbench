import { useEffect, useRef } from 'react'
import { CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts'
import type { Bar, Technical } from '../../api'
import type { Strings } from '../../i18n'
import { DOWN, SMA20, SMA60, UP, mountChart } from './chart'

export default function CandleSma({ bars, tech, s }: { bars: Bar[]; tech: Technical | null; s: Strings }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!box.current || bars.length === 0) return
    const [c, dispose] = mountChart(box.current)
    const candles = c.addSeries(CandlestickSeries, { upColor: UP, downColor: DOWN, wickUpColor: UP, wickDownColor: DOWN, borderVisible: false })
    candles.setData(bars.map(b => ({ time: b.date, open: b.open, high: b.high, low: b.low, close: b.close })))
    if (tech) {
      c.addSeries(LineSeries, { color: SMA20, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }).setData(tech.sma20)
      c.addSeries(LineSeries, { color: SMA60, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }).setData(tech.sma60)
    }
    // volume in its own pane below, sharing the time axis
    const vol = c.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false }, 1)
    vol.setData(bars.map(b => ({ time: b.date, value: b.volume, color: b.close >= b.open ? 'rgba(38,166,154,.5)' : 'rgba(239,83,80,.5)' })))
    c.panes()[0].setStretchFactor(3); c.panes()[1].setStretchFactor(1)
    c.timeScale().fitContent()
    return dispose
  }, [bars, tech])

  return (
    <section className="panel flex h-[460px] flex-col p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.candles}</h2>
        <div className="flex gap-4 text-xs text-ink-3">
          <span><span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: SMA20 }} />SMA 20</span>
          <span><span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: SMA60 }} />SMA 60</span>
        </div>
      </div>
      <div ref={box} className="min-h-0 flex-1" />
    </section>
  )
}
