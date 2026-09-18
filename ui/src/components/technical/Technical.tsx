import { useEffect, useState } from 'react'
import { fetchTechnical, type Bar, type Metrics, type Technical as TechnicalData } from '../../api'
import type { Strings } from '../../i18n'
import CandleSma from './CandleSma'
import Momentum from './Momentum'
import Volatility from './Volatility'

// Technical tab: indicators are computed once per daily series (openbb-api POST /technical/*) and shared by the cards.
export default function Technical({ bars, metrics, s }: { bars: Bar[]; metrics: Metrics | null; s: Strings }) {
  const [tech, setTech] = useState<TechnicalData | null>(null)
  useEffect(() => {
    setTech(null)
    if (bars.length === 0) return
    let alive = true
    fetchTechnical(bars).then(t => { if (alive) setTech(t) }).catch(() => {})
    return () => { alive = false }
  }, [bars])

  return (
    <div className="flex flex-col gap-4">
      <CandleSma bars={bars} tech={tech} s={s} />
      <Momentum tech={tech} s={s} />
      <Volatility bars={bars} tech={tech} beta={metrics?.beta} s={s} />
    </div>
  )
}
