import type { Strings } from '../../i18n'
import Heatmap from './Heatmap'
import IndexStrip from './IndexStrip'
import Movers from './Movers'
import SectorRotation from './SectorRotation'

// Market overview (landing view): indices, S&P 500 heatmap, sector rotation, movers. No ticker needed.
export default function Market({ s, onSelect }: { s: Strings; onSelect: (symbol: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <IndexStrip />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(320px,1fr)]">
        <Heatmap s={s} onSelect={onSelect} />
        <SectorRotation s={s} />
      </div>
      <Movers s={s} onSelect={onSelect} />
    </div>
  )
}
