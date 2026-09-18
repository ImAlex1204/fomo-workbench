import { useEffect, useState } from 'react'
import { AGENT, BACKEND, OPENBB, fetchHistory, fetchQuote, fetchSignals, type Bar, type Quote, type Signal } from './api'
import { t, type Lang } from './i18n'
import AgentChat from './components/AgentChat'
import FinrlSignals from './components/FinrlSignals'
import PriceChart from './components/PriceChart'
import TopBar from './components/TopBar'
import Fundamentals from './components/fundamentals/Fundamentals'

type Tab = 'ai' | 'fundamentals'

export default function App() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lang') as Lang) || 'en')
  const [ticker, setTicker] = useState('AAPL')
  const [bars, setBars] = useState<Bar[]>([])
  const [quote, setQuote] = useState<Quote | null>(null)
  const [signals, setSignals] = useState<Signal[] | null>(null)
  const [sigError, setSigError] = useState<string | null>(null)
  const [online, setOnline] = useState(0)
  const [tab, setTab] = useState<Tab>('ai')
  const s = t(lang)

  useEffect(() => { localStorage.setItem('lang', lang) }, [lang])

  useEffect(() => {
    setBars([]); setQuote(null); setSignals(null); setSigError(null)
    fetchHistory(ticker).then(setBars).catch(() => setBars([]))
    fetchQuote(ticker).then(setQuote).catch(() => setQuote(null))
    fetchSignals(ticker).then(setSignals).catch(e => setSigError(String(e).includes('404') ? s.notDow : String(e)))
  }, [ticker])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const probe = (u: string) => fetch(u, { method: 'GET' }).then(r => r.ok || r.status === 405).catch(() => false)
    Promise.all([probe(`${OPENBB}/`), probe(`${BACKEND}/widgets.json`), probe(`${AGENT}/docs`)]).then(r => setOnline(r.filter(Boolean).length))
  }, [])

  return (
    <div className="flex min-h-full flex-col lg:h-full">
      <TopBar ticker={ticker} quote={quote} bars={bars} lang={lang} s={s} online={online} onTicker={setTicker} onLang={setLang} />
      <nav className="flex gap-1 px-5 pb-3">
        {([['ai', s.tabAi], ['fundamentals', s.tabFundamentals]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-panel-2 text-ink border border-line' : 'text-ink-3 hover:text-ink-2'}`}>{label}</button>
        ))}
      </nav>
      {/* Both tabs stay mounted (hidden, not unmounted) so the chat history and chart survive switching. */}
      <main className={`min-h-0 flex-1 overflow-y-auto px-5 pb-5 ${tab === 'fundamentals' ? '' : 'hidden'}`}><Fundamentals ticker={ticker} s={s} /></main>
      <main className={`grid grid-cols-1 gap-4 px-5 pb-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)] lg:grid-rows-[minmax(0,1fr)] ${tab === 'ai' ? '' : 'hidden'}`}>
        <section className="panel flex h-[460px] min-h-0 flex-col p-4 lg:h-auto">
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.chart} · {ticker}</h2>
          <div className="min-h-0 flex-1">{bars.length > 0 && <PriceChart bars={bars} />}</div>
        </section>
        <aside className="flex flex-col gap-4 lg:min-h-0">
          <FinrlSignals signals={signals} error={sigError} s={s} />
          <AgentChat ticker={ticker} s={s} />
        </aside>
      </main>
    </div>
  )
}
