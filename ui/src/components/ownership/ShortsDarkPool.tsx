import { useEffect, useState } from 'react'
import { fetchOtc, fetchShareStats, type Bar, type OtcWeek, type ShareStats } from '../../api'
import { darkPoolShare } from './darkpool'
import type { Strings } from '../../i18n'

export default function ShortsDarkPool({ ticker, bars, s }: { ticker: string; bars: Bar[]; s: Strings }) {
  const [stats, setStats] = useState<ShareStats | null>(null)
  const [otc, setOtc] = useState<OtcWeek[] | null>(null)
  useEffect(() => {
    setStats(null); setOtc(null)
    fetchShareStats(ticker).then(setStats).catch(() => setStats({}))
    fetchOtc(ticker).then(setOtc).catch(() => setOtc([]))
  }, [ticker])
  const dp = otc && bars.length ? darkPoolShare(otc, bars) : null

  const tiles: [string, string, string][] = [
    [s.shortPct, stats ? (stats.short_percent_of_float != null ? `${(stats.short_percent_of_float * 100).toFixed(2)}%` : '—') : '…', stats?.date ? `${s.shortNote} ${stats.date}` : ''],
    [s.daysToCover, stats ? (stats.days_to_cover != null ? stats.days_to_cover.toFixed(2) : '—') : '…', stats?.date ? `${s.shortNote} ${stats.date}` : ''],
    [s.darkPool, otc === null ? '…' : dp ? `${dp.pct.toFixed(1)}%` : '—', dp ? `${s.darkPoolNote} ${dp.week}` : ''],
  ]
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.shortsDark} · {ticker}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {tiles.map(([k, v, note]) => (
          <div key={k} className="panel p-4">
            <div className="text-[11px] tracking-wide text-ink-3 uppercase">{k}</div>
            <div className="num mt-1 text-2xl font-semibold text-ink">{v}</div>
            <div className="num mt-1 text-[11px] text-ink-3">{note}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
