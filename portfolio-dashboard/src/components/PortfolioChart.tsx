import { useState, useMemo } from 'react'
import {
  ResponsiveContainer, AreaChart, Area,
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

export default function PortfolioChart({ data, benchmark }: Props) {
  const [range, setRange]                 = useState<Range>('All')
  const [showBenchmark, setShowBenchmark] = useState(false)

  // Filter portfolio data by range
  const filtered = useMemo(() => {
    const c = cutoff(range)
    return c ? data.filter(d => new Date(d.snapshot_date) >= c) : data
  }, [data, range])

  // Merge benchmark into chart rows (normalised to portfolio starting value)
  const chartData = useMemo(() => {
    if (!benchmark.length || !filtered.length) {
      return filtered.map(d => ({ ...d, total_invested_gbp: (d.invested_gbp ?? 0) + (d.cash_gbp ?? 0), benchmark_value: undefined }))
    }
    const firstPortfolioValue = filtered[0].total_gbp_value
    const firstBm = benchmark.find(b => b.snapshot_date >= filtered[0].snapshot_date) ?? benchmark[0]
    const scale = firstPortfolioValue / firstBm.price_usd

    return filtered.map(d => {
      const bm = [...benchmark].reverse().find(b => b.snapshot_date <= d.snapshot_date)
      return {
        ...d,
        total_invested_gbp: (d.invested_gbp ?? 0) + (d.cash_gbp ?? 0),
        benchmark_value: bm ? bm.price_usd * scale : undefined,
      }
    })
  }, [filtered, benchmark])

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
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">Portfolio Value</p>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Legend */}
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-[0.7rem] text-[var(--muted)]">
              <span className="inline-block w-6 h-0.5 bg-[#4f8eff]" />Total + Gains
            </span>
            <span className="flex items-center gap-1.5 text-[0.7rem] text-[var(--muted)]">
              <span className="inline-block w-6 h-0.5 bg-[#f5c142] opacity-70" style={{ borderTop: '2px dashed #f5c142' }} />Invested
            </span>
            {showBenchmark && (
              <span className="flex items-center gap-1.5 text-[0.7rem] text-[var(--muted)]">
                <span className="inline-block w-6 h-0.5 bg-[#a78bfa] opacity-70" style={{ borderTop: '2px dashed #a78bfa' }} />S&amp;P 500
              </span>
            )}
          </div>

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
                  range === r
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
          <XAxis
            dataKey="snapshot_date"
            tickFormatter={formatDate}
            tick={{ fill: '#4e5d74', fontSize: 11 }}
            axisLine={false} tickLine={false} minTickGap={48}
          />
          <YAxis
            tickFormatter={formatGBP}
            tick={{ fill: '#4e5d74', fontSize: 11 }}
            axisLine={false} tickLine={false} width={80}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const value    = payload.find(p => p.dataKey === 'total_gbp_value')?.value as number ?? 0
              const invested = payload.find(p => p.dataKey === 'total_invested_gbp')?.value as number ?? 0
              const bm       = payload.find(p => p.dataKey === 'benchmark_value')?.value as number | undefined
              const diff     = value - invested
              return (
                <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
                  <p style={{ color: 'var(--text)', marginBottom: 8, fontWeight: 600 }}>{formatDateLong(label)}</p>
                  <p style={{ color: '#4f8eff', marginBottom: 4 }}>Total + Gains : {formatGBP(value)}</p>
                  <p style={{ color: '#f5c142', marginBottom: bm != null ? 4 : 6 }}>Invested : {formatGBP(invested)}</p>
                  {bm != null && (
                    <p style={{ color: '#a78bfa', marginBottom: 6 }}>S&P 500 equiv : {formatGBP(bm)}</p>
                  )}
                  <p style={{ color: diff >= 0 ? '#1fc48a' : '#f26b6b', borderTop: '1px solid var(--border)', paddingTop: 6, fontWeight: 600 }}>
                    {diff >= 0 ? '+' : ''}{formatGBP(diff)} unrealised
                  </p>
                </div>
              )
            }}
          />
          <Area type="monotone" dataKey="total_gbp_value"    stroke="#4f8eff" strokeWidth={2}   fill="url(#gradValue)" />
          <Area type="monotone" dataKey="total_invested_gbp" stroke="#f5c142" strokeWidth={1.5} strokeDasharray="5 3" fill="url(#gradInvested)" />
          {showBenchmark && (
            <Area type="monotone" dataKey="benchmark_value" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4 3" fill="none" connectNulls />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
