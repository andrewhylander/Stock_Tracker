import type { Position } from '../lib/supabase'
import { fmtGbpShort } from '../constants'

interface Props { positions: Position[] }

export default function SectorBreakdown({ positions }: Props) {
  const bySector = Object.entries(
    positions.reduce<Record<string, number>>((acc, p) => {
      const sector = p.sector || 'Other'
      acc[sector] = (acc[sector] ?? 0) + p.gbp_value
      return acc
    }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  if (!bySector.length) return null

  const maxVal = bySector[0].value

  return (
    <div className="rounded-2xl p-5 border border-[var(--border)] bg-[var(--surface)]">
      <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)] mb-4">Sector Breakdown</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
        {bySector.map(({ name, value }) => {
          const barPct = (value / maxVal * 100).toFixed(1)
          return (
            <div key={name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[0.78rem] text-[var(--muted)]">{name}</span>
                <span className="text-[0.78rem] font-semibold">{fmtGbpShort(value)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--surface2)]">
                <div
                  className="h-1.5 rounded-full bg-[var(--accent)] transition-all"
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
