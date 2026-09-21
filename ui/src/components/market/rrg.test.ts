import { describe, expect, it } from 'vitest'
import type { EtfBar } from '../../api'
import { HORIZONS, computeRrg } from './rrg'

// N consecutive weekdays in 2025 (well before today, so the "partial session" branch is never taken)
function dates(n: number): string[] {
  const out: string[] = []
  for (let d = new Date(Date.UTC(2025, 0, 6)); out.length < n; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10))
  }
  return out
}
function series(symbol: string, ds: string[], close: (i: number) => number): EtfBar[] {
  return ds.map((date, i) => ({ symbol, date, close: close(i), volume: 1_000_000 }))
}
const ETFS = [{ symbol: 'FLAT', name: 'Flat' }, { symbol: 'UP', name: 'Up' }, { symbol: 'DOWN', name: 'Down' }]
const ds = dates(120)
const bars = [
  ...series('SPY', ds, () => 100),
  ...series('FLAT', ds, () => 50),
  ...series('UP', ds, i => 50 * 1.01 ** i),     // steadily outperforming SPY
  ...series('DOWN', ds, i => 50 * 0.99 ** i),   // steadily underperforming
]

describe('computeRrg', () => {
  it('places a sector that tracks the benchmark at (100, 100) with a flat tail', () => {
    const flat = computeRrg(bars, ETFS, 'D').find(s => s.symbol === 'FLAT')!
    expect(flat.now.x).toBeCloseTo(100, 9)
    expect(flat.now.y).toBeCloseTo(100, 9)
    expect(flat.volRatio).toBeCloseTo(1, 9)
    for (const p of flat.tail) { expect(p.x).toBeCloseTo(100, 9); expect(p.y).toBeCloseTo(100, 9) }
  })

  it('puts outperformers right of 100 and underperformers left of it', () => {
    const by = Object.fromEntries(computeRrg(bars, ETFS, 'D').map(s => [s.symbol, s]))
    expect(by.UP.now.x).toBeGreaterThan(100)
    expect(by.DOWN.now.x).toBeLessThan(100)
  })

  it('samples the tail at the horizon step, oldest first, ending on the last bar', () => {
    for (const h of ['D', 'W', 'Q'] as const) {
      const { tail, step } = HORIZONS[h]
      const up = computeRrg(bars, ETFS, h).find(s => s.symbol === 'UP')
      if (!up) continue  // Q needs more history than 120 rows; covered by the next test
      expect(up.tail).toHaveLength(tail)
      expect(up.tail[tail - 1].date).toBe(ds[ds.length - 1])
      expect(up.now).toBe(up.tail[tail - 1])
      for (let k = 1; k < tail; k++) expect(ds.indexOf(up.tail[k].date) - ds.indexOf(up.tail[k - 1].date)).toBe(step)
    }
  })

  it('drops a sector without enough history, and one with no benchmark overlap', () => {
    const { n, m, step, tail } = HORIZONS.Q
    expect(ds.length).toBeLessThan(n + m + step * tail)
    expect(computeRrg(bars, ETFS, 'Q')).toEqual([])
    expect(computeRrg(bars.filter(b => b.symbol !== 'SPY'), ETFS, 'D')).toEqual([])
  })
})
