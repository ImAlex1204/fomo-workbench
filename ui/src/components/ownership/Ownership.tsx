import type { Bar } from '../../api'
import type { Strings } from '../../i18n'
import Holders from './Holders'
import Insiders from './Insiders'
import ShortsDarkPool from './ShortsDarkPool'

// Ownership tab: three distinct signals kept as three cards (institutions / insiders / market-wide shorts & dark pool).
export default function Ownership({ ticker, bars, s }: { ticker: string; bars: Bar[]; s: Strings }) {
  return (
    <div className="flex flex-col gap-4">
      <Holders ticker={ticker} s={s} />
      <Insiders ticker={ticker} s={s} />
      <ShortsDarkPool ticker={ticker} bars={bars} s={s} />
    </div>
  )
}
