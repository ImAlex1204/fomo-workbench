import { useEffect, useMemo, useState } from 'react'
import { fetchHeatmap, type HeatTile } from '../../api'
import type { Strings } from '../../i18n'
import { squarify, type Rect } from './squarify'

const W = 1200, H = 540, GAP = 2, HEAD = 14
// ±3% saturates; negatives red, positives green, |Δ|<0.1% grey. Same hues as the candles.
const color = (chg: number) => {
  const t = Math.min(1, Math.abs(chg) / 3)
  if (Math.abs(chg) < 0.1) return 'rgb(60,68,84)'
  return chg > 0 ? `rgb(${Math.round(38 + (20 - 38) * t)},${Math.round(90 + (166 - 90) * t)},${Math.round(90 + (154 - 90) * t)})` : `rgb(${Math.round(110 + (239 - 110) * t)},${Math.round(60 + (83 - 60) * t)},${Math.round(60 + (80 - 60) * t)})`
}
const cap = (v: number) => v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : `$${(v / 1e9).toFixed(0)}B`

export default function Heatmap({ s, onSelect }: { s: Strings; onSelect: (symbol: string) => void }) {
  const [tiles, setTiles] = useState<HeatTile[] | null>(null)
  const [err, setErr] = useState(false)
  const [hover, setHover] = useState<(HeatTile & Rect) | null>(null)
  useEffect(() => {
    const load = () => fetchHeatmap().then(t => { setTiles(t); setErr(false) }).catch(() => setErr(true))
    load(); const id = setInterval(load, 300_000); return () => clearInterval(id)  // finviz scrape takes ~10s; 5 min is plenty for a heatmap
  }, [])

  const layout = useMemo(() => {
    if (!tiles) return []
    const bySector = new Map<string, HeatTile[]>()
    for (const t of tiles) bySector.set(t.sector, [...(bySector.get(t.sector) ?? []), t])
    const sectors = [...bySector.entries()].map(([name, items]) => ({ name, items: items.sort((a, b) => b.market_cap - a.market_cap), weight: items.reduce((x, t) => x + t.market_cap, 0) })).sort((a, b) => b.weight - a.weight)
    return squarify(sectors, { x: 0, y: 0, w: W, h: H }).map(sec => ({
      ...sec,
      tiles: squarify(sec.items.map(t => ({ ...t, weight: t.market_cap })), { x: sec.x + GAP, y: sec.y + HEAD + GAP, w: Math.max(0, sec.w - 2 * GAP), h: Math.max(0, sec.h - HEAD - 2 * GAP) }),
    }))
  }, [tiles])

  return (
    <section className="panel p-4">
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.heatmap}</h2>
      {err ? <p className="text-sm text-ink-3">{s.noData}</p> : !tiles ? <p className="text-sm text-ink-3">…</p> : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" onMouseLeave={() => setHover(null)}>
            {layout.map(sec => (
              <g key={sec.name}>
                <rect x={sec.x} y={sec.y} width={sec.w} height={sec.h} fill="#0b0e14" />
                <text x={sec.x + 4} y={sec.y + 10} fontSize="9" fill="#9aa3b5" fontFamily="Inter, sans-serif" fontWeight={600}>{sec.w > 60 ? sec.name.toUpperCase() : ''}</text>
                {sec.tiles.map(t => (
                  <g key={t.symbol} onMouseEnter={() => setHover(t)} onClick={() => onSelect(t.symbol)} className="cursor-pointer">
                    <rect x={t.x} y={t.y} width={Math.max(0, t.w - 1)} height={Math.max(0, t.h - 1)} fill={color(t.change)} rx={1} />
                    {t.w > 34 && t.h > 22 && (
                      <text x={t.x + t.w / 2} y={t.y + t.h / 2 + (t.h > 36 ? -2 : 3)} textAnchor="middle" fontSize={Math.min(12, t.w / 4)} fill="#fff" fontFamily="JetBrains Mono, monospace" fontWeight={600}>{t.symbol}</text>
                    )}
                    {t.w > 40 && t.h > 36 && (
                      <text x={t.x + t.w / 2} y={t.y + t.h / 2 + 11} textAnchor="middle" fontSize={Math.min(10, t.w / 5)} fill="rgba(255,255,255,.85)" fontFamily="JetBrains Mono, monospace">{t.change > 0 ? '+' : ''}{t.change.toFixed(2)}%</text>
                    )}
                  </g>
                ))}
              </g>
            ))}
          </svg>
          {hover && (
            <div className="pointer-events-none absolute z-10 rounded border border-line bg-panel-2 px-2 py-1 text-xs text-ink"
              style={{ left: `${((hover.x + hover.w / 2) / W) * 100}%`, top: `${(hover.y / H) * 100}%`, transform: 'translate(-50%, -110%)' }}>
              <div className="font-semibold">{hover.symbol} <span className="font-normal text-ink-2">{hover.name}</span></div>
              <div className="num">{hover.industry} · {cap(hover.market_cap)} · <span className={hover.change >= 0 ? 'text-up' : 'text-down'}>{hover.change > 0 ? '+' : ''}{hover.change.toFixed(2)}%</span></div>
            </div>
          )}
        </div>
      )}
      <p className="mt-2 text-[11px] text-ink-3">{s.heatmapNote}</p>
    </section>
  )
}
