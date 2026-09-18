import { useEffect, useState } from 'react'
import { fetchEpsTtm, type Metrics } from '../../api'
import type { Strings } from '../../i18n'

const f = (v: number | null | undefined, suffix = '', digits = 2) => v == null ? '—' : v.toFixed(digits) + suffix

export default function KeyMetrics({ ticker, m, s }: { ticker: string; m: Metrics | null; s: Strings }) {
  const [eps, setEps] = useState<number | null | undefined>(undefined)
  useEffect(() => {
    setEps(undefined)
    fetchEpsTtm(ticker).then(setEps).catch(() => setEps(null))
  }, [ticker])

  const tiles: [string, string][] = [
    [s.pe, f(m?.pe_ratio, '', 1)],
    [s.divYield, f(m?.dividend_yield, '%')],  // openbb-api yfinance already returns a percent
    [s.beta, f(m?.beta)],
    [s.epsTtm, eps === undefined ? '…' : f(eps, '', 2)],
  ]
  return (
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map(([k, v]) => (
        <div key={k} className="panel p-4">
          <div className="text-[11px] tracking-wide text-ink-3 uppercase">{k}</div>
          <div className="num mt-1 text-2xl font-semibold text-ink">{m || k === s.epsTtm ? v : '…'}</div>
        </div>
      ))}
      <p className="col-span-full -mt-2 text-[11px] text-ink-3">{s.metrics} · openbb-api / yfinance</p>
    </section>
  )
}
