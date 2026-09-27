import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts'
import type { DividendPayment } from '../lib/supabase'
import type { Holding } from '../lib/dividends'
import { monthlyIncome, cumulative, yearsCovered } from '../lib/dividends'
import { fmtGbp, fmtGbpShort } from '../constants'

interface Props {
  payments: DividendPayment[]     // actual + projected, already merged
  holdings: Map<string, Holding>
}

export default function DividendChart({ payments, holdings }: Props) {
  const years = useMemo(() => yearsCovered(payments), [payments])
  const [year, setYear] = useState(() => new Date().getFullYear())

  const data = useMemo(() => {
    const buckets = monthlyIncome(payments, holdings, year)
    const cum = cumulative(buckets)
    return buckets.map((b, i) => ({ ...b, cumulative: cum[i] }))
  }, [payments, holdings, year])

  const total          = data.reduce((s, d) => s + d.total, 0)
  const projectedTotal = data.reduce((s, d) => s + d.projected, 0)
  const hasAny         = data.some(d => d.total > 0)

  return (
    <div className="rounded-2xl p-5 border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-baseline gap-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">
            Income by month
          </p>
          {/* Say which year this totals. It sits under a headline showing the
              forward annual rate, and the two are different measures. */}
          <span className="text-[0.8rem] font-bold text-[var(--gold)]">
            {year} total {fmtGbp(total)}
          </span>
          {projectedTotal > 0 && (
            <span className="text-[0.7rem] text-[var(--muted)]">
              incl. {fmtGbp(projectedTotal)} projected
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {years.map(y => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-2.5 py-1 rounded-md text-[0.72rem] font-semibold transition-colors ${
                year === y ? 'bg-[var(--gold)] text-black' : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {hasAny ? (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#4e5d74', fontSize: 11 }} axisLine={false} tickLine={false} />
              {/* Separate scales. Sharing one axis let the cumulative total,
                  an order of magnitude larger than any single month, stretch
                  the range so the bars sat squashed along the bottom. */}
              <YAxis
                yAxisId="month"
                tickFormatter={v => (v ? fmtGbpShort(v) : '£0')}
                tick={{ fill: '#4e5d74', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={64}
              />
              <YAxis
                yAxisId="cumulative"
                orientation="right"
                tickFormatter={v => (v ? fmtGbpShort(v) : '')}
                tick={{ fill: '#8a6d2f', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as typeof data[number]
                  if (!d.total) return null
                  return (
                    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
                      <p style={{ color: 'var(--text)', marginBottom: 8, fontWeight: 600 }}>{label} {year}</p>
                      {d.actual > 0 && <p style={{ color: '#f5c142', marginBottom: 4 }}>Received : {fmtGbp(d.actual)}</p>}
                      {d.projected > 0 && <p style={{ color: '#8a6d2f', marginBottom: 4 }}>Projected : {fmtGbp(d.projected)}</p>}
                      <p style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                        Year to date : {fmtGbp(d.cumulative)}
                      </p>
                    </div>
                  )
                }}
              />
              <Bar yAxisId="month" dataKey="total" radius={[5, 5, 0, 0]} maxBarSize={52}>
                {data.map((d, i) => (
                  // A month that is wholly projected reads as an outline; a
                  // part-projected month stays solid rather than lying either way.
                  <Cell
                    key={i}
                    fill={d.actual > 0 ? '#f5c142' : 'rgba(245,193,66,0.18)'}
                    stroke={d.actual > 0 ? undefined : '#f5c142'}
                    strokeDasharray={d.actual > 0 ? undefined : '3 2'}
                  />
                ))}
              </Bar>
              <Line
                yAxisId="cumulative"
                type="monotone"
                dataKey="cumulative"
                stroke="#8a6d2f"
                strokeWidth={1.5}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>

          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <Legend swatch={<span className="inline-block w-3 h-3 rounded-sm bg-[var(--gold)]" />} text="Received" />
            <Legend swatch={<span className="inline-block w-3 h-3 rounded-sm border border-dashed border-[var(--gold)]" />} text="Projected" />
            <Legend swatch={<span className="inline-block w-5 h-0.5 bg-[#8a6d2f]" />} text="Cumulative" />
          </div>
        </>
      ) : (
        <div className="h-64 flex items-center justify-center text-[var(--muted)] text-sm">
          No dividend history for {year} yet
        </div>
      )}

      <p className="text-[0.7rem] text-[var(--muted)] mt-4 pt-3 border-t border-[var(--border)]">
        Months are <strong className="text-[var(--text)] font-semibold">payment dates</strong> — when
        the cash lands. US holdings carry the declared date; LSE holdings derive theirs from each
        holding's published ex-to-pay gap, verified against past payments. Anything without either
        falls back to its ex-dividend date.
      </p>
    </div>
  )
}

function Legend({ swatch, text }: { swatch: React.ReactNode; text: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[0.7rem] text-[var(--muted)]">
      {swatch}{text}
    </span>
  )
}
