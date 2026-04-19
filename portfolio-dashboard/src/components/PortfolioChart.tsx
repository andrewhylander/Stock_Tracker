import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import type { PortfolioDaily } from '../lib/supabase'

interface Props {
  data: PortfolioDaily[]
}

function formatDate(d: string) {
  const dt = new Date(d)
  return dt.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}

function formatDateLong(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatGBP(v: number) {
  return `£${v.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
}

export default function PortfolioChart({ data }: Props) {
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
      <div className="flex items-center justify-between mb-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">Portfolio Value</p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[0.7rem] text-[var(--muted)]">
            <span className="inline-block w-6 h-0.5 bg-[#4f8eff]" />Total + Gains
          </span>
          <span className="flex items-center gap-1.5 text-[0.7rem] text-[var(--muted)]">
            <span className="inline-block w-6 h-0.5 bg-[#f5c142] opacity-70" style={{ borderTop: '2px dashed #f5c142' }} />Invested
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4f8eff" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#4f8eff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradInvested" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f5c142" stopOpacity={0.08} />
              <stop offset="95%" stopColor="#f5c142" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="snapshot_date"
            tickFormatter={formatDate}
            tick={{ fill: '#4e5d74', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={48}
          />
          <YAxis
            tickFormatter={formatGBP}
            tick={{ fill: '#4e5d74', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const value    = payload.find(p => p.dataKey === 'total_gbp_value')?.value as number ?? 0
              const invested = payload.find(p => p.dataKey === 'invested_gbp')?.value as number ?? 0
              const diff     = value - invested
              const diffPos  = diff >= 0
              return (
                <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
                  <p style={{ color: 'var(--text)', marginBottom: 8, fontWeight: 600 }}>{formatDateLong(label)}</p>
                  <p style={{ color: '#4f8eff', marginBottom: 4 }}>Total + Gains : {formatGBP(value)}</p>
                  <p style={{ color: '#f5c142', marginBottom: 6 }}>Invested : {formatGBP(invested)}</p>
                  <p style={{ color: diffPos ? '#1fc48a' : '#f26b6b', borderTop: '1px solid var(--border)', paddingTop: 6, fontWeight: 600 }}>
                    {diffPos ? '+' : ''}{formatGBP(diff)} unrealised
                  </p>
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="total_gbp_value"
            stroke="#4f8eff"
            strokeWidth={2}
            fill="url(#gradValue)"
          />
          <Area
            type="monotone"
            dataKey="invested_gbp"
            stroke="#f5c142"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            fill="url(#gradInvested)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
