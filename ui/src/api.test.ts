import { describe, expect, it } from 'vitest'
import { applyTick, type Bar, type Tick } from './api'

const bar = (date: string, close = 100): Bar => ({ date, open: close, high: close + 1, low: close - 1, close, volume: 1000 })
// 2026-09-21 is EDT (UTC-4): 10:30:30 ET == 14:30:30Z
const etMs = (h: number, m: number, s = 0) => String(Date.UTC(2026, 8, 21, h + 4, m, s))
const tick = (price: number, time: string): Tick => ({ price, time, market_hours: 1 })

describe('applyTick', () => {
  it('returns the same empty array when there are no bars', () => {
    const bars: Bar[] = []
    expect(applyTick(bars, false, tick(1, etMs(10, 30)))).toBe(bars)
  })

  it('daily: folds the tick into the last bar without mutating the input', () => {
    const bars = [bar('2026-09-18'), bar('2026-09-21', 100)]
    const out = applyTick(bars, false, tick(102.5, etMs(10, 30)))
    expect(out).toHaveLength(2)
    expect(out[1]).toMatchObject({ date: '2026-09-21', close: 102.5, high: 102.5, low: 99 })
    expect(out[0]).toBe(bars[0])            // earlier bars are shared, not copied
    expect(bars[1].close).toBe(100)         // input untouched
  })

  it('daily: a lower tick moves low and close only', () => {
    const out = applyTick([bar('2026-09-21', 100)], false, tick(98, etMs(10, 30)))
    expect(out[0]).toMatchObject({ close: 98, low: 98, high: 101 })
  })

  it('intraday: same minute updates the last bar', () => {
    const out = applyTick([bar('2026-09-21T10:30:00', 100)], true, tick(100.4, etMs(10, 30, 45)))
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ date: '2026-09-21T10:30:00', close: 100.4 })
  })

  it('intraday: a new minute appends a zero-volume bar stamped in ET', () => {
    const out = applyTick([bar('2026-09-21T10:30:00', 100)], true, tick(100.7, etMs(10, 31, 5)))
    expect(out).toHaveLength(2)
    expect(out[1]).toEqual({ date: '2026-09-21T10:31:00', open: 100.7, high: 100.7, low: 100.7, close: 100.7, volume: 0 })
    expect(out[0].close).toBe(100)          // previous bar is left as it was
  })

  it('intraday: a late tick for an earlier minute is ignored', () => {
    const bars = [bar('2026-09-21T10:30:00', 100)]
    expect(applyTick(bars, true, tick(50, etMs(10, 29, 59)))).toBe(bars)
  })
})
