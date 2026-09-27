import { useMemo } from 'react'
import type { DividendPayment, Position } from '../lib/supabase'
import {
  buildHoldingDividends,
  holdingsByTicker,
  projectPayments,
  upcomingPayments,
} from '../lib/dividends'
import DividendHeader from '../components/DividendHeader'
import UpcomingDividends from '../components/UpcomingDividends'
import DividendChart from '../components/DividendChart'
import DividendTable from '../components/DividendTable'

interface Props {
  positions: Position[]
  payments: DividendPayment[]
  paymentsError: string | null
}

export default function Dividends({ positions, payments, paymentsError }: Props) {
  const rows     = useMemo(() => buildHoldingDividends(positions, payments), [positions, payments])
  const holdings = useMemo(() => holdingsByTicker(positions), [positions])

  // Actual history plus one projected year, so the chart carries on past today.
  const withProjection = useMemo(
    () => [...payments, ...projectPayments(payments)],
    [payments],
  )

  const upcoming = useMemo(
    () => upcomingPayments(withProjection, holdings),
    [withProjection, holdings],
  )

  const categoryFor = useMemo(() => {
    const map = new Map(rows.map((r) => [r.ticker, r.category]))
    return (ticker: string) => map.get(ticker) ?? 'Other'
  }, [rows])

  return (
    <div className="space-y-6">
      {paymentsError && (
        <div
          className="rounded-xl p-4 text-[0.82rem] border"
          style={{ background: 'rgba(245,193,66,0.08)', borderColor: 'rgba(245,193,66,0.3)', color: '#f5c142' }}
        >
          {paymentsError}
        </div>
      )}

      <DividendHeader rows={rows} />
      <UpcomingDividends upcoming={upcoming} categoryFor={categoryFor} />
      <DividendChart payments={withProjection} holdings={holdings} />
      <DividendTable rows={rows} />
    </div>
  )
}
