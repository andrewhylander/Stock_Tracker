import type { PortfolioDaily } from '../lib/supabase'

interface Props {
  data: PortfolioDaily | null
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

interface CardProps {
  label: string
  value: string
  sub?: string
  positive?: boolean | null
}

function Card({ label, value, sub, positive }: CardProps) {
  const subColor =
    positive === null || positive === undefined
      ? 'text-gray-400'
      : positive
      ? 'text-emerald-400'
      : 'text-red-400'

  return (
    <div className="bg-gray-800 rounded-xl p-5 flex flex-col gap-1">
      <span className="text-xs uppercase tracking-widest text-gray-400">{label}</span>
      <span className="text-2xl font-semibold text-white">{value}</span>
      {sub && <span className={`text-sm font-medium ${subColor}`}>{sub}</span>}
    </div>
  )
}

export default function SummaryCards({ data }: Props) {
  if (!data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-800 rounded-xl p-5 h-24 animate-pulse" />
        ))}
      </div>
    )
  }

  const pl = data.total_unrealised_pl
  const plPct = data.total_unrealised_pl_pct

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card label="Portfolio Value" value={`£${fmt(data.total_gbp_value)}`} />
      <Card
        label="Unrealised P&L"
        value={`${pl >= 0 ? '+' : ''}£${fmt(pl)}`}
        sub={`${plPct >= 0 ? '+' : ''}${fmt(plPct)}%`}
        positive={pl >= 0}
      />
      <Card label="Invested" value={`£${fmt(data.invested_gbp)}`} />
      <Card label="Last Updated" value={data.snapshot_date} sub="daily at 22:00 UTC" positive={null} />
    </div>
  )
}
