import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { Position } from '../lib/supabase'
import { catColor, catBg, fmtGbp, fmtGbpShort } from '../constants'

interface Props { positions: Position[]; totalValue: number }

export default function AllocationChart({ positions, totalValue }: Props) {
  const byCategory = Object.entries(
    positions.reduce<Record<string, number>>((acc, p) => {
      const cat = p.category || 'Other'
      acc[cat] = (acc[cat] ?? 0) + p.gbp_value
      return acc
    }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const top5 = [...positions].sort((a, b) => b.gbp_value - a.gbp_value).slice(0, 5)
  const maxVal = top5[0]?.gbp_value ?? 1

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Donut */}
      <div className="rounded-2xl p-5 border border-[var(--border)] bg-[var(--surface)]">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)] mb-4">By Category</p>
        <div className="flex items-center gap-6">
          <div className="w-40 h-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={68}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {byCategory.map(entry => (
                    <Cell key={entry.name} fill={catColor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
                  formatter={(v: number) => [fmtGbp(v, 0), '']}
                  labelStyle={{ color: 'var(--text)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2 min-w-0">
            {byCategory.map(({ name, value }) => {
              const pct = totalValue > 0 ? (value / totalValue * 100).toFixed(1) : '0'
              return (
                <div key={name} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: catColor(name) }} />
                  <span className="text-[0.75rem] text-[var(--muted)] truncate">{name}</span>
                  <span className="text-[0.75rem] font-semibold ml-auto pl-2">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Top Holdings */}
      <div className="rounded-2xl p-5 border border-[var(--border)] bg-[var(--surface)]">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)] mb-4">Top Holdings</p>
        <div className="flex flex-col gap-3">
          {top5.map(p => {
            const pct = totalValue > 0 ? (p.gbp_value / totalValue * 100) : 0
            const barPct = (p.gbp_value / maxVal * 100).toFixed(1)
            const cat = p.category || 'Other'
            return (
              <div key={p.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-1.5 py-0.5 rounded text-[0.65rem] font-semibold"
                      style={{ background: catBg(cat), color: catColor(cat) }}
                    >
                      {cat}
                    </span>
                    <span className="text-[0.82rem] font-semibold">{p.ticker}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[0.82rem] font-semibold">{fmtGbpShort(p.gbp_value)}</span>
                    <span className="text-[0.72rem] text-[var(--muted)] ml-1">{pct.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--surface2)]">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{ width: `${barPct}%`, background: catColor(cat) }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
