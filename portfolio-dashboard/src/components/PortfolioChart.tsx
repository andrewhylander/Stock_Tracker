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
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Portfolio Value Over Time</h2>
        <div className="h-64 flex items-center justify-center text-gray-500">No data yet</div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-white mb-4">Portfolio Value Over Time</h2>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="snapshot_date"
            tickFormatter={formatDate}
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatGBP}
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
            labelStyle={{ color: '#d1d5db' }}
            formatter={(v: number) => [formatGBP(v), 'Value']}
            labelFormatter={formatDate}
          />
          <Area
            type="monotone"
            dataKey="total_gbp_value"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#grad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
