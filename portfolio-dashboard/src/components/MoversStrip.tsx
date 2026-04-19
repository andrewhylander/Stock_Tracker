import type { Position } from '../lib/supabase'
import { fmtGbp, plSign } from '../constants'

interface Props { positions: Position[]; totalValue: number }

export default function MoversStrip({ positions, totalValue }: Props) {
  if (!positions.length) return null

  const ranked = [...positions].filter(p => p.unrealised_pl_pct != null && p.category !== 'Cash')
  const best  = [...ranked].sort((a, b) => b.unrealised_pl_pct - a.unrealised_pl_pct)[0]
  const worst = [...ranked].filter(p => p.ticker !== 'FUBO').sort((a, b) => a.unrealised_pl_pct - b.unrealised_pl_pct)[0]
  const top   = [...positions].filter(p => p.category !== 'Cash').sort((a, b) => b.gbp_value - a.gbp_value)[0]

  if (!best || !worst || !top) return null

  function MoverCard({
    label, ticker, detail, delta, deltaPositive,
  }: { label: string; ticker: string; detail: string; delta: string; deltaPositive: boolean | null }) {
    const cls = deltaPositive === null
      ? 'bg-[var(--surface2)] text-[var(--muted)]'
      : deltaPositive
      ? 'bg-[rgba(31,196,138,0.1)] text-[#1fc48a]'
      : 'bg-[rgba(242,107,107,0.1)] text-[#f26b6b]'

    return (
      <div className="rounded-2xl p-5 border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">{label}</p>
        <p className="text-[1.3rem] font-bold tracking-wide">{ticker}</p>
        <p className="text-[0.78rem] text-[var(--muted)]">{detail}</p>
        <span className={`self-start px-2 py-0.5 rounded-md text-[0.82rem] font-semibold ${cls}`}>{delta}</span>
      </div>
    )
  }

  const topWeight = totalValue > 0 ? (top.gbp_value / totalValue * 100).toFixed(1) : '0'

  return (
    <div className="grid grid-cols-3 gap-4">
      <MoverCard
        label="🏆 Best position"
        ticker={best.ticker}
        detail={`${fmtGbp(best.gbp_value, 0)} · ${plSign(best.unrealised_pl)}${fmtGbp(best.unrealised_pl)} P&L`}
        delta={`${plSign(best.unrealised_pl_pct)}${best.unrealised_pl_pct.toFixed(2)}%`}
        deltaPositive={true}
      />
      <MoverCard
        label="📉 Worst position"
        ticker={worst.ticker}
        detail={`${fmtGbp(worst.gbp_value, 0)} · ${plSign(worst.unrealised_pl)}${fmtGbp(worst.unrealised_pl)} P&L`}
        delta={`${plSign(worst.unrealised_pl_pct)}${worst.unrealised_pl_pct.toFixed(2)}%`}
        deltaPositive={false}
      />
      <MoverCard
        label="💼 Largest position"
        ticker={top.ticker}
        detail={`${fmtGbp(top.gbp_value, 0)} · ${top.sector || top.category}`}
        delta={`${topWeight}% of portfolio`}
        deltaPositive={null}
      />
    </div>
  )
}
