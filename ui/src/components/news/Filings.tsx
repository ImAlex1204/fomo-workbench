import { useEffect, useState } from 'react'
import { fetchFilings, type Filing } from '../../api'
import type { Strings } from '../../i18n'

// Official SEC Form 8-K item titles (shown on hover; these are SEC's names, not our interpretation).
const ITEMS: Record<string, string> = {
  '1.01': 'Entry into a Material Definitive Agreement', '1.02': 'Termination of a Material Definitive Agreement',
  '2.01': 'Completion of Acquisition or Disposition of Assets', '2.02': 'Results of Operations and Financial Condition',
  '2.03': 'Creation of a Direct Financial Obligation', '2.05': 'Costs Associated with Exit or Disposal Activities',
  '3.02': 'Unregistered Sales of Equity Securities', '4.01': 'Changes in Registrant’s Certifying Accountant',
  '5.02': 'Departure/Election of Directors or Officers; Compensatory Arrangements', '5.03': 'Amendments to Articles of Incorporation or Bylaws',
  '5.07': 'Submission of Matters to a Vote of Security Holders', '7.01': 'Regulation FD Disclosure',
  '8.01': 'Other Events', '9.01': 'Financial Statements and Exhibits',
}

export default function Filings({ ticker, s }: { ticker: string; s: Strings }) {
  const [rows, setRows] = useState<Filing[] | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => { setRows(null); setErr(false); fetchFilings(ticker).then(setRows).catch(() => setErr(true)) }, [ticker])

  return (
    <section className="panel p-4">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.filings} · {ticker}</h2>
      {err ? <p className="text-sm text-ink-3">{s.noData}</p> : !rows ? <p className="text-sm text-ink-3">…</p> : rows.length === 0 ? <p className="text-sm text-ink-3">{s.noData}</p> : (
        <ul className="divide-y divide-line/60">
          {rows.map(f => {
            const items = (f.items ?? '').split(',').map(i => i.trim()).filter(Boolean)
            return (
              <li key={f.report_url ?? f.filing_date + f.items}>
                <a href={f.report_url ?? f.filing_detail_url} target="_blank" rel="noopener noreferrer" className="flex gap-3 py-2 text-sm hover:bg-panel-2/60">
                  <span className="num shrink-0 text-ink-3">{f.filing_date}</span>
                  <span className="num shrink-0 font-semibold text-ink">{f.primary_doc_description ?? '8-K'}</span>
                  {items.length > 0 && (
                    <span className="min-w-0 flex-1 text-ink-2">{s.items} {items.map((code, i) => (
                      <span key={code} title={ITEMS[code] ?? code} className="cursor-help underline decoration-dotted underline-offset-2">{code}{i < items.length - 1 ? ', ' : ''}</span>
                    ))}</span>
                  )}
                </a>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-ink-3">{s.filingsSource}</p>
    </section>
  )
}
