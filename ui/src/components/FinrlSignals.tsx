import type { Signal } from '../api'
import type { Strings } from '../i18n'

const tone = { BUY: 'text-up glow-up', SELL: 'text-down glow-down', HOLD: 'text-ink-2' }

function Spark({ v, up }: { v: number[]; up: boolean }) {
  const W = 64, H = 18, min = Math.min(...v), max = Math.max(...v), span = max - min || 1
  const pts = v.map((y, i) => `${(i / (v.length - 1)) * W},${H - ((y - min) / span) * (H - 2) - 1}`).join(' ')
  return <svg width={W} height={H} className={up ? 'text-up' : 'text-down'}><polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.25} /></svg>
}

export default function FinrlSignals({ signals, error, s }: { signals: Signal[] | null; error: string | null; s: Strings }) {
  return (
    <div className="panel flex flex-col p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.signals}</h2>
        {signals?.[0] && <span className="num text-xs text-ink-3">{s.asOf} {signals[0].as_of}</span>}
      </div>
      {error ? (
        <p className="text-sm text-ink-3">{error}</p>
      ) : !signals ? (
        <p className="text-sm text-ink-3">…</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-ink-3">
            <tr><th className="text-left font-medium">{s.agent}</th><th className="text-right font-medium">{s.action}</th><th className="text-right font-medium">{s.shares}</th><th className="text-right font-medium">{s.position}</th><th className="text-right font-medium" title={s.pnl60Title}>{s.pnl60}</th></tr>
          </thead>
          <tbody>
            {signals.map(r => (
              <tr key={r.agent} className="border-t border-line/60">
                <td className="py-1.5 font-mono uppercase text-ink">{r.agent}</td>
                <td className={`py-1.5 text-right font-semibold ${tone[r.action]}`}>{r.action}</td>
                <td className="num py-1.5 text-right text-ink-2">{r.shares > 0 ? `+${r.shares}` : r.shares}</td>
                <td className="num py-1.5 text-right text-ink-2">{r.position}</td>
                <td className="py-1.5 text-right" title={s.pnl60Title}>
                  {r.equity && <span className="inline-flex items-center justify-end gap-2">
                    <Spark v={r.equity} up={r.return_pct >= 0} />
                    <span className={`num w-14 text-xs ${r.return_pct >= 0 ? 'text-up' : 'text-down'}`}>{r.return_pct >= 0 ? '+' : ''}{r.return_pct.toFixed(1)}%</span>
                  </span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-[11px] text-ink-3">{s.disclaimer}</p>
    </div>
  )
}
