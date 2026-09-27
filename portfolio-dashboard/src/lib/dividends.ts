import type { DividendPayment, Position } from './supabase'

// Everything here is keyed on EX-DIVIDEND DATE, never pay date. Free data only
// covers pay dates for the US holdings, which are a small slice of the income,
// so the whole tab commits to ex-date and says so in the UI.
//
// Income figures assume TODAY's share count for every payment, past or future.
// That makes this a "what does what I hold now yield" view rather than a
// record of cash received -- which is the question the tab is meant to answer.

export interface Holding {
  ticker: string
  category: string
  shares: number
  value: number        // as stored -- may be tax/scheme adjusted below market
  marketValue: number  // share_price x share_count, always gross
  costBasis: number    // gross, with any scheme adjustment reversed
  adjusted: boolean    // true where the stored value is below gross market
}

export interface HoldingDividend extends Holding {
  perShareAnnual: number   // GBP, trailing 12 months
  annualIncome: number     // GBP
  yieldPct: number         // against market value
  yieldOnCostPct: number   // against cost basis
  // Payments per quarter rather than a yes/no: KNOS pays in October and
  // November, both Q4, so a boolean collapsed two payments into one mark and
  // read as though it paid annually.
  quarters: number[]
  paymentsPerYear: number
  payments: DividendPayment[]
}

export interface MonthBucket {
  month: number            // 0-11
  label: string
  actual: number
  projected: number
  total: number
}

/** 'YYYY-MM-DD' -> local Date, avoiding the UTC shift of `new Date(str)`. */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * One row per ticker, summed across brokerages.
 *
 * Holdings under a tax or share scheme are stored net: the snapshot keeps a
 * fraction of `share_price x share_count` and scales `avg_cost` by the same
 * fraction. Dividends, though, are paid on every share held. Dividing gross
 * income by a net value inflates the yield by the reciprocal of that fraction
 * -- for KNOS, held at 0.58 of market, it read 4.02% against a true 2.33%.
 *
 * So yields are computed against gross figures throughout: market value, and a
 * cost basis with the same adjustment reversed. The stored net value is kept as
 * `value` for anything that needs to reconcile with the Overview tab.
 */
export function holdingsByTicker(positions: Position[]): Map<string, Holding> {
  const map = new Map<string, Holding>()
  for (const p of positions) {
    if (p.category === 'Cash') continue

    const h = map.get(p.ticker) ?? {
      ticker: p.ticker,
      category: p.category || 'Other',
      shares: 0,
      value: 0,
      marketValue: 0,
      costBasis: 0,
      adjusted: false,
    }

    const shares = Number(p.share_count) || 0
    const stored = Number(p.gbp_value) || 0
    const market = (Number(p.share_price) || 0) * shares
    const cost   = (Number(p.avg_cost) || 0) * shares

    // Below 0.99 rather than 1.0: FX and rounding leave small gaps on holdings
    // carrying no scheme adjustment at all.
    const ratio = market > 0 && stored > 0 ? stored / market : 1
    const isAdjusted = ratio < 0.99

    h.shares      += shares
    h.value       += stored
    h.marketValue += market > 0 ? market : stored
    h.costBasis   += isAdjusted ? cost / ratio : cost
    h.adjusted     = h.adjusted || isAdjusted

    map.set(p.ticker, h)
  }
  return map
}

/**
 * The per-payment rate to carry forward, in GBP.
 *
 * When a holding's last two payments match it is on a stable declared rate, so
 * that rate is projected forward. Averaging the trailing year instead would
 * bury any recent rise under the smaller payments it replaced -- NVDA went from
 * $0.01 to $0.25 in June 2026, which trailing-twelve-months understates by half.
 *
 * When the last two payments differ, the holding pays a variable distribution
 * (most ETFs, VWRL included) and there is no declared rate to project, so the
 * trailing year is the better estimate.
 */
function forwardRate(trailing: DividendPayment[]): { perPayment: number | null; annual: number } {
  const ttm = trailing.reduce((s, p) => s + Number(p.amount_per_share_gbp || 0), 0)
  if (trailing.length < 2) return { perPayment: null, annual: ttm }

  const last = Number(trailing[trailing.length - 1].amount_per_share_gbp || 0)
  const prev = Number(trailing[trailing.length - 2].amount_per_share_gbp || 0)
  const stable = prev > 0 && Math.abs(last - prev) / prev <= 0.05

  return stable
    ? { perPayment: last, annual: last * trailing.length }
    : { perPayment: null, annual: ttm }
}

function trailingFor(payments: DividendPayment[], today: Date): DividendPayment[] {
  const yearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
  return payments
    .filter(p => {
      const ex = parseDate(p.ex_date)
      return ex >= yearAgo && ex <= today
    })
    .sort((a, b) => a.ex_date.localeCompare(b.ex_date))
}

function groupByTicker(payments: DividendPayment[]): Map<string, DividendPayment[]> {
  const map = new Map<string, DividendPayment[]>()
  for (const p of payments) {
    const list = map.get(p.ticker) ?? []
    list.push(p)
    map.set(p.ticker, list)
  }
  return map
}

/**
 * Future payments, inferred by repeating each of the last 12 months' payments
 * one year on. This reproduces a holding's real cadence -- quarterly, twice
 * yearly, irregular -- without having to guess a frequency, and keeps the
 * months where they actually fall. Stable payers project at their current rate
 * rather than at whatever they happened to pay a year ago.
 */
export function projectPayments(payments: DividendPayment[], today = new Date()): DividendPayment[] {
  const out: DividendPayment[] = []

  for (const [, list] of groupByTicker(payments)) {
    const trailing = trailingFor(list, today)
    const { perPayment } = forwardRate(trailing)

    for (const p of trailing) {
      const ex = parseDate(p.ex_date)
      const next = new Date(ex.getFullYear() + 1, ex.getMonth(), ex.getDate())
      if (next <= today) continue

      out.push({
        ...p,
        id: -1,
        ex_date: toISO(next),
        amount_per_share_gbp: perPayment ?? Number(p.amount_per_share_gbp || 0),
        source: 'projected',
      })
    }
  }
  return out
}

export function isProjected(p: DividendPayment): boolean {
  return p.source === 'projected'
}

export interface UpcomingPayment {
  ticker: string
  exDate: string
  amount: number          // GBP, at today's share count
  perShare: number        // GBP
  projected: boolean
  changePct: number | null  // against the same holding's previous payment
}

/**
 * The next payments due, soonest first. Dated by ex-dividend date like
 * everything else here, so a card saying the 30th means the shares go
 * ex-dividend that day, not that cash arrives.
 */
export function upcomingPayments(
  payments: DividendPayment[],
  holdings: Map<string, Holding>,
  limit = 6,
  today = new Date(),
): UpcomingPayment[] {
  const byTicker = groupByTicker(payments)
  const out: UpcomingPayment[] = []

  for (const [ticker, list] of byTicker) {
    const shares = holdings.get(ticker)?.shares ?? 0
    if (!shares) continue

    const sorted = list.slice().sort((a, b) => a.ex_date.localeCompare(b.ex_date))
    const future = sorted.filter(p => parseDate(p.ex_date) > today)
    const past = sorted.filter(p => parseDate(p.ex_date) <= today)

    for (const p of future) {
      const perShare = Number(p.amount_per_share_gbp || 0)
      const when = parseDate(p.ex_date)

      // Compare against the payment nearest a year earlier, not simply the
      // previous one. KNOS alternates a large October payment with a smaller
      // November one, so comparing consecutive payments reported a 95% rise
      // every year where the rate had not moved at all.
      const target = new Date(when.getFullYear() - 1, when.getMonth(), when.getDate()).getTime()
      let prior: DividendPayment | null = null
      let bestGap = Infinity
      for (const q of past) {
        const gap = Math.abs(parseDate(q.ex_date).getTime() - target)
        if (gap < bestGap) { bestGap = gap; prior = q }
      }

      // Only meaningful if that match really is about a year back; within ten
      // weeks either side covers a shifting ex-date without pairing unrelated
      // payments on a holding with a short history.
      const comparable = prior && bestGap <= 70 * 86_400_000
        ? Number(prior.amount_per_share_gbp || 0)
        : 0

      out.push({
        ticker,
        exDate: p.ex_date,
        amount: perShare * shares,
        perShare,
        projected: isProjected(p),
        changePct: comparable > 0 ? ((perShare - comparable) / comparable) * 100 : null,
      })
    }
  }

  return out.sort((a, b) => a.exDate.localeCompare(b.exDate)).slice(0, limit)
}

/** Per-holding dividend summary, trailing 12 months. */
export function buildHoldingDividends(
  positions: Position[],
  payments: DividendPayment[],
  today = new Date(),
): HoldingDividend[] {
  const holdings = holdingsByTicker(positions)
  const byTicker = groupByTicker(payments)

  const rows: HoldingDividend[] = []
  for (const h of holdings.values()) {
    const all = (byTicker.get(h.ticker) ?? [])
      .slice()
      .sort((a, b) => a.ex_date.localeCompare(b.ex_date))

    const trailing = trailingFor(all, today)

    const perShareAnnual = forwardRate(trailing).annual
    const annualIncome   = perShareAnnual * h.shares

    const quarters = [0, 0, 0, 0]
    for (const p of trailing) quarters[Math.floor(parseDate(p.ex_date).getMonth() / 3)] += 1

    rows.push({
      ...h,
      perShareAnnual,
      annualIncome,
      yieldPct:       h.marketValue > 0 ? (annualIncome / h.marketValue) * 100 : 0,
      yieldOnCostPct: h.costBasis > 0 ? (annualIncome / h.costBasis) * 100 : 0,
      quarters,
      paymentsPerYear: trailing.length,
      payments: all,
    })
  }

  return rows.sort((a, b) => b.annualIncome - a.annualIncome)
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/** Twelve buckets for one calendar year, actual and projected kept apart. */
export function monthlyIncome(
  payments: DividendPayment[],
  holdings: Map<string, Holding>,
  year: number,
): MonthBucket[] {
  const buckets: MonthBucket[] = MONTHS.map((label, month) => ({
    month, label, actual: 0, projected: 0, total: 0,
  }))

  for (const p of payments) {
    const ex = parseDate(p.ex_date)
    if (ex.getFullYear() !== year) continue

    const shares = holdings.get(p.ticker)?.shares ?? 0
    const income = Number(p.amount_per_share_gbp || 0) * shares
    if (!income) continue

    const b = buckets[ex.getMonth()]
    if (isProjected(p)) b.projected += income
    else b.actual += income
    b.total += income
  }

  return buckets
}

/** Running total across the year, for the cumulative line. */
export function cumulative(buckets: MonthBucket[]): number[] {
  let run = 0
  return buckets.map(b => (run += b.total))
}

/**
 * Years to offer as tabs, newest first. Capped because a long-standing payer
 * drags the list back a decade or more -- NVDA alone reaches 2012 -- and a row
 * of sixteen buttons is noise, not navigation.
 */
export function yearsCovered(payments: DividendPayment[], limit = 6): number[] {
  const years = new Set<number>()
  for (const p of payments) years.add(parseDate(p.ex_date).getFullYear())
  return Array.from(years).sort((a, b) => b - a).slice(0, limit)
}
