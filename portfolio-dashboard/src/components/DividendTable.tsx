import { useState } from 'react'
import type { HoldingDividend } from '../lib/dividends'
import { fmtGbp, catColor, catBg } from '../constants'

interface Props { rows: HoldingDividend[] }

type SortKey = 'annualIncome' | 'yieldPct' | 'yieldOnCostPct' | 'ticker'

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

export default function DividendTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('annualIncome')
  const [sortAsc, setSortAsc] = useState(false)
  const [hideZero, setHideZero] = useState(true)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const visible = rows.filter(r => !hideZero || r.annualIncome > 0)
  const sorted = visible.slice().sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey]
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
    return sortAsc ? cmp : -cmp
  })

  const payersHidden = rows.length - visible.length

  function Th({ label, k, right }: { label: string; k: SortKey; right?: boolean }) {
    const active = sortKey === k
    return (
      <th
        className={`px-3 py-3 text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)] cursor-pointer select-none hover:text-[var(--text)] ${right ? 'text-right' : 'text-left'}`}
        onClick={() => toggleSort(k)}
      >
        {label}{active ? (sortAsc ? ' ↑' : ' ↓') : ''}
      </th>
    )
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 flex-wrap gap-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">
          Dividend payers
        </p>
        {payersHidden > 0 && (
          <button
            onClick={() => setHideZero(h => !h)}
            className="px-3 py-1 rounded-full text-[0.72rem] font-semibold border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
          >
            {hideZero ? `Show ${payersHidden} non-paying` : 'Hide non-paying'}
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="px-5 pb-6 text-[var(--muted)] text-sm">
          No dividend history loaded yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-y border-[var(--border)]">
                <Th label="Holding" k="ticker" />
                <th className="px-3 py-3 text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)] text-center">
                  Paid in
                </th>
                <Th label="Yield" k="yieldPct" right />
                <Th label="On cost" k="yieldOnCostPct" right />
                <Th label="Annual" k="annualIncome" right />
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.ticker} className="border-b border-[var(--border)] last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="px-2 py-0.5 rounded text-[0.65rem] font-semibold"
                        style={{ color: catColor(r.category), background: catBg(r.category) }}
                      >
                        {r.category}
                      </span>
                      <span className="text-[0.82rem] font-semibold">{r.ticker}</span>
                    </div>
                    <p className="text-[0.7rem] text-[var(--muted)] mt-1">
                      {r.shares.toLocaleString('en-GB', { maximumFractionDigits: 2 })} shares
                    </p>
                  </td>

                  <td className="px-3 py-3">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex items-end justify-center gap-1.5">
                        {r.quarters.map((count, i) => (
                          <div key={i} className="flex flex-col items-center gap-1">
                            {/* One mark per payment, so a quarter carrying two
                                does not look like a quarter carrying one. */}
                            <div className="flex items-end gap-[2px] h-[1.15rem]">
                              {count > 0 ? (
                                Array.from({ length: count }).map((_, j) => (
                                  <span
                                    key={j}
                                    title={`${QUARTERS[i]} — ${count} payment${count > 1 ? 's' : ''}`}
                                    className="w-2 h-full rounded-sm"
                                    style={{ background: 'var(--gold)' }}
                                  />
                                ))
                              ) : (
                                <span
                                  title={`${QUARTERS[i]} — no payment`}
                                  className="w-2 h-2 rounded-sm self-end"
                                  style={{ background: 'rgba(255,255,255,0.08)' }}
                                />
                              )}
                            </div>
                            <span className="text-[0.55rem] text-[var(--muted)] leading-none">
                              {QUARTERS[i]}
                            </span>
                          </div>
                        ))}
                      </div>
                      {r.paymentsPerYear > 0 && (
                        <span className="text-[0.6rem] text-[var(--muted)]">
                          {r.paymentsPerYear}&times; a year
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-3 py-3 text-right text-[0.82rem] tabular-nums">
                    {r.yieldPct.toFixed(2)}%
                  </td>
                  <td className="px-3 py-3 text-right text-[0.82rem] tabular-nums text-[var(--accent)]">
                    {r.yieldOnCostPct.toFixed(2)}%
                  </td>
                  <td className="px-3 py-3 text-right text-[0.82rem] font-semibold tabular-nums text-[var(--gold)]">
                    {fmtGbp(r.annualIncome)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
