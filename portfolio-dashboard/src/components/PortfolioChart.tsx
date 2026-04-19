import { useState, useMemo } from 'react'
import {
  ResponsiveContainer, AreaChart, LineChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import type { BenchmarkDaily, PortfolioDaily } from '../lib/supabase'

interface Props { data: PortfolioDaily[]; benchmark: BenchmarkDaily[] }

const RANGES = ['1M', '3M', '6M', '1Y', 'All'] as const
type Range = typeof RANGES[number]

function cutoff(range: Range): Date | null {
  if (range === 'All') return null
  const d = new Date()
  const months = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 }[range]
  d.setMonth(d.getMonth() - months)
  return d
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}
function formatDateLong(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
function formatGBP(v: number) {
  return `£${v.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
}
function formatPct(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

export default function PortfolioChart({ data, benchmark }: Props) {
  const [range, setRange]                 = useState<Range>('All')
  const [showBenchmark, setShowBenchmark] = useState(false)

  const filtered = useMemo(() => {
    const c = cutoff(range)
    return c ? data.filter(d => new Date(d.snapshot_date) >= c) : data
  }, [data, range])

  // Normal £ chart data
  const absoluteData = useMemo(() =>
    filtered.map(d => ({
      ...d,
      total_invested_gbp: (d.invested_gbp ?? 0) + (d.cash_gbp ?? 0),
    }))
  , [filtered])

  // Indexed % chart data — both portfolio and S&P start at 0%
  const indexedData = useMemo(() => {
    if (!filtered.length) return []
    const startValue = filtered[0].total_gbp_value
    const firstBm = benchmark.find(b => b.snapshot_date >= filtered[0].snapshot_date) ?? benchmark[0]

    return filtered.map(d => {
      const portfolioPct = startValue > 0 ? (d.total_gbp_value / startValue - 1) * 100 : 0
      const bm = [...benchmark].reverse().find(b => b.snapshot_date <= d.snapshot_date)
      const spyPct = bm && firstBm ? (bm.price_usd / firstBm.price_usd - 1) * 100 : undefined
      return { snapshot_date: d.snapshot_date, portfolio_pct: portfolioPct, spy_pct: spyPct }
    })
  }, [filtered, benchmark])

  // Summary returns for the selected range
  const summary = useMemo(() => {
    if (!indexedData.length) return null
    const last = indexedData[indexedData.length - 1]
    return { portfolio: last.portfolio_pct, spy: last.spy_pct ?? null }
  }, [indexedData])

  if (!data.length) {
    return (
      <div className="rounded-2xl p-5 border border-[var(--border)] bg-[var(--surface)]">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)] mb-4">Portfolio Value</p>
        <div className="h-64 flex items-center justify-center text-[var(--muted)] text-sm">No data yet</div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl p-5 border border-[var(--border)] bg-[var(--surface)]">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">
            {showBenchmark ? 'Return vs S&P 500' : 'Portfolio Value'}
          </p>
          {/* Return summary badges when benchmark is on */}
          {showBenchmark && summary && (
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[0.7rem] font-semibold bg-[rgba(79,142,255,0.12)] text-[#4f8eff]">
                Portfolio {formatPct(summary.portfolio)}
              </span>
              {summary.spy != null && (
                <span className="px-2 py-0.5 rounded text-[0.7rem] font-semibold bg-[rgba(167,139,250,0.12)] text-[#a78bfa]">
                  S&amp;P 500 {formatPct(summary.spy)}
                </span>
              )}
              {summary.spy != null && (
                <span className={`px-2 py-0.5 rounded text-[0.7rem] font-semibold ${
                  summary.portfolio >= summary.spy
                    ? 'bg-[rgba(31,196,138,0.12)] text-[#1fc48a]'
                    : 'bg-[rgba(242,107,107,0.12)] text-[#f26b6b]'
                }`}>
                  {summary.portfolio >= summary.spy ? '▲' : '▼'} {formatPct(summary.portfolio - summary.spy)} vs market
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Legend — only in normal mode */}
          {!showBenchmark && (
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[0.7rem] text-[var(--muted)]">
                <span className="inline-block w-6 h-0.5 bg-[#4f8eff]" />Total + Gains
              </span>
              <span className="flex items-center gap-1.5 text-[0.7rem] text-[var(--muted)]">
                <span className="inline-block w-6 h-0.5 bg-[#f5c142] opacity-70" style={{ borderTop: '2px dashed #f5c142' }} />Invested
              </span>
            </div>
          )}

          {/* Benchmark toggle */}
          <button
            onClick={() => setShowBenchmark(b => !b)}
            className={`px-3 py-1 rounded-full text-[0.72rem] font-semibold border transition-colors ${
              showBenchmark
                ? 'border-[#a78bfa] text-[#a78bfa]'
                : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            S&amp;P 500
          </button>

          {/* Range selector */}
          <div className="flex items-center gap-1">
            {RANGES.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2.5 py-1 rounded-md text-[0.72rem] font-semibold transition-colors ${
                  range === r ? 'bg-[var(--accent)] text-white' : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Indexed % chart when benchmark active */}
      {showBenchmark ? (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={indexedData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="snapshot_date" tickFormatter={formatDate} tick={{ fill: '#4e5d74', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={48} />
            <YAxis tickFormatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`} tick={{ fill: '#4e5d74', fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const port = payload.find(p => p.dataKey === 'portfolio_pct')?.value as number ?? 0
                const spy  = payload.find(p => p.dataKey === 'spy_pct')?.value as number | undefined
                return (
                  <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
                    <p style={{ color: 'var(--text)', marginBottom: 8, fontWeight: 600 }}>{formatDateLong(label)}</p>
                    <p style={{ color: '#4f8eff', marginBottom: 4 }}>Portfolio : {formatPct(port)}</p>
                    {spy != null && <p style={{ color: '#a78bfa', marginBottom: 4 }}>S&P 500 : {formatPct(spy)}</p>}
                    {spy != null && (
                      <p style={{ color: port >= spy ? '#1fc48a' : '#f26b6b', borderTop: '1px solid var(--border)', paddingTop: 6, fontWeight: 600 }}>
                        {formatPct(port - spy)} vs market
                      </p>
                    )}
                  </div>
                )
              }}
            />
            <Line type="monotone" dataKey="portfolio_pct" stroke="#4f8eff" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="spy_pct" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        /* Normal £ chart */
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={absoluteData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4f8eff" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#4f8eff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradInvested" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f5c142" stopOpacity={0.08} />
                <stop offset="95%" stopColor="#f5c142" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="snapshot_date" tickFormatter={formatDate} tick={{ fill: '#4e5d74', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={48} />
            <YAxis tickFormatter={formatGBP} tick={{ fill: '#4e5d74', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const value    = payload.find(p => p.dataKey === 'total_gbp_value')?.value as number ?? 0
                const invested = payload.find(p => p.dataKey === 'total_invested_gbp')?.value as number ?? 0
                const diff     = value - invested
                return (
                  <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
                    <p style={{ color: 'var(--text)', marginBottom: 8, fontWeight: 600 }}>{formatDateLong(label)}</p>
                    <p style={{ color: '#4f8eff', marginBottom: 4 }}>Total + Gains : {formatGBP(value)}</p>
                    <p style={{ color: '#f5c142', marginBottom: 6 }}>Invested : {formatGBP(invested)}</p>
                    <p style={{ color: diff >= 0 ? '#1fc48a' : '#f26b6b', borderTop: '1px solid var(--border)', paddingTop: 6, fontWeight: 600 }}>
                      {diff >= 0 ? '+' : ''}{formatGBP(diff)} unrealised
                    </p>
                  </div>
                )
              }}
            />
            <Area type="monotone" dataKey="total_gbp_value"    stroke="#4f8eff" strokeWidth={2}   fill="url(#gradValue)" />
            <Area type="monotone" dataKey="total_invested_gbp" stroke="#f5c142" strokeWidth={1.5} strokeDasharray="5 3" fill="url(#gradInvested)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
