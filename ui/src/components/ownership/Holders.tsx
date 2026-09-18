import { useEffect, useState } from 'react'
import { fetchHolders, type Holder } from '../../api'
import type { Strings } from '../../i18n'

const money = (v: number | null) => v == null ? '—' : v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${(v / 1e6).toFixed(0)}M`
const shares = (n: number) => n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : `${(n / 1e6).toFixed(1)}M`

export default function Holders({ ticker, s }: { ticker: string; s: Strings }) {
  const [rows, setRows] = useState<Holder[] | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => { setRows(null); setErr(false); fetchHolders(ticker).then(setRows).catch(() => setErr(true)) }, [ticker])

  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.holders} · {ticker}</h2>
        {rows?.[0] && <span className="num text-xs text-ink-3">{s.asOf} {rows[0].date_reported}</span>}
      </div>
      {err ? <p className="text-sm text-ink-3">{s.noData}</p> : !rows ? <p className="text-sm text-ink-3">…</p> : (
        <table className="w-full text-sm">
          <thead className="text-xs text-ink-3"><tr>
            <th className="text-left font-medium">{s.holder}</th><th className="text-right font-medium">{s.shares}</th>
            <th className="text-right font-medium">{s.value}</th><th className="text-right font-medium">{s.pctHeld}</th><th className="text-right font-medium">{s.qoq}</th>
          </tr></thead>
          <tbody>
            {rows.map(r => {
              const up = (r.pct_change ?? 0) >= 0
              return (
                <tr key={r.holder} className="border-t border-line/60">
                  <td className="py-1.5 text-ink">{r.holder}</td>
                  <td className="num py-1.5 text-right text-ink-2">{shares(r.shares)}</td>
                  <td className="num py-1.5 text-right text-ink-2">{money(r.value)}</td>
                  <td className="num py-1.5 text-right text-ink-2">{r.pct_held == null ? '—' : (r.pct_held * 100).toFixed(2) + '%'}</td>
                  <td className={`num py-1.5 text-right font-semibold ${r.pct_change == null ? 'text-ink-3' : up ? 'text-up' : 'text-down'}`}>
                    {r.pct_change == null ? '—' : `${up ? '▲' : '▼'} ${up ? '+' : ''}${(r.pct_change * 100).toFixed(2)}%`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-[11px] text-ink-3">{s.holdersSource}</p>
    </section>
  )
}
