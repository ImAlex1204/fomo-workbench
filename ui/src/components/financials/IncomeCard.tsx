import type { Statement } from '../../api'
import type { Strings } from '../../i18n'
import BarChart from './BarChart'

const fy = (s: Statement) => 'FY' + s.period_ending.slice(0, 4)
const col = (rows: Statement[], key: string) => rows.map(r => (r[key] as number | null) ?? null)

export default function IncomeCard({ rows, s }: { rows: Statement[] | null; s: Strings }) {
  const series = rows ? [
    { label: s.revenue, color: '#4f8cff', values: col(rows, 'total_revenue') },
    { label: s.grossProfit, color: '#26a69a', values: col(rows, 'gross_profit') },
    { label: s.operatingIncome, color: '#f5b166', values: col(rows, 'operating_income') },
    { label: s.netIncome, color: '#c084fc', values: col(rows, 'net_income') },
  ] : []
  return (
    <section className="panel flex h-[340px] flex-col p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.income}</h2>
        <div className="flex gap-3 text-xs text-ink-3">{series.map(x => <span key={x.label}><span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: x.color }} />{x.label}</span>)}</div>
      </div>
      {!rows ? <p className="text-sm text-ink-3">…</p> : rows.length === 0 ? <p className="text-sm text-ink-3">{s.noData}</p> : <div className="min-h-0 flex-1"><BarChart categories={rows.map(fy)} series={series} /></div>}
    </section>
  )
}
