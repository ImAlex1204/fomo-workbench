import { useEffect, useRef } from 'react'
import { CandlestickSeries, HistogramSeries, createChart, type IChartApi } from 'lightweight-charts'
import type { Bar } from '../api'

const UP = '#26a69a', DOWN = '#ef5350'

export default function PriceChart({ bars }: { bars: Bar[] }) {
  const box = useRef<HTMLDivElement>(null)
  const chart = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!box.current) return
    const c = createChart(box.current, {
      layout: { background: { color: 'transparent' }, textColor: '#9aa3b5', fontFamily: 'JetBrains Mono, monospace', attributionLogo: false },
      grid: { vertLines: { color: '#1a2030' }, horzLines: { color: '#1a2030' } },
      rightPriceScale: { borderColor: '#232a38' },
      timeScale: { borderColor: '#232a38', rightOffset: 4 },
      crosshair: { vertLine: { color: '#4f8cff', labelBackgroundColor: '#4f8cff' }, horzLine: { color: '#4f8cff', labelBackgroundColor: '#4f8cff' } },
      autoSize: true,
    })
    const candles = c.addSeries(CandlestickSeries, { upColor: UP, downColor: DOWN, wickUpColor: UP, wickDownColor: DOWN, borderVisible: false })
    const volume = c.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol' })
    c.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
    candles.setData(bars.map(b => ({ time: b.date, open: b.open, high: b.high, low: b.low, close: b.close })))
    volume.setData(bars.map(b => ({ time: b.date, value: b.volume, color: b.close >= b.open ? 'rgba(38,166,154,.35)' : 'rgba(239,83,80,.35)' })))
    c.timeScale().fitContent()
    const ro = new ResizeObserver(() => c.timeScale().fitContent())  // re-fit if mounted while the tab was hidden
    ro.observe(box.current)
    chart.current = c
    return () => { ro.disconnect(); c.remove(); chart.current = null }
  }, [bars])

  return <div ref={box} className="h-full w-full" />
}
