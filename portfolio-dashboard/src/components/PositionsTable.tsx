import { useState } from 'react'
import type { Position } from '../lib/supabase'
import { fmtGbp, plClass, plSign, catColor, catBg } from '../constants'

interface Props { positions: Position[]; totalValue: number }

type SortKey = 'ticker' | 'gbp_value' | 'unrealised_pl' | 'unrealised_pl_pct' | 'brokerage'

export default function PositionsTable({ positions, totalValue }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('gbp_value')
  const [sortAsc, setSortAsc] = useState(false)
  const [brokerFilter, setBrokerFilter] = useState('All')

  const brokers = ['All', ...Array.from(new Set(positions.map(p => p.brokerage))).sort()]
  const filtered = positions.filter(p => brokerFilter === 'All' || p.brokerage === brokerFilter)
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey]
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
    return sortAsc ? cmp : -cmp
  })

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  function Th({ label, k, right }: { label: string; k: SortKey; right?: boolean }) {
    const active = sortKey === k
    return (
      <th
        className={`px-3 py-3 text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)] cursor-pointer select-none hover:text-[var(--text)] ${right ? 'text-right' : 'text-left'}`}
        onClick={() => toggleSort(k)}
      >
        {label}{active ? (sortAsc ? ' ↑' : ' ↓') : ''}
      </th>
    )
  }

  const maxValue = positions.reduce((m, p) => Math.max(m, p.gbp_value), 0)

  if (!positions.length) {
    return (
      <div className="rounded-2xl p-5 border border-[var(--border)] bg-[var(--surface)]">
        <p className="text-[var(--muted)] text-sm">No positions data yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] flex-wrap gap-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">Positions</p>
        <div className="flex gap-2 flex-wrap">
          {brokers.map(b => (
            <button
              key={b}
              onClick={() => setBrokerFilter(b)}
              className={`px-3 py-1 rounded-full text-[0.72rem] font-semibold transition-colors ${
                brokerFilter === b
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--surface2)] text-[var(--muted)] hover:text-[var(--text)]'
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
            <tr className="border-b border-[var(--border)]">
              <Th label="Ticker" k="ticker" />
              <th className="px-3 py-3 text-left text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">Category</th>
              <Th label="Value" k="gbp_value" right />
              <th className="px-3 py-3 text-right text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">Weight</th>
              <Th label="P&L" k="unrealised_pl" right />
              <Th label="P&L %" k="unrealised_pl_pct" right />
              <Th label="Broker" k="brokerage" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const cat = p.category || 'Other'
              const weight = totalValue > 0 ? (p.gbp_value / totalValue * 100) : 0
              const barW = maxValue > 0 ? (p.gbp_value / maxValue * 100).toFixed(1) : '0'
              return (
                <tr
                  key={p.id}
                  className={`border-b border-[var(--border)] hover:bg-[var(--surface2)] transition-colors ${i === sorted.length - 1 ? 'border-b-0' : ''}`}
                >
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="font-semibold text-[0.9rem]">{p.ticker}</div>
                    <div className="text-[0.7rem] text-[var(--muted)]">{p.exchange} · {p.currency}</div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span
                      className="px-2 py-0.5 rounded text-[0.7rem] font-semibold"
                      style={{ background: catBg(cat), color: catColor(cat) }}
                    >
                      {cat}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap font-semibold text-[0.88rem]">
                    {fmtGbp(p.gbp_value, 0)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap min-w-[100px]">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-[0.72rem] text-[var(--muted)]">{weight.toFixed(1)}%</span>
                      <div className="w-16 h-1.5 rounded-full bg-[var(--surface2)]">
                        <div
                          className="h-1.5 rounded-full bg-[var(--accent)]"
                          style={{ width: `${barW}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className={`px-3 py-3 text-right whitespace-nowrap text-[0.85rem] font-semibold ${plClass(p.unrealised_pl)}`}>
                    {plSign(p.unrealised_pl)}{fmtGbp(p.unrealised_pl, 0)}
                  </td>
                  <td className={`px-3 py-3 text-right whitespace-nowrap text-[0.85rem] font-semibold ${plClass(p.unrealised_pl_pct)}`}>
                    {plSign(p.unrealised_pl_pct)}{p.unrealised_pl_pct.toFixed(2)}%
                  </td>
                  <td className="px-3 py-3 text-[0.78rem] text-[var(--muted)] whitespace-nowrap">{p.brokerage}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
