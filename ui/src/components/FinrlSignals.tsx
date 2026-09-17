import type { Signal } from '../api'
import type { Strings } from '../i18n'

const tone = { BUY: 'text-up glow-up', SELL: 'text-down glow-down', HOLD: 'text-ink-2' }

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
            <tr><th className="text-left font-medium">{s.agent}</th><th className="text-right font-medium">{s.action}</th><th className="text-right font-medium">{s.shares}</th><th className="text-right font-medium">{s.position}</th></tr>
          </thead>
          <tbody>
            {signals.map(r => (
              <tr key={r.agent} className="border-t border-line/60">
                <td className="py-1.5 font-mono uppercase text-ink">{r.agent}</td>
                <td className={`py-1.5 text-right font-semibold ${tone[r.action]}`}>{r.action}</td>
                <td className="num py-1.5 text-right text-ink-2">{r.shares > 0 ? `+${r.shares}` : r.shares}</td>
                <td className="num py-1.5 text-right text-ink-2">{r.position}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-[11px] text-ink-3">{s.disclaimer}</p>
    </div>
  )
}
