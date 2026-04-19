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
  if (!latest) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} />)}
      </div>
    )
  }

  const pl = latest.total_unrealised_pl
  const plPct = latest.total_unrealised_pl_pct
  const totalDiv = positions.reduce((s, p) => s + (p.dividend || 0), 0)
  const yieldPct = latest.total_gbp_value > 0 ? (totalDiv / latest.total_gbp_value * 100).toFixed(2) : '0.00'
  const investPct = latest.total_gbp_value > 0
    ? (latest.invested_gbp / latest.total_gbp_value * 100).toFixed(1)
    : '0'

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card
        label="Portfolio Value"
        value={fmtGbp(latest.total_gbp_value)}
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
        value={fmtGbp(latest.invested_gbp)}
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
