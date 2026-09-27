import { createClient } from '@supabase/supabase-js'

/**
 * Refreshes `lse_price_cache` with a live price for LSE-listed holdings.
 *
 * Finnhub (used by n8n for everything else) returns 403 for `.L` symbols on
 * its free tier, so the daily snapshot has always fallen back to trusting
 * whatever price is typed into the Google Sheet for VWRL and KNOS -- fine for
 * a number that rarely gets revisited, not fine for something the dashboard
 * shows as "today's value".
 *
 * Yahoo Finance's chart API carries a live `regularMarketPrice` for LSE
 * tickers, needs no key, and has no meaningful rate limit for a handful of
 * calls a day -- the same source already used for LSE dividend history in
 * api/dividends.ts. This route writes to its own table rather than directly
 * into `position_snapshots`, so a bad response here can't corrupt the
 * n8n-owned daily snapshot; n8n reads `lse_price_cache` and decides what to
 * do with it.
 */

interface PriceRow {
  ticker: string
  price: number
  currency: string
  fetched_at: string
}

// Tickers the sheet's own price column stands in for today, because Finnhub's
// free tier can't see them. Kept in sync by hand with the LSE list in
// api/dividends.ts -- both exist for the same underlying reason.
const LSE_TICKERS = ['VWRL', 'KNOS']

async function fetchYahooPrice(ticker: string): Promise<PriceRow> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.L?range=1d&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`Yahoo ${ticker}: HTTP ${res.status}`)

  const json = await res.json()
  const meta = json?.chart?.result?.[0]?.meta
  const price = Number(meta?.regularMarketPrice)
  if (!price) throw new Error(`Yahoo ${ticker}: no regularMarketPrice in response`)

  return {
    ticker,
    price,
    currency: String(meta.currency ?? 'GBP'),
    fetched_at: new Date().toISOString(),
  }
}

export default async function handler(req: any, res: any) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    const missing = [
      !supabaseUrl && 'SUPABASE_URL (or VITE_SUPABASE_URL)',
      !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY',
    ].filter(Boolean)

    return res.status(500).json({
      error: `Missing ${missing.join(' and ')}. The service role key must have no VITE_ prefix.`,
      visibleEnvKeys: Object.keys(process.env)
        .filter((k) => /SUPABASE|VITE_/i.test(k))
        .sort(),
      hint: 'If the variable is set in Vercel but not listed here, it was added after this deployment was built. Redeploy.',
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const results = await Promise.allSettled(LSE_TICKERS.map(fetchYahooPrice))

  const rows: PriceRow[] = []
  const failed: Array<{ ticker: string; reason: string }> = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') rows.push(r.value)
    else failed.push({ ticker: LSE_TICKERS[i], reason: r.reason instanceof Error ? r.reason.message : String(r.reason) })
  })

  try {
    if (rows.length) {
      const { error: upErr } = await supabase
        .from('lse_price_cache')
        .upsert(rows, { onConflict: 'ticker' })
      if (upErr) throw upErr
    }

    return res.status(200).json({ updated: rows.map((r) => r.ticker), failed })
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e), failed })
  }
}
