import type { HoldingDividend } from '../lib/dividends'
import { fmtGbp } from '../constants'

interface Props { rows: HoldingDividend[] }

export default function DividendHeader({ rows }: Props) {
  const annual    = rows.reduce((s, r) => s + r.annualIncome, 0)
  const value     = rows.reduce((s, r) => s + r.marketValue, 0)
  const costBasis = rows.reduce((s, r) => s + r.costBasis, 0)
  const anyAdjusted = rows.some((r) => r.adjusted && r.annualIncome > 0)

  const yieldPct = value > 0 ? (annual / value) * 100 : 0
  const yocPct   = costBasis > 0 ? (annual / costBasis) * 100 : 0

  return (
    <div className="rounded-2xl p-6 border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-baseline gap-3 flex-wrap">
        <p className="text-[2.5rem] font-bold leading-none tracking-tight text-[var(--gold)]">
          {fmtGbp(annual)}
        </p>
        <p className="text-[0.8rem] text-[var(--muted)]">Annual dividends (forward rate)</p>
      </div>

      <div className="flex items-center gap-8 mt-5 flex-wrap">
        <Stat value={fmtGbp(annual / 12)} label="Monthly" />
        <Stat value={fmtGbp(annual / 365)} label="Daily" />
        <Stat value={fmtGbp(annual / 365 / 24)} label="Hourly" />
        <Stat value={`${yieldPct.toFixed(2)}%`} label="Yield" />
        <Stat value={`${yocPct.toFixed(2)}%`} label="Yield on cost" accent />
      </div>

      <p className="text-[0.7rem] text-[var(--muted)] mt-5 pt-4 border-t border-[var(--border)]">
        Each holding at its current declared rate where it pays a steady one, otherwise its
        last twelve months. Valued at the shares you hold today.
        {anyAdjusted && (
          <> Yields are against full market value, so scheme-held shares stay comparable
          with the rest — these will not tie back to the Overview total.</>
        )}
      </p>
    </div>
  )
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <p className={`text-[1.1rem] font-bold leading-none ${accent ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>
        {value}
      </p>
      <p className="text-[0.7rem] text-[var(--muted)] mt-1.5">{label}</p>
    </div>
  )
}
