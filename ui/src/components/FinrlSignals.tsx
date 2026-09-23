import { useState } from 'react'
import type { Signals } from '../api'
import type { Lang, Strings } from '../i18n'

const tone = { BUY: 'text-up glow-up', SELL: 'text-down glow-down', HOLD: 'text-ink-2' }

function Spark({ v, up }: { v: number[]; up: boolean }) {
  const W = 64, H = 18, min = Math.min(...v), max = Math.max(...v), span = max - min || 1
  const pts = v.map((y, i) => `${(i / (v.length - 1)) * W},${H - ((y - min) / span) * (H - 2) - 1}`).join(' ')
  return <svg width={W} height={H} className={up ? 'text-up' : 'text-down'}><polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.25} /></svg>
}

export default function FinrlSignals({ signals, error, lang, s }: { signals: Signals | null; error: string | null; lang: Lang; s: Strings }) {
  // The chosen basket sticks across tickers (stored by id); it falls back to the first one that has this ticker.
  const [pick, setPick] = useState(() => localStorage.getItem('basket') ?? '')
  const baskets = signals?.baskets ?? []
  const shown = baskets.find(b => b.id === pick) ?? baskets[0]
  const choose = (id: string) => { setPick(id); localStorage.setItem('basket', id) }

  return (
    <div className="panel flex flex-col p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.signals}</h2>
        {shown && <span className="num text-xs text-ink-3">{s.asOf} {shown.as_of}</span>}
      </div>
      {baskets.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1" role="group" aria-label={s.basket}>
          {baskets.map(b => (
            <button key={b.id} onClick={() => choose(b.id)} title={`${lang === 'zh' ? b.label_zh : b.label_en}\n${lang === 'zh' ? b.note_zh : b.note_en}`}
              className={`num rounded px-1.5 py-0.5 text-[11px] ${b.id === shown?.id ? 'bg-panel-2 text-ink border border-line' : 'text-ink-3 hover:text-ink-2'}`}>{b.short}</button>
          ))}
        </div>
      )}
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
            {shown?.signals.map(r => (
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
      {shown && <p className="mt-2 text-[11px] leading-snug text-ink-3">{lang === 'zh' ? shown.note_zh : shown.note_en}</p>}
      <p className="mt-2 text-[11px] text-ink-3">{s.disclaimer}</p>
    </div>
  )
}
