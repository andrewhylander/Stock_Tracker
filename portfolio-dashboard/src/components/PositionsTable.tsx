import { useState } from 'react'
import type { Position } from '../lib/supabase'
import { fmtGbp, plClass, plSign, catColor, catBg } from '../constants'

interface Props { positions: Position[]; totalValue: number }

type SortKey = 'ticker' | 'gbp_value' | 'unrealised_pl' | 'unrealised_pl_pct'

interface Aggregated {
  ticker: string
  category: string
  exchange: string
  currency: string
  gbp_value: number
  unrealised_pl: number
  unrealised_pl_pct: number
  rows: Position[]
}

function aggregate(positions: Position[]): Aggregated[] {
  const map: Record<string, Aggregated> = {}
  for (const p of positions) {
    if (!map[p.ticker]) {
      map[p.ticker] = { ticker: p.ticker, category: p.category || 'Other', exchange: p.exchange, currency: p.currency, gbp_value: 0, unrealised_pl: 0, unrealised_pl_pct: 0, rows: [] }
    }
    map[p.ticker].gbp_value    += p.gbp_value
    map[p.ticker].unrealised_pl += p.unrealised_pl
    map[p.ticker].rows.push(p)
  }
  for (const agg of Object.values(map)) {
    const invested = agg.gbp_value - agg.unrealised_pl
    agg.unrealised_pl_pct = invested > 0 ? (agg.unrealised_pl / invested * 100) : 0
  }
  return Object.values(map)
}

export default function PositionsTable({ positions, totalValue }: Props) {
  const [sortKey, setSortKey]       = useState<SortKey>('gbp_value')
  const [sortAsc, setSortAsc]       = useState(false)
  const [merged, setMerged]         = useState(true)
  const [expanded, setExpanded]     = useState<Set<string>>(new Set())
  const [brokerFilter, setBrokerFilter] = useState('All')

  const brokers = ['All', ...Array.from(new Set(positions.map(p => p.brokerage))).sort()]

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  function toggleExpand(ticker: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(ticker) ? next.delete(ticker) : next.add(ticker)
      return next
    })
  }

  const filtered = positions.filter(p => brokerFilter === 'All' || p.brokerage === brokerFilter)

  const aggregated = aggregate(filtered).sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey]
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
    return sortAsc ? cmp : -cmp
  })

  const maxValue = aggregated.reduce((m, a) => Math.max(m, a.gbp_value), 0)

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
        <div className="flex items-center gap-3 flex-wrap">
          {/* Merge toggle */}
          <button
            onClick={() => { setMerged(m => !m); setExpanded(new Set()) }}
            className={`px-3 py-1 rounded-full text-[0.72rem] font-semibold border transition-colors ${
              merged
                ? 'border-[var(--accent)] text-[var(--accent)] bg-transparent'
                : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {merged ? 'Merged ↕' : 'Split'}
          </button>

          {/* Broker filter — only visible when split */}
          {!merged && brokers.map(b => (
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
              <th className="px-3 py-3 w-6" />
              <Th label="Ticker" k="ticker" />
              <th className="px-3 py-3 text-left text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">Category</th>
              <Th label="Value" k="gbp_value" right />
              <th className="px-3 py-3 text-right text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">Weight</th>
              <Th label="P&L" k="unrealised_pl" right />
              <Th label="P&L %" k="unrealised_pl_pct" right />
              <th className="px-3 py-3 text-left text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">Broker</th>
            </tr>
          </thead>
          <tbody>
            {aggregated.map((agg, i) => {
              const cat      = agg.category
              const weight   = totalValue > 0 ? (agg.gbp_value / totalValue * 100) : 0
              const barW     = maxValue > 0 ? (agg.gbp_value / maxValue * 100).toFixed(1) : '0'
              const multi    = agg.rows.length > 1
              const isExp    = expanded.has(agg.ticker)
              const isLast   = i === aggregated.length - 1 && !isExp

              const brokerLabel = merged
                ? (multi ? `${agg.rows.length} brokers` : agg.rows[0].brokerage)
                : agg.rows[0].brokerage

              return [
                <tr
                  key={agg.ticker}
                  className={`border-b border-[var(--border)] transition-colors ${isLast ? 'border-b-0' : ''} ${multi && merged ? 'cursor-pointer hover:bg-[var(--surface2)]' : 'hover:bg-[var(--surface2)]'}`}
                  onClick={() => merged && multi && toggleExpand(agg.ticker)}
                >
                  <td className="pl-3 py-3 w-6 text-[var(--muted)] text-[0.75rem]">
                    {merged && multi ? (isExp ? '▾' : '▸') : ''}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="font-semibold text-[0.9rem]">{agg.ticker}</div>
                    <div className="text-[0.7rem] text-[var(--muted)]">{agg.exchange} · {agg.currency}</div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded text-[0.7rem] font-semibold" style={{ background: catBg(cat), color: catColor(cat) }}>
                      {cat}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap font-semibold text-[0.88rem]">{fmtGbp(agg.gbp_value, 0)}</td>
                  <td className="px-3 py-3 whitespace-nowrap min-w-[100px]">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-[0.72rem] text-[var(--muted)]">{weight.toFixed(1)}%</span>
                      <div className="w-16 h-1.5 rounded-full bg-[var(--surface2)]">
                        <div className="h-1.5 rounded-full bg-[var(--accent)]" style={{ width: `${barW}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className={`px-3 py-3 text-right whitespace-nowrap text-[0.85rem] font-semibold ${plClass(agg.unrealised_pl)}`}>
                    {plSign(agg.unrealised_pl)}{fmtGbp(agg.unrealised_pl, 0)}
                  </td>
                  <td className={`px-3 py-3 text-right whitespace-nowrap text-[0.85rem] font-semibold ${plClass(agg.unrealised_pl_pct)}`}>
                    {plSign(agg.unrealised_pl_pct)}{agg.unrealised_pl_pct.toFixed(2)}%
                  </td>
                  <td className="px-3 py-3 text-[0.78rem] text-[var(--muted)] whitespace-nowrap">{brokerLabel}</td>
                </tr>,

                // Expanded brokerage sub-rows
                ...(merged && isExp ? agg.rows.map((p, ri) => {
                  const subWeight = totalValue > 0 ? (p.gbp_value / totalValue * 100) : 0
                  const subBarW   = maxValue > 0 ? (p.gbp_value / maxValue * 100).toFixed(1) : '0'
                  const subLast   = ri === agg.rows.length - 1 && isLast
                  return (
                    <tr key={`${p.id}-sub`} className={`border-b border-[var(--border)] bg-[var(--surface2)] ${subLast ? 'border-b-0' : ''}`}>
                      <td className="pl-3 py-2 w-6" />
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-[0.8rem] text-[var(--muted)] pl-2 border-l-2 border-[var(--border)]">{p.ticker}</div>
                      </td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 text-right whitespace-nowrap text-[0.82rem]">{fmtGbp(p.gbp_value, 0)}</td>
                      <td className="px-3 py-2 whitespace-nowrap min-w-[100px]">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-[0.7rem] text-[var(--muted)]">{subWeight.toFixed(1)}%</span>
                          <div className="w-16 h-1.5 rounded-full bg-[var(--surface)]">
                            <div className="h-1.5 rounded-full bg-[var(--accent)] opacity-50" style={{ width: `${subBarW}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className={`px-3 py-2 text-right whitespace-nowrap text-[0.82rem] font-semibold ${plClass(p.unrealised_pl)}`}>
                        {plSign(p.unrealised_pl)}{fmtGbp(p.unrealised_pl, 0)}
                      </td>
                      <td className={`px-3 py-2 text-right whitespace-nowrap text-[0.82rem] font-semibold ${plClass(p.unrealised_pl_pct)}`}>
                        {plSign(p.unrealised_pl_pct)}{p.unrealised_pl_pct.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-[0.75rem] text-[var(--muted)] whitespace-nowrap">{p.brokerage}</td>
                    </tr>
                  )
                }) : [])
              ]
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
