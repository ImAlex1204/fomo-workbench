import { useEffect, useState } from 'react'
import { fetchOtc, fetchShareStats, type Bar, type OtcWeek, type ShareStats } from '../../api'
import type { Strings } from '../../i18n'

/** Latest FINRA ATS week ÷ consolidated volume of that week (Mon–Fri) from the shared daily bars. */
function darkPoolShare(otc: OtcWeek[], bars: Bar[]): { pct: number; week: string } | null {
  for (const w of otc) {  // otc is newest first; skip weeks our bars don't cover
    // update_date is FINRA's publication date (openbb drops weekStartDate); T1 ATS data is published
    // two weeks after the reporting week ends, i.e. on the Monday three weeks after it starts
    // (or the next business day after a holiday), so the reporting week is the Monday-week 21 days back.
    const pub = new Date(w.update_date + 'T00:00:00Z')
    const start = new Date(pub.getTime() - 21 * 86400e3)
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7))  // back to Monday
    const end = new Date(start.getTime() + 6 * 86400e3)
    const vol = bars.filter(b => { const d = new Date(b.date); return d >= start && d <= end }).reduce((sum, b) => sum + b.volume, 0)
    if (vol > 0) return { pct: (w.share_quantity / vol) * 100, week: start.toISOString().slice(0, 10) }
  }
  return null
}

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
