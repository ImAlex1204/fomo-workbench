import { useEffect, useState } from 'react'
import { fetchStatement, type Statement } from '../../api'
import type { Strings } from '../../i18n'
import BalanceCard from './BalanceCard'
import CashFlowCard from './CashFlowCard'
import IncomeCard from './IncomeCard'

// Financials tab: last 5 fiscal years of the three statements (annual), one fetch each, one card each.
export default function Financials({ ticker, s }: { ticker: string; s: Strings }) {
  const [income, setIncome] = useState<Statement[] | null>(null)
  const [balance, setBalance] = useState<Statement[] | null>(null)
  const [cash, setCash] = useState<Statement[] | null>(null)
  useEffect(() => {
    setIncome(null); setBalance(null); setCash(null)
    fetchStatement('income', ticker).then(setIncome).catch(() => setIncome([]))
    fetchStatement('balance', ticker).then(setBalance).catch(() => setBalance([]))
    fetchStatement('cash', ticker).then(setCash).catch(() => setCash([]))
  }, [ticker])
  const years = income?.length ?? balance?.length ?? 0

  return (
    <div className="flex flex-col gap-4">
      <IncomeCard rows={income} s={s} />
      <BalanceCard rows={balance} s={s} />
      <CashFlowCard rows={cash} s={s} />
      <p className="text-[11px] text-ink-3">{years} {s.fiscalYears}</p>
    </div>
  )
}
