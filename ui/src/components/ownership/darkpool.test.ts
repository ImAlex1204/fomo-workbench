import { describe, expect, it } from 'vitest'
import type { Bar, OtcWeek } from '../../api'
import { darkPoolShare } from './darkpool'

// one bar per weekday from 2026-08-03 to 2026-09-21, volume = 1 so a full week sums to 5
const bars: Bar[] = []
for (let d = new Date(Date.UTC(2026, 7, 3)); d <= new Date(Date.UTC(2026, 8, 21)); d.setUTCDate(d.getUTCDate() + 1)) {
  if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) bars.push({ date: d.toISOString().slice(0, 10), open: 1, high: 1, low: 1, close: 1, volume: 1 })
}
const week = (update_date: string, share_quantity: number): OtcWeek => ({ update_date, share_quantity, trade_quantity: 0 })

describe('darkPoolShare', () => {
  it('maps FINRA publication dates to the reporting week observed for AAPL', () => {
    // (publication date -> weekStartDate) pairs taken from FINRA's own API on 2026-09-21
    for (const [pub, start] of [['2026-09-21', '2026-08-31'], ['2026-09-14', '2026-08-24'], ['2026-09-08', '2026-08-17'], ['2026-08-31', '2026-08-10']]) {
      expect(darkPoolShare([week(pub, 1)], bars)?.week).toBe(start)
    }
  })

  it('divides by that week\'s volume only, not the publication week', () => {
    // publication week (Sep 21) has a single bar in `bars`; the reporting week (Aug 31) has five
    expect(darkPoolShare([week('2026-09-21', 1)], bars)?.pct).toBeCloseTo(20, 9)
  })

  it('uses the newest week the bars cover, and returns null when none is covered', () => {
    const otc = [week('2026-10-19', 1), week('2026-09-21', 2)]  // first one's reporting week (Sep 28) is after our bars
    expect(darkPoolShare(otc, bars)).toEqual({ pct: 40, week: '2026-08-31' })
    expect(darkPoolShare([week('2026-10-19', 1)], bars)).toBeNull()
    expect(darkPoolShare([], bars)).toBeNull()
  })
})
