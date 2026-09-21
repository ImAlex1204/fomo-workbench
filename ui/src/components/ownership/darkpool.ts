import type { Bar, OtcWeek } from '../../api'

/** Latest FINRA ATS week ÷ consolidated volume of that week (Mon–Fri) from the shared daily bars. */
export function darkPoolShare(otc: OtcWeek[], bars: Bar[]): { pct: number; week: string } | null {
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
