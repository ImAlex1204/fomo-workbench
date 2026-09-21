import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { chat, type ChatEvent } from '../api'
import type { Strings } from '../i18n'

type Msg = { role: 'user' | 'agent'; text: string; steps: string[]; stream?: string; pending?: boolean }  // stream = FinGPT's report as it is generated

export default function AgentChat({ ticker, s }: { ticker: string; s: Strings }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send(text: string) {
    if (!text.trim() || busy) return
    setBusy(true)
    setInput('')
    setMsgs(m => [...m, { role: 'user', text, steps: [] }, { role: 'agent', text: '', steps: [], pending: true }])
    const patch = (f: (a: Msg) => Msg) => setMsgs(m => [...m.slice(0, -1), f(m[m.length - 1])])
    try {
      for await (const ev of chat(text)) {
        const e = ev as ChatEvent
        if (e.type === 'tool_call') patch(a => ({ ...a, steps: [...a.steps, `${s.calling} ${e.name}(${JSON.stringify(e.args)})`] }))
        else if (e.type === 'tool_stream') patch(a => ({ ...a, stream: (a.stream ?? '') + e.text }))
        else if (e.type === 'text') patch(a => ({ ...a, text: e.text, pending: false }))
        else if (e.type === 'error') patch(a => ({ ...a, text: `${s.error}: ${e.text}`, pending: false }))
      }
    } catch (err) {
      patch(a => ({ ...a, text: `${s.error}: ${String(err)}`, pending: false }))
    } finally {
      patch(a => ({ ...a, pending: false }))
      setBusy(false)
    }
  }

  return (
    <div className="panel flex h-[520px] shrink-0 flex-col p-4 lg:h-auto lg:min-h-0 lg:flex-1 lg:shrink">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.chat}</h2>
        <div className="flex gap-3">
          <button className="text-xs text-accent hover:underline" disabled={busy}
            onClick={() => send(`What does FinGPT say about ${ticker} this week?`)}>FinGPT → {ticker}</button>
          <button className="text-xs text-accent hover:underline" disabled={busy}
            onClick={() => send(`Compare ${ticker}: do the five FinRL agents' signals agree with FinGPT's outlook for this week?`)}>FinRL × FinGPT → {ticker}</button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-sm">
        {msgs.length === 0 && <p className="text-ink-3">{s.chatHint}</p>}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            {m.steps.length > 0 && (
              <ul className="mb-1 space-y-0.5 font-mono text-[11px] text-ink-3">
                {m.steps.map((st, j) => <li key={j} className="truncate" title={st}>› {st}</li>)}
              </ul>
            )}
            {m.stream && (m.text
              ? <details className="mb-1 text-xs text-ink-3"><summary className="cursor-pointer select-none">{s.rawOutput}</summary><pre className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-bg p-2 font-mono text-[11px] text-ink-2">{m.stream}</pre></details>
              : <pre className="mb-1 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-bg p-2 font-mono text-[11px] text-ink-2">{m.stream}<span className="animate-pulse">▍</span></pre>)}
            {m.pending && !m.text && !m.stream && <span className="animate-pulse text-ink-3">{s.thinking}</span>}
            {m.text && (
              <div className={`inline-block max-w-full rounded-lg px-3 py-2 text-left ${m.role === 'user' ? 'whitespace-pre-wrap bg-accent/15 text-ink' : 'md bg-panel-2 text-ink'}`}>
                {m.role === 'user' ? m.text : <Markdown remarkPlugins={[remarkGfm]}>{m.text}</Markdown>}
              </div>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); send(input) }}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder={s.chatHint} disabled={busy}
          className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={busy}>{s.send}</button>
      </form>
    </div>
  )
}
