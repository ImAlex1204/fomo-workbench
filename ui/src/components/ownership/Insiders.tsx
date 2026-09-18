import { useEffect, useState } from 'react'
import { fetchInsiders, type InsiderTx } from '../../api'
import type { Strings } from '../../i18n'

// Short label for SEC's transaction_type text; the full SEC wording stays in the tooltip.
function label(tx: InsiderTx, s: Strings) {
  const t = (tx.transaction_type ?? '').toLowerCase()
  if (t.startsWith('open market')) return tx.acquisition_or_disposition === 'Acquisition' ? s.txPurchase : s.txSale
  if (t.startsWith('exercise or conversion')) return s.txVest
  if (t.startsWith('payment of exercise price or tax')) return s.txTax
  return s.txOther
}

export default function Insiders({ ticker, s }: { ticker: string; s: Strings }) {
  const [rows, setRows] = useState<InsiderTx[] | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => { setRows(null); setErr(false); fetchInsiders(ticker).then(setRows).catch(() => setErr(true)) }, [ticker])

  return (
    <section className="panel p-4">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.insiders} · {ticker}</h2>
      {err ? <p className="text-sm text-ink-3">{s.noData}</p> : !rows ? <p className="text-sm text-ink-3">…</p> : rows.length === 0 ? <p className="text-sm text-ink-3">{s.noData}</p> : (
        <ul className="divide-y divide-line/60">
          {rows.map((tx, i) => {
            const acq = tx.acquisition_or_disposition === 'Acquisition'
            return (
              <li key={i}>
                <a href={tx.filing_url} target="_blank" rel="noopener noreferrer" title={tx.transaction_type} className="flex flex-wrap gap-x-3 gap-y-0.5 py-2 text-sm hover:bg-panel-2/60">
                  <span className="num shrink-0 text-ink-3">{tx.transaction_date ?? tx.filing_date}</span>
                  <span className="min-w-0 text-ink">{tx.owner_name}{tx.owner_title ? <span className="text-ink-3"> · {tx.owner_title}</span> : null}</span>
                  <span className={`num shrink-0 font-semibold ${acq ? 'text-up' : 'text-down'}`}>{acq ? s.acquisition : s.disposition}</span>
                  <span className="shrink-0 text-ink-2">{label(tx, s)}</span>
                  <span className="num shrink-0 text-ink-2">{tx.securities_transacted != null ? tx.securities_transacted.toLocaleString() : '—'}{tx.transaction_price ? ` @ $${tx.transaction_price.toFixed(2)}` : ''}</span>
                </a>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-ink-3">{s.insidersSource}</p>
    </section>
  )
}
