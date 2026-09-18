import type { Statement } from '../../api'
import type { Strings } from '../../i18n'
import BarChart from './BarChart'

const fy = (s: Statement) => 'FY' + s.period_ending.slice(0, 4)
const col = (rows: Statement[], key: string) => rows.map(r => (r[key] as number | null) ?? null)
// Free cash flow = operating cash flow - capex. yfinance reports capital_expenditure as a negative outflow, hence "+".
const fcf = (rows: Statement[]) => rows.map(r => { const o = r.operating_cash_flow as number | null, x = r.capital_expenditure as number | null; return o != null && x != null ? o + x : null })

export default function CashFlowCard({ rows, s }: { rows: Statement[] | null; s: Strings }) {
  const series = rows ? [
    { label: s.cfo, color: '#26a69a', values: col(rows, 'operating_cash_flow') },
    { label: s.cfi, color: '#4f8cff', values: col(rows, 'investing_cash_flow') },
    { label: s.cff, color: '#ef5350', values: col(rows, 'financing_cash_flow') },
  ] : []
  const line = rows ? { label: s.fcf, color: '#f5b166', values: fcf(rows) } : undefined
  return (
    <section className="panel flex h-[340px] flex-col p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.cashflow}</h2>
        <div className="flex gap-3 text-xs text-ink-3">
          {series.map(x => <span key={x.label}><span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: x.color }} />{x.label}</span>)}
          {line && <span><span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: line.color }} />{line.label}</span>}
        </div>
      </div>
      {!rows ? <p className="text-sm text-ink-3">…</p> : rows.length === 0 ? <p className="text-sm text-ink-3">{s.noData}</p> : <div className="min-h-0 flex-1"><BarChart categories={rows.map(fy)} series={series} line={line} /></div>}
    </section>
  )
}
