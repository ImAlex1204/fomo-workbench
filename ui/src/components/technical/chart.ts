import { createChart, type DeepPartial, type ChartOptions, type IChartApi } from 'lightweight-charts'

export const UP = '#26a69a', DOWN = '#ef5350', ACCENT = '#4f8cff', SMA20 = '#f5b166', SMA60 = '#c084fc', MUTED = '#9aa3b5'

/** Dark-theme chart with a ResizeObserver re-fit (charts here mount inside a hidden tab). Returns a disposer. */
export function mountChart(el: HTMLDivElement, extra: DeepPartial<ChartOptions> = {}): [IChartApi, () => void] {
  const c = createChart(el, {
    layout: { background: { color: 'transparent' }, textColor: MUTED, fontFamily: 'JetBrains Mono, monospace', attributionLogo: false, panes: { separatorColor: '#232a38', enableResize: false } },
    grid: { vertLines: { color: '#1a2030' }, horzLines: { color: '#1a2030' } },
    rightPriceScale: { borderColor: '#232a38' }, timeScale: { borderColor: '#232a38', rightOffset: 3 },
    crosshair: { vertLine: { color: ACCENT, labelBackgroundColor: ACCENT }, horzLine: { color: ACCENT, labelBackgroundColor: ACCENT } },
    autoSize: true, ...extra,
  })
  const ro = new ResizeObserver(() => c.timeScale().fitContent())
  ro.observe(el)
  return [c, () => { ro.disconnect(); c.remove() }]
}
