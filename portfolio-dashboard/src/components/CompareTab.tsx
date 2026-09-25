import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { SnapshotRow } from '../lib/supabase'
import { fmtGbp, plClass, plSign, catColor, catBg } from '../constants'

interface AggregatedSnapshot {
  ticker: string
  category: string
  gbp_value: number
  unrealised_pl: number
  invested: number
}

interface CompareRow {
  ticker: string
  category: string
  startValue: number
  endValue: number
  startPl: number
  endPl: number
  startInvested: number
  endInvested: number
  valueChange: number
  plChange: number
  extraInvested: number
  status: 'active' | 'exited' | 'new'
}

async function fetchSnapshot(date: string): Promise<AggregatedSnapshot[]> {
  const { data, error } = await supabase
    .from('position_snapshots')
    .select('ticker, category, gbp_value, unrealised_pl')
    .eq('snapshot_date', date)
  if (error) throw error
  const map: Record<string, AggregatedSnapshot> = {}
  for (const row of (data ?? []) as SnapshotRow[]) {
    if (!map[row.ticker]) {
      map[row.ticker] = { ticker: row.ticker, category: row.category, gbp_value: 0, unrealised_pl: 0, invested: 0 }
    }
    map[row.ticker].gbp_value     += row.gbp_value
    map[row.ticker].unrealised_pl += row.unrealised_pl
  }
  for (const agg of Object.values(map)) {
    agg.invested = agg.gbp_value - agg.unrealised_pl
  }
  return Object.values(map)
}

function buildRows(
  startSnaps: AggregatedSnapshot[],
  endSnaps: AggregatedSnapshot[]
): { equity: CompareRow[]; cash: CompareRow[] } {
  const startMap = Object.fromEntries(startSnaps.map(s => [s.ticker, s]))
  const endMap   = Object.fromEntries(endSnaps.map(s => [s.ticker, s]))
  const allTickers = [...new Set([...Object.keys(startMap), ...Object.keys(endMap)])]

  const equity: CompareRow[] = []
  const cash:   CompareRow[] = []

  for (const ticker of allTickers) {
    const s = startMap[ticker]
    const e = endMap[ticker]
    const startValue    = s?.gbp_value     ?? 0
    const endValue      = e?.gbp_value     ?? 0
    const startPl       = s?.unrealised_pl ?? 0
    const endPl         = e?.unrealised_pl ?? 0
    const startInvested = s?.invested      ?? 0
    const endInvested   = e?.invested      ?? 0
    const plChange      = endPl - startPl
    const extraInvested = endInvested - startInvested
    const valueChange   = endValue - startValue
    const status: CompareRow['status'] = !s ? 'new' : !e ? 'exited' : 'active'
    const category = (e?.category ?? s?.category ?? 'Other').trim()
    const row: CompareRow = {
      ticker, category,
      startValue, endValue, startPl, endPl,
      startInvested, endInvested,
      valueChange, plChange, extraInvested, status,
    }
    if (category === 'Cash') cash.push(row)
    else equity.push(row)
  }

  equity.sort((a, b) => Math.abs(b.plChange) - Math.abs(a.plChange))
  return { equity, cash }
}

function fmtDelta(n: number, hideSmall = false) {
  if (hideSmall && Math.abs(n) < 50) return <span className="text-[var(--muted)]">—</span>
  return (
    <span className={plClass(n)}>
      {plSign(n)}{fmtGbp(n)}
    </span>
  )
}

function CategoryBadge({ cat }: { cat: string }) {
  return (
    <span
      className="text-[0.65rem] font-semibold px-1.5 py-0.5 rounded"
      style={{ background: catBg(cat), color: catColor(cat) }}
    >
      {cat}
    </span>
  )
}

function StatusBadge({ status }: { status: CompareRow['status'] }) {
  if (status === 'active') return null
  const label = status === 'new' ? 'New' : 'Exited'
  const color = status === 'new' ? '#1fc48a' : '#f26b6b'
  return (
    <span
      className="text-[0.6rem] font-semibold px-1 py-0.5 rounded ml-1"
      style={{ background: `${color}22`, color }}
    >
      {label}
    </span>
  )
}

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={`pb-2 text-[0.62rem] font-semibold uppercase tracking-widest text-[var(--muted)] whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
    {children}
  </th>
)

export default function CompareTab() {
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [startDate, setStartDate]           = useState('')
  const [endDate, setEndDate]               = useState('')
  const [equityRows, setEquityRows]         = useState<CompareRow[]>([])
  const [cashRows, setCashRows]             = useState<CompareRow[]>([])
  const [datesLoading, setDatesLoading]     = useState(true)
  const [comparing, setComparing]           = useState(false)
  const [hasResult, setHasResult]           = useState(false)
  const [error, setError]                   = useState<string | null>(null)

  useEffect(() => {
    async function loadDates() {
      try {
        const { data, error } = await supabase
          .from('position_snapshots')
          .select('snapshot_date')
          .order('snapshot_date', { ascending: false })
        if (error) throw error
        const dates = [...new Set((data ?? []).map((r: { snapshot_date: string }) => r.snapshot_date))] as string[]
        setAvailableDates(dates)
        if (dates.length >= 2) {
          setEndDate(dates[0])
          setStartDate(dates[dates.length - 1])
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load dates')
      } finally {
        setDatesLoading(false)
      }
    }
    loadDates()
  }, [])

  async function handleCompare() {
    if (!startDate || !endDate) return
    setComparing(true)
    setError(null)
    try {
      const [startSnaps, endSnaps] = await Promise.all([
        fetchSnapshot(startDate),
        fetchSnapshot(endDate),
      ])
      const { equity, cash } = buildRows(startSnaps, endSnaps)
      setEquityRows(equity)
      setCashRows(cash)
      setHasResult(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to compare')
    } finally {
      setComparing(false)
    }
  }

  const totalValueChange   = equityRows.reduce((s, r) => s + r.valueChange, 0)
  const totalPlChange      = equityRows.reduce((s, r) => s + r.plChange, 0)
  const totalExtraInvested = equityRows.reduce((s, r) => s + r.extraInvested, 0)

  const selectClass = `px-3 py-2 rounded-lg bg-[var(--surface2)] border border-[var(--border)]
    text-[0.82rem] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] cursor-pointer`

  return (
    <div className="space-y-5">

      {/* Date picker panel */}
      <div className="rounded-2xl p-5 border border-[var(--border)] bg-[var(--surface)]">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)] mb-4">
          Select Date Range
        </p>
        {datesLoading ? (
          <div className="flex gap-4">
            <div className="h-9 w-40 rounded-lg bg-[var(--surface2)] animate-pulse" />
            <div className="h-9 w-40 rounded-lg bg-[var(--surface2)] animate-pulse" />
            <div className="h-9 w-24 rounded-lg bg-[var(--surface2)] animate-pulse" />
          </div>
        ) : (
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.72rem] text-[var(--muted)]">Start Date</label>
              <select
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className={selectClass}
              >
                {availableDates
                  .filter(d => !endDate || d < endDate)
                  .map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.72rem] text-[var(--muted)]">End Date</label>
              <select
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className={selectClass}
              >
                {availableDates
                  .filter(d => !startDate || d > startDate)
                  .map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <button
              disabled={!startDate || !endDate || comparing}
              onClick={handleCompare}
              className="px-5 py-2 rounded-lg bg-[var(--accent)] text-white text-[0.82rem] font-semibold
                         disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {comparing ? 'Loading…' : 'Compare'}
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl p-4 text-[0.82rem] border"
          style={{ background: 'rgba(242,107,107,0.08)', borderColor: 'rgba(242,107,107,0.3)', color: '#f26b6b' }}>
          {error}
        </div>
      )}

      {/* Results */}
      {hasResult && !comparing && (
        <>
          {/* Equity comparison table */}
          <div className="rounded-2xl p-5 border border-[var(--border)] bg-[var(--surface)]">
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)] mb-4">
              Position Comparison — {startDate} → {endDate}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-0.5 text-[0.82rem]">
                <thead>
                  <tr>
                    <TH>Ticker</TH>
                    <TH>Category</TH>
                    <TH right>Start</TH>
                    <TH right>End</TH>
                    <TH right>Value Δ</TH>
                    <TH right>Extra Invested</TH>
                    <TH right>P&amp;L Δ</TH>
                  </tr>
                </thead>
                <tbody>
                  {equityRows.map(row => (
                    <tr key={row.ticker} className="hover:bg-[var(--surface2)] transition-colors">
                      <td className="py-2 pr-4 font-semibold text-[var(--text)] whitespace-nowrap">
                        {row.ticker}
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        <CategoryBadge cat={row.category} />
                      </td>
                      <td className="py-2 pr-4 text-right text-[var(--muted)] whitespace-nowrap">
                        {row.startValue ? fmtGbp(row.startValue) : '—'}
                      </td>
                      <td className="py-2 pr-4 text-right text-[var(--text)] whitespace-nowrap">
                        {row.endValue ? fmtGbp(row.endValue) : '—'}
                      </td>
                      <td className="py-2 pr-4 text-right whitespace-nowrap">
                        {fmtDelta(row.valueChange)}
                      </td>
                      <td className="py-2 pr-4 text-right whitespace-nowrap">
                        {row.status !== 'active'
                          ? <span className="text-[var(--muted)]">—</span>
                          : fmtDelta(row.extraInvested, true)}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap font-semibold">
                        {fmtDelta(row.plChange)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[var(--border)]">
                    <td colSpan={4} className="pt-3 pb-1 text-[0.72rem] font-semibold text-[var(--muted)] uppercase tracking-widest">
                      Total (excl. cash)
                    </td>
                    <td className="pt-3 pb-1 text-right font-bold whitespace-nowrap">
                      {fmtDelta(totalValueChange)}
                    </td>
                    <td className="pt-3 pb-1 text-right font-bold whitespace-nowrap">
                      {fmtDelta(totalExtraInvested, true)}
                    </td>
                    <td className="pt-3 pb-1 text-right font-bold whitespace-nowrap">
                      {fmtDelta(totalPlChange)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Cash movements */}
          {cashRows.length > 0 && (
            <div className="rounded-2xl p-5 border border-[var(--border)] bg-[var(--surface)]">
              <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)] mb-4">
                Cash Movements
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-y-0.5 text-[0.82rem]">
                  <thead>
                    <tr>
                      <TH>Account</TH>
                      <TH right>Start</TH>
                      <TH right>End</TH>
                      <TH right>Change</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {cashRows.map(row => (
                      <tr key={row.ticker} className="hover:bg-[var(--surface2)] transition-colors">
                        <td className="py-2 pr-4 font-semibold text-[var(--text)]">{row.ticker}</td>
                        <td className="py-2 pr-4 text-right text-[var(--muted)]">
                          {row.startValue ? fmtGbp(row.startValue) : '—'}
                        </td>
                        <td className="py-2 pr-4 text-right text-[var(--text)]">
                          {row.endValue ? fmtGbp(row.endValue) : '—'}
                        </td>
                        <td className="py-2 text-right">
                          {fmtDelta(row.valueChange)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="pt-3 pb-1 text-[0.72rem] font-semibold text-[var(--muted)] uppercase tracking-widest">
                        Total cash
                      </td>
                      <td className="pt-3 pb-1 text-right text-[var(--muted)] font-bold">
                        {fmtGbp(cashRows.reduce((s, r) => s + r.startValue, 0))}
                      </td>
                      <td className="pt-3 pb-1 text-right text-[var(--text)] font-bold">
                        {fmtGbp(cashRows.reduce((s, r) => s + r.endValue, 0))}
                      </td>
                      <td className="pt-3 pb-1 text-right font-bold">
                        {fmtDelta(cashRows.reduce((s, r) => s + r.valueChange, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Loading overlay */}
      {comparing && (
        <div className="rounded-2xl p-10 border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center">
          <span className="text-[0.82rem] text-[var(--muted)]">Fetching snapshots…</span>
        </div>
      )}
    </div>
  )
}
