import { createClient } from '@supabase/supabase-js'

/**
 * Refreshes `dividend_payments` from two sources, because no single free API
 * covers the whole portfolio:
 *
 *   LSE holdings (*.LSE)  -> Yahoo Finance chart API, ex-dates only.
 *                            Free and unlimited, but sends no CORS header,
 *                            which is the main reason this runs server-side.
 *   Everything else       -> Alpha Vantage DIVIDENDS.
 *                            Returns an empty array for LSE symbols, so it is
 *                            only ever asked about US listings.
 *
 * Only ex-dates are stored. Alpha Vantage does return pay dates, but Yahoo
 * does not, and a column populated for a minority of holdings would imply the
 * chart shows cash arriving when mostly it cannot.
 *
 * Tickers refreshed at most once a week: dividend schedules barely move, and
 * Alpha Vantage's free key allows 25 requests a day and one a second.
 */

const STALE_AFTER_DAYS = 7
const AV_MIN_INTERVAL_MS = 1200 // free key rejects faster than ~1/sec

interface Payment {
  ticker: string
  ex_date: string
  amount_per_share: number
  currency: string
  amount_per_share_gbp: number
  source: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function toGbp(amount: number, currency: string, usdPerGbp: number): number {
  switch (currency) {
    // KNOS.L and most LSE equities quote in pence. VWRL.L quotes in pounds,
    // so this has to key off the reported currency, never the exchange.
    case 'GBp':
      return amount / 100
    case 'GBP':
      return amount
    case 'USD':
      return usdPerGbp > 0 ? amount / usdPerGbp : amount
    default:
      return amount
  }
}

// Route on the exchange column, not the ticker. The sheet stores bare tickers
// ("VWRL", "KNOS") with exchange "LON"; only the display name elsewhere carries
// a .LSE suffix. Matching on the suffix sent both London holdings to Alpha
// Vantage, which has no LSE dividend data and returns an empty array rather
// than an error -- so they silently contributed nothing.
function isLse(ticker: string, exchange: string): boolean {
  return /^(LON|LSE)$/i.test(exchange ?? '') || /\.(LSE|L)$/i.test(ticker)
}

function yahooSymbol(ticker: string): string {
  const base = ticker.replace(/\.(LSE|L)$/i, '')
  return `${base}.L`
}

async function fetchYahoo(ticker: string, usdPerGbp: number): Promise<Payment[]> {
  const symbol = yahooSymbol(ticker)
  const period2 = Math.floor(Date.now() / 1000)
  const period1 = period2 - 60 * 60 * 24 * 365 * 6
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&events=div`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; portfolio-dashboard/1.0)' },
  })
  if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`)

  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error(`Yahoo ${symbol}: no result`)

  const currency: string = result.meta?.currency ?? 'GBP'
  const dividends = result.events?.dividends ?? {}

  return Object.values<{ date: number; amount: number }>(dividends).map((d) => {
    const amount = Number(d.amount)
    return {
      ticker,
      ex_date: new Date(d.date * 1000).toISOString().slice(0, 10),
      amount_per_share: amount,
      currency,
      amount_per_share_gbp: toGbp(amount, currency, usdPerGbp),
      source: 'yahoo',
    }
  })
}

async function fetchAlphaVantage(
  ticker: string,
  apiKey: string,
  usdPerGbp: number,
): Promise<Payment[]> {
  const url =
    `https://www.alphavantage.co/query?function=DIVIDENDS` +
    `&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Alpha Vantage ${ticker}: HTTP ${res.status}`)

  const json = await res.json()
  // Rate limit and quota exhaustion both come back as HTTP 200 with a prose
  // message instead of data, so they have to be detected by shape.
  if (json?.Note || json?.Information) {
    throw new Error(`Alpha Vantage ${ticker}: ${json.Note ?? json.Information}`)
  }

  const rows: Array<Record<string, string>> = json?.data ?? []
  return rows
    .filter((r) => r.ex_dividend_date && r.amount)
    .map((r) => {
      const amount = Number(r.amount)
      return {
        ticker,
        ex_date: r.ex_dividend_date,
        amount_per_share: amount,
        currency: 'USD',
        amount_per_share_gbp: toGbp(amount, 'USD', usdPerGbp),
        source: 'alphavantage',
      }
    })
}

export default async function handler(req: any, res: any) {
  // The project URL is not a secret -- it already ships in the browser bundle --
  // so reuse the VITE_ one rather than making it be configured twice. The
  // service role key is a different matter and must never carry a VITE_ prefix.
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const avKey = process.env.ALPHAVANTAGE_API_KEY

  if (!supabaseUrl || !serviceKey) {
    const missing = [
      !supabaseUrl && 'SUPABASE_URL (or VITE_SUPABASE_URL)',
      !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY',
    ].filter(Boolean)

    // Name what is actually missing, and list which related variables this
    // environment can see. Vercel applies env vars at build time, so a variable
    // added after the last deploy is invisible until a redeploy -- which looks
    // identical to never having set it. Names only, never values.
    return res.status(500).json({
      error: `Missing ${missing.join(' and ')}. The service role key must have no VITE_ prefix.`,
      visibleEnvKeys: Object.keys(process.env)
        .filter((k) => /SUPABASE|ALPHAVANTAGE|VITE_/i.test(k))
        .sort(),
      hint: 'If the variable is set in Vercel but not listed here, it was added after this deployment was built. Redeploy.',
    })
  }

  const secret = process.env.DIVIDENDS_REFRESH_SECRET
  const force = req.query?.force === '1'
  if (force && (!secret || req.headers?.['x-refresh-secret'] !== secret)) {
    return res.status(403).json({ error: 'force=1 requires a matching x-refresh-secret header' })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const { data: positions, error: posErr } = await supabase
      .from('latest_position_snapshots')
      .select('ticker, exchange, category')
    if (posErr) throw posErr

    // Crypto, cash and options never pay a dividend; asking about them would
    // just burn Alpha Vantage's daily quota.
    const skip = new Set(['Cash', 'Crypto', 'Options'])
    const byTickerName = new Map<string, string>() // ticker -> exchange
    for (const p of positions ?? []) {
      const ticker = String((p as any).ticker ?? '').trim()
      if (!ticker || skip.has((p as any).category)) continue
      if (!byTickerName.has(ticker)) byTickerName.set(ticker, String((p as any).exchange ?? '').trim())
    }
    const tickers = Array.from(byTickerName.keys())

    const { data: existing, error: exErr } = await supabase
      .from('dividend_payments')
      .select('ticker, fetched_at')
    if (exErr) throw exErr

    const freshest = new Map<string, number>()
    for (const row of existing ?? []) {
      const t = (row as any).ticker
      const at = new Date((row as any).fetched_at).getTime()
      if (!freshest.has(t) || at > (freshest.get(t) as number)) freshest.set(t, at)
    }

    const staleBefore = Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000
    const due = force
      ? tickers
      : tickers.filter((t) => !freshest.has(t) || (freshest.get(t) as number) < staleBefore)

    if (!due.length) {
      return res.status(200).json({ refreshed: [], skipped: tickers.length, message: 'All tickers fresh.' })
    }

    const fx = await fetch('https://api.frankfurter.app/latest?from=GBP&to=USD').then((r) => r.json())
    const usdPerGbp = Number(fx?.rates?.USD) || 0
    if (!usdPerGbp) throw new Error('Could not read GBP/USD rate from Frankfurter')

    const refreshed: string[] = []
    const failed: Array<{ ticker: string; reason: string }> = []
    let avCalls = 0

    for (const ticker of due) {
      try {
        let payments: Payment[]
        if (isLse(ticker, byTickerName.get(ticker) ?? '')) {
          payments = await fetchYahoo(ticker, usdPerGbp)
        } else {
          if (!avKey) throw new Error('ALPHAVANTAGE_API_KEY is not set')
          if (avCalls > 0) await sleep(AV_MIN_INTERVAL_MS)
          avCalls++
          payments = await fetchAlphaVantage(ticker, avKey, usdPerGbp)
        }

        if (payments.length) {
          const { error: upErr } = await supabase
            .from('dividend_payments')
            .upsert(
              payments.map((p) => ({ ...p, fetched_at: new Date().toISOString() })),
              { onConflict: 'ticker,ex_date' },
            )
          if (upErr) throw upErr
        }
        refreshed.push(`${ticker} (${payments.length})`)
      } catch (e: unknown) {
        failed.push({ ticker, reason: e instanceof Error ? e.message : String(e) })
      }
    }

    return res.status(200).json({
      refreshed,
      failed,
      skipped: tickers.length - due.length,
      usdPerGbp,
    })
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
}
