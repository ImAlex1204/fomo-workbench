import { useEffect, useState } from 'react'
import { fetchProfile, type Profile } from '../../api'
import type { Strings } from '../../i18n'

const fmtCap = (v?: number, ccy = 'USD') => v == null ? '—' :
  `${ccy === 'USD' ? '$' : ccy + ' '}${v >= 1e12 ? (v / 1e12).toFixed(2) + 'T' : v >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : (v / 1e6).toFixed(0) + 'M'}`
// First two sentences; sentence ends are ". " at least 40 chars apart so "Apple Inc." doesn't count as one.
const firstSentences = (text?: string) => {
  if (!text) return '—'
  const first = text.indexOf('. ', 40), second = first > 0 ? text.indexOf('. ', first + 40) : -1
  return second > 0 ? text.slice(0, second + 1) : text
}

export default function CompanyProfile({ ticker, s }: { ticker: string; s: Strings }) {
  const [p, setP] = useState<Profile | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => { setP(null); setErr(false); fetchProfile(ticker).then(setP).catch(() => setErr(true)) }, [ticker])

  const facts: [string, string][] = p ? [
    [s.sector, p.sector ?? '—'], [s.industry, p.industry_category ?? '—'],
    [s.employees, p.employees ? p.employees.toLocaleString() : '—'],
    [s.hq, [p.hq_address_city, p.hq_state, p.hq_country].filter(Boolean).join(', ') || '—'],
    [s.exchange, p.stock_exchange ?? '—'], [s.marketCap, fmtCap(p.market_cap, p.currency)],
  ] : []

  return (
    <section className="panel p-5">
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.profile}</h2>
      {err ? <p className="text-sm text-ink-3">{s.noData}</p> : !p ? <p className="text-sm text-ink-3">…</p> : (
        <>
          <div className="text-2xl font-bold tracking-tight">{p.name ?? ticker} <span className="num ml-2 text-base font-medium text-ink-3">{ticker}</span></div>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-ink-2">{firstSentences(p.long_description)}</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
            {facts.map(([k, v]) => (
              <div key={k}><dt className="text-[11px] tracking-wide text-ink-3 uppercase">{k}</dt><dd className="num mt-0.5 text-sm text-ink">{v}</dd></div>
            ))}
          </dl>
        </>
      )}
    </section>
  )
}
