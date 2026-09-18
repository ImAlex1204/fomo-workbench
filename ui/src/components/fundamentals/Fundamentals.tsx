import type { Strings } from '../../i18n'
import CompanyProfile from './CompanyProfile'
import EpsTrend from './EpsTrend'
import KeyMetrics from './KeyMetrics'

// Fundamentals tab: one card per file; add a card = add a file + one line here.
export default function Fundamentals({ ticker, s }: { ticker: string; s: Strings }) {
  return (
    <div className="flex flex-col gap-4">
      <CompanyProfile ticker={ticker} s={s} />
      <KeyMetrics ticker={ticker} s={s} />
      <EpsTrend ticker={ticker} s={s} />
    </div>
  )
}
