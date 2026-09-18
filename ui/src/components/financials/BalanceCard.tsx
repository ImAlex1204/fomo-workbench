import { useEffect, useRef } from 'react'
import { LineSeries } from 'lightweight-charts'
import type { Statement } from '../../api'
import type { Strings } from '../../i18n'
import { mountChart } from '../technical/chart'

const COLORS = { assets: '#4f8cff', liabilities: '#ef5350', equity: '#26a69a' }

export default function BalanceCard({ rows, s }: { rows: Statement[] | null; s: Strings }) {
  const box = useRef<HTMLDivElement>(null)
  const latest = rows?.[rows.length - 1]
  const ca = latest?.total_current_assets as number | null | undefined, cl = latest?.current_liabilities as number | null | undefined
  const currentRatio = ca != null && cl ? ca / cl : null  // banks report no current split -> shown as —

  useEffect(() => {
    if (!box.current || !rows || rows.length === 0) return
    const [c, dispose] = mountChart(box.current, { rightPriceScale: { scaleMargins: { top: 0.1, bottom: 0.1 } } })
    const fmt = { type: 'custom' as const, formatter: (v: number) => `$${(v / 1e9).toFixed(0)}B`, minMove: 1 }
    const add = (key: string, color: string) => c.addSeries(LineSeries, { color, lineWidth: 2, pointMarkersVisible: true, pointMarkersRadius: 4, priceLineVisible: false, lastValueVisible: false, priceFormat: fmt })
      .setData(rows.filter(r => r[key] != null).map(r => ({ time: r.period_ending, value: r[key] as number })))
    add('total_assets', COLORS.assets); add('total_liabilities_net_minority_interest', COLORS.liabilities); add('total_equity_non_controlling_interests', COLORS.equity)
    c.timeScale().fitContent()
    return dispose
  }, [rows])

  return (
    <section className="panel flex h-[340px] flex-col p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.balance}</h2>
        <div className="flex items-baseline gap-4">
          <div className="flex gap-3 text-xs text-ink-3">
            <span><span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: COLORS.assets }} />{s.totalAssets}</span>
            <span><span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: COLORS.liabilities }} />{s.totalLiabilities}</span>
            <span><span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: COLORS.equity }} />{s.equity}</span>
          </div>
          <div className="flex items-baseline gap-2"><span className="text-[11px] tracking-wide text-ink-3 uppercase">{s.currentRatio}</span><span className="num text-xl font-semibold text-ink">{currentRatio == null ? '—' : currentRatio.toFixed(2)}</span></div>
        </div>
      </div>
      {!rows ? <p className="text-sm text-ink-3">…</p> : rows.length === 0 ? <p className="text-sm text-ink-3">{s.noData}</p> : <div ref={box} className="min-h-0 flex-1" />}
    </section>
  )
}
