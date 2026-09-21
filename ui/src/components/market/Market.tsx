import type { Lang, Strings } from '../../i18n'
import DailyBrief from './DailyBrief'
import Heatmap from './Heatmap'
import IndexStrip from './IndexStrip'
import Movers from './Movers'
import SectorRotation from './SectorRotation'
import SectorRRG from './SectorRRG'

// Market overview (landing view): indices, S&P 500 heatmap, sector rotation, movers. No ticker needed.
export default function Market({ lang, s, onSelect }: { lang: Lang; s: Strings; onSelect: (symbol: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <IndexStrip />
      <DailyBrief lang={lang} s={s} onSelect={onSelect} />
      <Heatmap s={s} onSelect={onSelect} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
        <SectorRRG s={s} />
        <SectorRotation s={s} />
      </div>
      <Movers s={s} onSelect={onSelect} />
    </div>
  )
}
