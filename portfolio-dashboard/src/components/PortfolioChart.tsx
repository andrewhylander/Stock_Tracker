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
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
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
      <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)] mb-4">Portfolio Value</p>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4f8eff" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#4f8eff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="snapshot_date"
            tickFormatter={formatDate}
            tick={{ fill: '#4e5d74', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatGBP}
            tick={{ fill: '#4e5d74', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip
            contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: 'var(--text)' }}
            formatter={(v: number) => [formatGBP(v), 'Value']}
            labelFormatter={formatDate}
          />
          <Area
            type="monotone"
            dataKey="total_gbp_value"
            stroke="#4f8eff"
            strokeWidth={2}
            fill="url(#grad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
