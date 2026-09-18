import { useEffect, useRef } from 'react'
import { CandlestickSeries, HistogramSeries, createChart, type IChartApi, type ISeriesApi, type Time } from 'lightweight-charts'
import type { Bar } from '../api'

const UP = '#26a69a', DOWN = '#ef5350'

// Daily+ bars carry 'YYYY-MM-DD'; intraday bars carry 'YYYY-MM-DDTHH:MM:SS' in US/Eastern wall-clock time.
// Lightweight Charts renders unix timestamps as UTC, so treating the ET wall-clock as UTC shows market time on the axis.
const toTime = (date: string): Time => (date.length > 10 ? (Date.parse(date + 'Z') / 1000) as Time : date)

export default function PriceChart({ bars, intraday, resetKey }: { bars: Bar[]; intraday: boolean; resetKey: string }) {
  const box = useRef<HTMLDivElement>(null)
  const chart = useRef<IChartApi | null>(null)
  const candles = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volume = useRef<ISeriesApi<'Histogram'> | null>(null)
  const fitted = useRef('')

  useEffect(() => {  // chart is created once; data updates below never reset the user's zoom
    if (!box.current) return
    const c = createChart(box.current, {
      layout: { background: { color: 'transparent' }, textColor: '#9aa3b5', fontFamily: 'JetBrains Mono, monospace', attributionLogo: false },
      grid: { vertLines: { color: '#1a2030' }, horzLines: { color: '#1a2030' } },
      rightPriceScale: { borderColor: '#232a38' },
      timeScale: { borderColor: '#232a38', rightOffset: 4 },
      crosshair: { vertLine: { color: '#4f8cff', labelBackgroundColor: '#4f8cff' }, horzLine: { color: '#4f8cff', labelBackgroundColor: '#4f8cff' } },
      autoSize: true,
    })
    candles.current = c.addSeries(CandlestickSeries, { upColor: UP, downColor: DOWN, wickUpColor: UP, wickDownColor: DOWN, borderVisible: false })
    volume.current = c.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol' })
    c.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
    const ro = new ResizeObserver(() => c.timeScale().fitContent())  // re-fit if mounted while the tab was hidden
    ro.observe(box.current)
    chart.current = c
    return () => { ro.disconnect(); c.remove(); chart.current = null; fitted.current = '' }
  }, [])

  useEffect(() => {
    if (!chart.current || !candles.current || !volume.current) return
    chart.current.timeScale().applyOptions({ timeVisible: intraday, secondsVisible: false })
    candles.current.setData(bars.map(b => ({ time: toTime(b.date), open: b.open, high: b.high, low: b.low, close: b.close })))
    volume.current.setData(bars.map(b => ({ time: toTime(b.date), value: b.volume, color: b.close >= b.open ? 'rgba(38,166,154,.35)' : 'rgba(239,83,80,.35)' })))
    if (bars.length && fitted.current !== resetKey) {  // first data for a new ticker/range: fit; later poll refreshes keep the user's view
      chart.current.timeScale().fitContent()
      fitted.current = resetKey
    }
  }, [bars, intraday, resetKey])

  return <div ref={box} className="h-full w-full" />
}
