import type { Strings } from '../../i18n'
import Filings from './Filings'
import NewsList from './NewsList'

// News tab: raw facts only (titles, dates, links) — interpretation lives in the AI tab.
export default function News({ ticker, s }: { ticker: string; s: Strings }) {
  return (
    <div className="flex flex-col gap-4">
      <NewsList ticker={ticker} s={s} />
      <Filings ticker={ticker} s={s} />
    </div>
  )
}
