import type { UpcomingPayment } from '../lib/dividends'
import { parseDate } from '../lib/dividends'
import { fmtGbp, catColor, catBg } from '../constants'

interface Props {
  upcoming: UpcomingPayment[]
  categoryFor: (ticker: string) => string
}

function daysUntil(iso: string, today = new Date()): number {
  const ms = parseDate(iso).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  return Math.round(ms / 86_400_000)
}

export default function UpcomingDividends({ upcoming, categoryFor }: Props) {
  if (!upcoming.length) return null

  return (
    <div className="rounded-2xl p-5 border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">
          Upcoming
        </p>
        <p className="text-[0.7rem] text-[var(--muted)]">
          Ex-dividend dates — cash follows a few weeks later
        </p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {upcoming.map((u) => {
          const days = daysUntil(u.exDate)
          const d = parseDate(u.exDate)
          const cat = categoryFor(u.ticker)

          return (
            <div
              key={`${u.ticker}-${u.exDate}`}
              className="shrink-0 w-[13.5rem] rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[1.5rem] font-bold leading-none tracking-tight">
                    {d.getDate()}
                  </p>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)] mt-1">
                    {d.toLocaleDateString('en-GB', { month: 'short' })}
                  </p>
                </div>
                <span
                  className="px-2.5 py-1 rounded-md text-[0.9rem] font-bold tracking-tight"
                  style={{ color: catColor(cat), background: catBg(cat) }}
                >
                  {u.ticker}
                </span>
              </div>

              <p className="text-[1.15rem] font-bold text-[var(--gold)] mt-3 leading-none">
                {fmtGbp(u.amount)}
              </p>

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-[0.68rem] text-[var(--muted)]">
                  {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}
                </span>
                {u.changePct != null && Math.abs(u.changePct) >= 1 && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[0.62rem] font-semibold"
                    style={
                      u.changePct > 0
                        ? { color: '#1fc48a', background: 'rgba(31,196,138,0.12)' }
                        : { color: '#f26b6b', background: 'rgba(242,107,107,0.12)' }
                    }
                  >
                    {u.changePct > 0 ? 'Increased' : 'Decreased'} {Math.abs(u.changePct).toFixed(0)}%
                  </span>
                )}
              </div>

              {u.projected && (
                <p className="text-[0.62rem] text-[var(--muted)] mt-2 pt-2 border-t border-[var(--border)]">
                  Projected from last year
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
