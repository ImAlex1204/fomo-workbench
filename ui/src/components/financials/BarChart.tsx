import { useState } from 'react'

export type BarSeries = { label: string; color: string; values: (number | null)[] }
export type LineOverlay = { label: string; color: string; values: (number | null)[] }

export const fmtMoney = (v: number) => {
  const a = Math.abs(v), sign = v < 0 ? '-' : ''
  return a >= 1e12 ? `${sign}$${(a / 1e12).toFixed(2)}T` : a >= 1e9 ? `${sign}$${(a / 1e9).toFixed(1)}B` : `${sign}$${(a / 1e6).toFixed(0)}M`
}

/** Grouped bars per category (fiscal year) with a zero baseline and an optional line overlay. Plain SVG, no library. */
export default function BarChart({ categories, series, line, height = 260 }: { categories: string[]; series: BarSeries[]; line?: LineOverlay; height?: number }) {
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null)
  const W = 800, H = height, padL = 56, padR = 16, padT = 12, padB = 28
  const plotW = W - padL - padR, plotH = H - padT - padB
  const all = [...series.flatMap(s => s.values), ...(line?.values ?? [])].filter((v): v is number => v != null)
  // nice axis: round the range out to a 1/2/5 x 10^n step
  const raw = Math.max(0, ...all) - Math.min(0, ...all) || 1
  const pow = 10 ** Math.floor(Math.log10(raw / 4)), step = [1, 2, 5, 10].map(m => m * pow).find(x => raw / x <= 4.5) ?? pow * 10
  const max = Math.ceil(Math.max(0, ...all) / step) * step, min = Math.floor(Math.min(0, ...all) / step) * step
  const y = (v: number) => padT + ((max - v) / (max - min || 1)) * plotH
  const groupW = plotW / categories.length, barW = (groupW * 0.72) / series.length
  const tickVals = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + step * i)

  return (
    <div className="relative h-full w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none" onMouseLeave={() => setHover(null)}>
        {tickVals.map(t => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#3a4356' : '#1a2030'} strokeWidth={t === 0 ? 1.5 : 1} />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#5c6577" fontFamily="JetBrains Mono, monospace">{fmtMoney(t)}</text>
          </g>
        ))}
        {categories.map((cat, ci) => (
          <g key={cat}>
            {series.map((s, si) => {
              const v = s.values[ci]
              if (v == null) return null
              const x = padL + ci * groupW + groupW * 0.14 + si * barW
              const top = Math.min(y(v), y(0)), h = Math.max(1, Math.abs(y(v) - y(0)))
              return <rect key={s.label} x={x} y={top} width={barW - 2} height={h} rx={2} fill={s.color}
                onMouseEnter={() => setHover({ x: x + barW / 2, y: top, text: `${cat} · ${s.label}: ${fmtMoney(v)}` })} />
            })}
            <text x={padL + ci * groupW + groupW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#9aa3b5" fontFamily="JetBrains Mono, monospace">{cat}</text>
          </g>
        ))}
        {line && (
          <g>
            <polyline fill="none" stroke={line.color} strokeWidth={2}
              points={line.values.map((v, i) => v == null ? null : `${padL + i * groupW + groupW / 2},${y(v)}`).filter(Boolean).join(' ')} />
            {line.values.map((v, i) => v == null ? null : (
              <circle key={i} cx={padL + i * groupW + groupW / 2} cy={y(v)} r={4} fill={line.color} stroke="#12161f" strokeWidth={2}
                onMouseEnter={() => setHover({ x: padL + i * groupW + groupW / 2, y: y(v), text: `${categories[i]} · ${line.label}: ${fmtMoney(v)}` })} />
            ))}
          </g>
        )}
      </svg>
      {hover && (
        <div className="num pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded border border-line bg-panel-2 px-2 py-1 text-[11px] text-ink"
          style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%` }}>{hover.text}</div>
      )}
    </div>
  )
}
