import type { BriefItem } from '../../api'

export const dir = (p: string | null | undefined) => /down/i.test(p ?? '') ? 'down' : /up/i.test(p ?? '') ? 'up' : 'flat'
/** BUY/SELL counts of the first basket, plus a per-basket breakdown for the tooltip. */
export const tally = (item: BriefItem) => {
  const baskets = item.finrl?.baskets
  if (!baskets?.length) return null
  const count = (b: typeof baskets[number]) => ({
    buy: b.signals.filter(x => x.action === 'BUY').length,
    sell: b.signals.filter(x => x.action === 'SELL').length,
  })
  const all = baskets.map(b => ({ label: b.basket, ...count(b) }))
  return { ...all[0], detail: all.map(a => `${a.label}: ${a.buy}B / ${a.sell}S`).join('\n') }
}

const MS_DAY = 86400e3

/** Weekdays strictly after `asOf` up to and including `expected`.
 *
 *  Market holidays are not in the calendar either side, so a brief can sit one or two weekdays
 *  behind without anything being wrong; only a bigger gap means the services were not running.
 *  Dates are 'YYYY-MM-DD' and are read as UTC so the viewer's timezone cannot shift the count. */
export function weekdaysBehind(asOf: string, expected: string): number {
  let n = 0
  for (let t = Date.parse(`${asOf}T00:00:00Z`) + MS_DAY; t <= Date.parse(`${expected}T00:00:00Z`); t += MS_DAY) {
    const day = new Date(t).getUTCDay()
    if (day !== 0 && day !== 6) n++
  }
  return n
}

/** A ticker that simply has no FinRL basket. Briefs written before the flag existed only carry
 *  the backend's 404 detail, so fall back to that rather than raising a false alarm on them. */
export const covered = (i: BriefItem) => !!i.finrl?.not_covered || /no FinRL model basket|not in any FinRL/i.test(i.finrl?.error ?? '')

/** Engines that ran but produced nothing. A ticker outside every FinRL basket is expected, not a
 *  failure — without this split, FinGPT can go dead for days (it did, 2026-10-05..07) and the card
 *  just shows blanks. */
export const failures = (items: BriefItem[]) => ({
  total: items.length,
  fingpt: items.filter(i => !i.fingpt?.prediction).length,
  finrl: items.filter(i => !i.finrl?.baskets?.length && !covered(i)).length,
  first: items.find(i => i.error)?.error ?? items.find(i => i.finrl?.error && !covered(i))?.finrl?.error,
})
