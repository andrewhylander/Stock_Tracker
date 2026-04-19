import { useState } from 'react'
import type { Position } from '../lib/supabase'

interface Props {
  positions: Position[]
}

type SortKey = 'ticker' | 'gbp_value' | 'unrealised_pl' | 'unrealised_pl_pct' | 'brokerage'

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function plClass(v: number) {
  return v >= 0 ? 'text-emerald-400' : 'text-red-400'
}

export default function PositionsTable({ positions }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('gbp_value')
  const [sortAsc, setSortAsc] = useState(false)
  const [brokerFilter, setBrokerFilter] = useState('All')

  const brokers = ['All', ...Array.from(new Set(positions.map(p => p.brokerage))).sort()]

  const filtered = positions.filter(p => brokerFilter === 'All' || p.brokerage === brokerFilter)

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
    return sortAsc ? cmp : -cmp
  })

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  function Th({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k
    return (
      <th
        className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-white"
        onClick={() => toggleSort(k)}
      >
        {label} {active ? (sortAsc ? '↑' : '↓') : ''}
      </th>
    )
  }

  if (!positions.length) {
    return (
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Positions</h2>
        <p className="text-gray-500">No positions data yet</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-white">Positions</h2>
        <div className="flex gap-2 flex-wrap">
          {brokers.map(b => (
            <button
              key={b}
              onClick={() => setBrokerFilter(b)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                brokerFilter === b
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <Th label="Ticker" k="ticker" />
              <Th label="Broker" k="brokerage" />
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Sector</th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Shares</th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Price</th>
              <Th label="Value (£)" k="gbp_value" />
              <Th label="P&L (£)" k="unrealised_pl" />
              <Th label="P&L %" k="unrealised_pl_pct" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {sorted.map(p => (
              <tr key={p.id} className="hover:bg-gray-750 transition-colors">
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="font-medium text-white">{p.ticker}</div>
                  <div className="text-xs text-gray-400">{p.exchange} · {p.currency}</div>
                </td>
                <td className="px-3 py-3 text-sm text-gray-300 whitespace-nowrap">{p.brokerage}</td>
                <td className="px-3 py-3 text-sm text-gray-300 whitespace-nowrap">{p.sector || '—'}</td>
                <td className="px-3 py-3 text-sm text-gray-300 text-right">{fmt(p.share_count, 4)}</td>
                <td className="px-3 py-3 text-sm text-gray-300 text-right">£{fmt(p.share_price, 4)}</td>
                <td className="px-3 py-3 text-sm text-white text-right font-medium">£{fmt(p.gbp_value)}</td>
                <td className={`px-3 py-3 text-sm text-right font-medium ${plClass(p.unrealised_pl)}`}>
                  {p.unrealised_pl >= 0 ? '+' : ''}£{fmt(p.unrealised_pl)}
                </td>
                <td className={`px-3 py-3 text-sm text-right font-medium ${plClass(p.unrealised_pl_pct)}`}>
                  {p.unrealised_pl_pct >= 0 ? '+' : ''}{fmt(p.unrealised_pl_pct)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
