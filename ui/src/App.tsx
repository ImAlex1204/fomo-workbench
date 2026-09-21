import { useEffect, useState } from 'react'
import { AGENT, BACKEND, OPENBB, RANGES, applyTick, fetchHistory, fetchMetrics, fetchQuote, fetchSignals, subscribeLive, type Bar, type Metrics, type Quote, type Range, type Signal, type Tick } from './api'
import { t, type Lang } from './i18n'
import AgentChat from './components/AgentChat'
import FinrlSignals from './components/FinrlSignals'
import PriceChart from './components/PriceChart'
import RangeBar from './components/RangeBar'
import TopBar from './components/TopBar'
import Fundamentals from './components/fundamentals/Fundamentals'
import Technical from './components/technical/Technical'
import News from './components/news/News'
import Ownership from './components/ownership/Ownership'
import Financials from './components/financials/Financials'
import Market from './components/market/Market'

type Tab = 'ai' | 'fundamentals' | 'technical' | 'news' | 'ownership' | 'financials'

export default function App() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lang') as Lang) || 'en')
  const [ticker, setTicker] = useState('AAPL')
  const [series, setSeries] = useState<{ key: string; bars: Bar[] }>({ key: '', bars: [] })  // chart data + the ticker:range it belongs to (kept together so a stale render can't pair old bars with a new key)
  const [daily, setDaily] = useState<Bar[]>([])     // 1Y daily series: top-bar price/change + Technical tab (shared, fetched once)
  const [metrics, setMetrics] = useState<Metrics | null>(null)  // shared by KeyMetrics (P/E…) and Volatility (Beta)
  const [tick, setTick] = useState<Tick | null>(null)  // latest real-time trade from the backend's Yahoo relay
  const [range, setRange] = useState<Range>(() => (localStorage.getItem('range') as Range) || '1Y')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [signals, setSignals] = useState<Signal[] | null>(null)
  const [sigError, setSigError] = useState<string | null>(null)
  const [online, setOnline] = useState(0)
  const [tab, setTab] = useState<Tab>('ai')
  const [view, setView] = useState<'market' | 'stock'>('market')  // landing = market overview; a ticker opens the stock view
  const [stockOpened, setStockOpened] = useState(false)  // stock panels mount (and start fetching) only after the first ticker is opened
  const openStock = (symbol: string) => { setTicker(symbol.toUpperCase()); setView('stock'); setStockOpened(true) }
  const s = t(lang)

  useEffect(() => { localStorage.setItem('lang', lang) }, [lang])
  useEffect(() => { localStorage.setItem('range', range) }, [range])

  useEffect(() => {
    if (!stockOpened) return
    setDaily([]); setQuote(null); setSignals(null); setSigError(null); setMetrics(null)
    fetchHistory(ticker, '1Y').then(setDaily).catch(() => setDaily([]))
    fetchMetrics(ticker).then(setMetrics).catch(() => setMetrics({}))
    fetchQuote(ticker).then(setQuote).catch(() => setQuote(null))
    fetchSignals(ticker).then(setSignals).catch(e => setSigError(String(e).includes('404') ? s.notDow : String(e)))
  }, [ticker, stockOpened])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {  // chart series; intraday ranges refresh every 60s so the last bar (and top-bar price) moves during market hours
    if (!stockOpened) return
    const key = `${ticker}:${range}`
    let alive = true
    const load = () => {
      fetchHistory(ticker, range).then(bars => { if (alive) setSeries({ key, bars }) }).catch(() => {})
      if (RANGES[range].intraday) fetchHistory(ticker, '1Y').then(d => { if (alive) setDaily(d) }).catch(() => {})
    }
    load()
    const id = RANGES[range].intraday ? setInterval(load, 60_000) : undefined
    return () => { alive = false; if (id) clearInterval(id) }
  }, [ticker, range, stockOpened])

  useEffect(() => {  // real-time ticks: move the last bar of both series and the top-bar price between polls
    setTick(null)
    if (!stockOpened) return
    const intraday = !!RANGES[range].intraday
    return subscribeLive(ticker, t => {
      setTick(t)
      if (t.market_hours !== 1) return  // pre/post-market trades show in the top bar only; bars stay regular-session
      setSeries(prev => prev.key === `${ticker}:${range}` ? { ...prev, bars: applyTick(prev.bars, intraday, t) } : prev)
      setDaily(prev => applyTick(prev, false, t))
    })
  }, [ticker, range, stockOpened])

  useEffect(() => {
    const probe = (u: string) => fetch(u, { method: 'GET' }).then(r => r.ok || r.status === 405).catch(() => false)
    const run = () => Promise.all([probe(`${OPENBB}/`), probe(`${BACKEND}/widgets.json`), probe(`${AGENT}/docs`)]).then(r => setOnline(r.filter(Boolean).length))
    run(); const id = setInterval(run, 60_000); return () => clearInterval(id)
  }, [])

  return (
    <div className="flex min-h-full flex-col lg:h-full">
      <TopBar ticker={ticker} quote={quote} bars={daily} tick={tick} lang={lang} s={s} online={online} view={view} onTicker={openStock} onHome={() => setView('market')} onLang={setLang} />
      <main className={`min-h-0 flex-1 overflow-y-auto px-5 pb-5 ${view === 'market' ? '' : 'hidden'}`}><Market lang={lang} s={s} onSelect={openStock} /></main>
      {stockOpened && (<>
      <nav className={`flex gap-1 px-5 pb-3 ${view === 'stock' ? '' : 'hidden'}`}>
        {([['ai', s.tabAi], ['fundamentals', s.tabFundamentals], ['technical', s.tabTechnical], ['news', s.tabNews], ['ownership', s.tabOwnership], ['financials', s.tabFinancials]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-panel-2 text-ink border border-line' : 'text-ink-3 hover:text-ink-2'}`}>{label}</button>
        ))}
      </nav>
      {/* Both tabs stay mounted (hidden, not unmounted) so the chat history and chart survive switching. */}
      <main className={`min-h-0 flex-1 overflow-y-auto px-5 pb-5 ${view === 'stock' && tab === 'fundamentals' ? '' : 'hidden'}`}><Fundamentals ticker={ticker} metrics={metrics} s={s} /></main>
      <main className={`min-h-0 flex-1 overflow-y-auto px-5 pb-5 ${view === 'stock' && tab === 'technical' ? '' : 'hidden'}`}><Technical bars={daily} metrics={metrics} s={s} /></main>
      <main className={`min-h-0 flex-1 overflow-y-auto px-5 pb-5 ${view === 'stock' && tab === 'news' ? '' : 'hidden'}`}><News ticker={ticker} s={s} /></main>
      <main className={`min-h-0 flex-1 overflow-y-auto px-5 pb-5 ${view === 'stock' && tab === 'ownership' ? '' : 'hidden'}`}><Ownership ticker={ticker} bars={daily} s={s} /></main>
      <main className={`min-h-0 flex-1 overflow-y-auto px-5 pb-5 ${view === 'stock' && tab === 'financials' ? '' : 'hidden'}`}><Financials ticker={ticker} s={s} /></main>
      </>)}
      <main className={`grid grid-cols-1 gap-4 px-5 pb-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)] lg:grid-rows-[minmax(0,1fr)] ${view === 'stock' && tab === 'ai' ? '' : 'hidden'}`}>
        <section className="panel flex h-[460px] min-h-0 flex-col p-4 lg:h-auto">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-ink-2 uppercase">{s.chart} · {ticker}</h2>
            <RangeBar value={range} onChange={setRange} />
          </div>
          <div className="min-h-0 flex-1"><PriceChart bars={series.bars} intraday={series.key.endsWith(':1D') || series.key.endsWith(':1W')} resetKey={series.key} /></div>
        </section>
        <aside className="flex flex-col gap-4 lg:min-h-0">
          <FinrlSignals signals={signals} error={sigError} s={s} />
          <AgentChat ticker={ticker} s={s} />
        </aside>
      </main>
    </div>
  )
}
