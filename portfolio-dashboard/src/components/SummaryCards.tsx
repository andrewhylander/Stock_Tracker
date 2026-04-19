import type { PortfolioDaily, Position } from '../lib/supabase'
import { fmtGbp, plClass, plSign } from '../constants'

interface Props {
  latest: PortfolioDaily | null
  positions: Position[]
}

function Card({ label, value, sub, valueClass = 'text-[#4f8eff]', subClass = '' }: {
  label: string; value: string; sub?: string; valueClass?: string; subClass?: string
}) {
  return (
    <div className="rounded-2xl p-5 border border-[var(--border)] bg-[var(--surface)] hover:border-white/10 transition-colors">
      <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">{label}</p>
      <p className={`text-[1.75rem] font-bold leading-none tracking-tight ${valueClass}`}>{value}</p>
      {sub && <p className={`text-[0.75rem] mt-2 ${subClass || 'text-[var(--muted)]'}`}>{sub}</p>}
    </div>
  )
}

function Skeleton() {
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] h-28 animate-pulse" />
}

export default function SummaryCards({ latest, positions }: Props) {
  if (!latest && !positions.length) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} />)}
      </div>
    )
  }

  const totalValue   = latest?.total_gbp_value   ?? positions.reduce((s, p) => s + p.gbp_value, 0)
  const pl           = latest?.total_unrealised_pl ?? positions.reduce((s, p) => s + p.unrealised_pl, 0)
  const invested     = latest?.invested_gbp        ?? (totalValue - pl)
  const plPct        = latest?.total_unrealised_pl_pct
    ?? (invested > 0 ? (pl / invested * 100) : 0)

  const totalDiv  = positions.reduce((s, p) => s + (p.dividend || 0), 0)
  const yieldPct  = totalValue > 0 ? (totalDiv / totalValue * 100).toFixed(2) : '0.00'
  const investPct = totalValue > 0 ? (invested / totalValue * 100).toFixed(1) : '0'

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card
        label="Portfolio Value"
        value={fmtGbp(totalValue)}
        sub={`${positions.length} positions`}
        valueClass="text-[#4f8eff]"
      />
      <Card
        label="Unrealised P&L"
        value={`${plSign(pl)}${fmtGbp(pl)}`}
        sub={`${plSign(plPct)}${plPct.toFixed(2)}%`}
        valueClass={plClass(pl)}
        subClass={plClass(pl)}
      />
      <Card
        label="Invested"
        value={fmtGbp(invested)}
        sub={`${investPct}% deployed`}
        valueClass="text-[var(--text)]"
      />
      <Card
        label="Annual Dividends"
        value={fmtGbp(totalDiv)}
        sub={`${yieldPct}% portfolio yield`}
        valueClass="text-[#f5c142]"
      />
    </div>
  )
}
