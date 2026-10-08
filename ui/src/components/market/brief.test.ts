import { describe, expect, it } from 'vitest'
import type { BriefItem } from '../../api'
import { covered, dir, failures, tally, weekdaysBehind } from './brief'

const basket = (buy: number, sell: number, label = 'DOW 30 · 2014') => ({
  basket: label, trained_on: '2014..2025', as_of: '2026-10-07', close: 100,
  signals: [...Array(buy).fill({ action: 'BUY' }), ...Array(sell).fill({ action: 'SELL' })] as BriefItem['finrl'] extends null ? never : never,
})
const item = (o: Partial<BriefItem>): BriefItem => ({ ticker: 'X', finrl: null, fingpt: null, error: null, ...o })
const ok = (t: string) => item({ ticker: t, fingpt: { prediction: 'Up by 1-2%', analysis: 'a' }, finrl: { baskets: [basket(3, 2) as never] } })

describe('failures', () => {
  it('counts an engine that ran but returned nothing', () => {
    // the 2026-10-05..07 shape: FinGPT dead, FinRL fine
    const items = [ok('A'), item({ ticker: 'B', error: 'Expecting value: line 1 column 1', finrl: { baskets: [basket(1, 4) as never] } })]
    expect(failures(items)).toMatchObject({ total: 2, fingpt: 1, finrl: 0, first: 'Expecting value: line 1 column 1' })
  })

  it('does not count a ticker that simply has no basket', () => {
    const items = [ok('A'), item({ ticker: 'XOM', fingpt: { prediction: 'Down by 1-2%', analysis: 'a' }, finrl: { error: 'XOM is not in any FinRL model basket (dow30)', not_covered: true } })]
    expect(failures(items)).toMatchObject({ fingpt: 0, finrl: 0 })
  })

  it('still recognises an uncovered ticker in a brief written before the flag existed', () => {
    const old = item({ ticker: 'XOM', fingpt: { prediction: 'Up by 0-1%', analysis: 'a' }, finrl: { error: 'XOM is not in any FinRL model basket (dow30, tech30)' } })
    expect(covered(old)).toBe(true)
    expect(failures([old])).toMatchObject({ finrl: 0 })
  })

  it('counts a real FinRL failure', () => {
    const broken = item({ ticker: 'NVDA', fingpt: { prediction: 'Up by 1-2%', analysis: 'a' }, finrl: { error: '500 Server Error for url: .../finrl/signal/NVDA' } })
    expect(covered(broken)).toBe(false)
    expect(failures([broken])).toMatchObject({ fingpt: 0, finrl: 1 })
  })

  it('reports nothing when every engine delivered', () => {
    expect(failures([ok('A'), ok('B')])).toMatchObject({ fingpt: 0, finrl: 0, first: undefined })
  })
})

describe('tally / dir', () => {
  it('counts the first basket and lists every basket in the detail', () => {
    const it_ = item({ finrl: { baskets: [basket(3, 2) as never, basket(1, 4, 'Tech 30 · 2019') as never] } })
    expect(tally(it_)).toMatchObject({ buy: 3, sell: 2 })
    expect(tally(it_)!.detail).toBe('DOW 30 · 2014: 3B / 2S\nTech 30 · 2019: 1B / 4S')
  })
  it('returns null without baskets', () => expect(tally(item({}))).toBeNull())
  it('reads the direction out of the prediction text', () => {
    expect(dir('Up by 2-3%')).toBe('up')
    expect(dir('Down by 0-1%')).toBe('down')
    expect(dir(null)).toBe('flat')
  })
})

describe('weekdaysBehind', () => {
  it('is zero when the brief covers the expected session', () => {
    expect(weekdaysBehind('2026-10-07', '2026-10-07')).toBe(0)
  })

  it('counts weekdays only, skipping the weekend', () => {
    // Fri 10-09 -> Mon 10-12 is one trading day, not three
    expect(weekdaysBehind('2026-10-09', '2026-10-12')).toBe(1)
  })

  it('stays under the alarm threshold for a one-day market holiday', () => {
    // brief covers Wed, expected is Thu because last_complete_session cannot know Thu was a holiday
    expect(weekdaysBehind('2026-10-07', '2026-10-08')).toBe(1)
    expect(weekdaysBehind('2026-10-06', '2026-10-08')).toBe(2)
  })

  it('crosses the threshold for the real outage', () => {
    // the 2026-09-30 brief was still the newest on 2026-10-07
    expect(weekdaysBehind('2026-09-30', '2026-10-07')).toBe(5)
  })

  it('does not go negative if the brief is somehow ahead', () => {
    expect(weekdaysBehind('2026-10-08', '2026-10-07')).toBe(0)
  })
})
