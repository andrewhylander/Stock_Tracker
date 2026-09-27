# Stock Tracker

A personal investment portfolio tracker. An n8n workflow snapshots holdings once a
day into Supabase; a React dashboard reads that data back.

There is no server of my own in the middle — the dashboard talks to Supabase
directly with the anon key, and n8n is the only thing that writes.

```
Google Sheet (holdings, source of truth)
        |
        v
   n8n workflow  --->  Finnhub (US prices)
   "Daily Portfolio     CoinGecko (crypto, GBP)
    Snapshot"           Frankfurter (GBP/USD)
        |
        v
   Supabase (Postgres)
        |
        v
   React dashboard (Vite, deployed on Vercel)
```

## Repo layout

| Path | What it is |
|---|---|
| [`n8n_workflow/portfolio-snapshot-import.json`](n8n_workflow/portfolio-snapshot-import.json) | The live workflow, exported. Import this one. |
| [`n8n_workflow/README.md`](n8n_workflow/README.md) | Credentials, placeholders to fill in, behaviour notes. **Read this before importing.** |
| [`n8n_workflow/workflow.json`](n8n_workflow/workflow.json) | The original Twelve Data version. History only. |
| [`n8n_workflow_description.md`](n8n_workflow_description.md) | Stale design doc from the Twelve Data era. History only. |
| [`supabase_schema.sql`](supabase_schema.sql) | Tables and views. |
| [`portfolio-dashboard/`](portfolio-dashboard/) | The React app. |
| [`portfolio-dashboard/api/dividends.ts`](portfolio-dashboard/api/dividends.ts) | Serverless route that fills `dividend_payments`. |
| [`portfolio-dashboard/api/prices.ts`](portfolio-dashboard/api/prices.ts) | Serverless route that fills `lse_price_cache` with a live LSE price. |
| [`portfolio-dashboard/src/lib/dividends.ts`](portfolio-dashboard/src/lib/dividends.ts) | All dividend maths — yields, forward rate, projection, monthly buckets. |

## The data

The Google Sheet is the source of truth for *what I hold* — ticker, share count,
average cost, category, sector, region, and the dividend columns. The workflow
never writes back to it. Prices are the only thing fetched live.

**Supabase objects**

- `position_snapshots` — one row per holding per day. Upserted on
  `(snapshot_date, ticker, brokerage)`, so re-running on the same day overwrites
  rather than duplicates.
- `portfolio_daily` — one row per day with portfolio totals. Upserted on `snapshot_date`.
- `latest_position_snapshots` (view) — every row from the most recent
  `snapshot_date`. Deliberately *not* the newest row per ticker: a snapshot is the
  set of holdings on a date, so a position that leaves the sheet must leave the
  dashboard too.
- `portfolio_value_over_time` (view) — `snapshot_date` and `total_gbp_value`.
- `dividend_payments` — one row per holding per ex-dividend date. Written by the
  `/api/dividends` serverless route, **not** by n8n. Upserted on `(ticker, ex_date)`.
- `lse_price_cache` — one row per LSE ticker, always overwritten (a cache, not a
  history). Written by the `/api/prices` serverless route, **not** by n8n, on a
  Vercel cron once daily (Hobby plan caps crons at once per day). n8n's
  `Code: Process Data` reads it and prefers it over the sheet's own
  `GOOGLEFINANCE`-backed price cell — see below.

**`benchmark_daily`** — the S&P 500 comparison on the Overview chart reads this
table. It's now in `supabase_schema.sql`, so a fresh project will have it, but
**nothing writes to it** — not the n8n workflow, not anything in this repo.
It was populated directly against the live database at some point outside this
repo's history. A fresh project's benchmark comparison will simply show no
data until something is pointed at filling it in.

## Pricing sources, and what each one covers

| Source | Covers | Auth |
|---|---|---|
| Finnhub | US-listed stocks. 60 calls/min free, so one call per ticker, no batching. | n8n Query Auth credential |
| CoinGecko | BTC, ETH, XRP, SUI, SOL, priced in GBP | none |
| Frankfurter | GBP/USD | none |
| Yahoo Finance (via `lse_price_cache`) | LSE listings (VWRL, KNOS) — **Finnhub's free tier returns 403 for `.L` symbols** | none |
| The sheet's `GOOGLEFINANCE` cell | Same, only if the cache above is empty | — |

## The Dividends tab

The dashboard has two tabs: **Overview** and **Dividends**. The dividend tab answers
"what does what I hold now pay me", so every figure is valued at today's share count
rather than reconstructed from what was held at the time.

**Where the numbers come from.** Yield and yield on cost need no API at all — they are
arithmetic over `avg_cost`, `share_count` and `gbp_value`, which the daily snapshot
already provides. Only the payment history needs fetching, and that needs two sources
because no free API covers the whole portfolio:

| Holdings | Source | Why |
|---|---|---|
| `*.LSE` (VWRL, KNOS) | Yahoo Finance chart API | Alpha Vantage knows the symbols but returns an empty dividend array for them |
| Everything else | Alpha Vantage `DIVIDENDS` | Full history including pay dates, US only |

**Everything is charted by ex-dividend date, never pay date.** Alpha Vantage does return
pay dates, but Yahoo does not, and the LSE holdings are the large majority of the income.
A pay-date column populated for a minority of holdings would imply the chart shows cash
landing in the account. The chart says so on its face.

**Forward rate, not trailing average.** When a holding's last two payments match, it is on
a stable declared rate and that rate is projected forward. Averaging the trailing year
instead would bury a recent rise under the smaller payments it replaced — NVDA went from
$0.01 to $0.25 in June 2026, which trailing-twelve-months understates by half. Holdings
whose payments vary each time (most ETFs, VWRL included) have no declared rate to project,
so they fall back to the trailing year.

Future months are projected by repeating the last twelve months' payments a year on,
which reproduces each holding's real cadence without guessing a frequency. Projected bars
are drawn as dashed outlines.

**Refreshing.** A Vercel Cron Job (`vercel.json`) hits `/api/dividends` every Monday at
06:00 UTC — nothing needs visiting by hand. It only refetches tickers whose data is over
a week old, so repeated calls (the cron included) are cheap no-ops — which also keeps
Alpha Vantage's free key (25 requests/day, one per second) well clear of its limits.
Trigger it manually the same way, `POST` or `GET` the route directly, if you want fresher
data before the next scheduled run. `?force=1` overrides the staleness check and requires
an `x-refresh-secret` header matching `DIVIDENDS_REFRESH_SECRET`.

The route itself has no auth on a plain call — anyone who knows the URL can trigger it.
Low risk: it only re-reads public price history and upserts your own Supabase table, and
the staleness guard means repeated hits do nothing extra. Worth revisiting if that stops
being true.

## Running the dashboard

```bash
cd portfolio-dashboard
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill it in. The `VITE_*` pairs load data and power the
**Sync Now** button. The unprefixed ones (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`ALPHAVANTAGE_API_KEY`) are read only by the `/api/dividends` serverless route and must
**not** be given a `VITE_` prefix — that would inline the service role key into the
browser bundle.

Before the Dividends tab has anything to show, run the `dividend_payments` section of
`supabase_schema.sql` against the project, then hit `/api/dividends` once to populate it.
Until then the tab renders with a warning rather than breaking the dashboard.

Vite inlines `import.meta.env.VITE_*` at **build** time. Changing an environment
variable in Vercel without triggering a new deploy will not change the live site.

```bash
npm run build   # tsc && vite build
npm run lint
```

## Stack

React 18 + TypeScript on Vite 5, Tailwind v4 (via `@tailwindcss/postcss`),
Recharts for charts, `@supabase/supabase-js` for data, deployed on Vercel.

## Gotchas worth remembering

- **Supabase credential in n8n** — use an `httpCustomAuth` credential sending both
  `apikey` and `Authorization: Bearer` with the `service_role` key. The built-in
  Supabase node sent a truncated JWT on this instance, and `apikey` alone
  authenticates as `anon`, which fails row-level security on write.
- **The webhook is unauthenticated.** Its path is the only secret. Do not commit it.
- **LSE holdings price from `lse_price_cache` first, the sheet's `GBP` column second.**
  The sheet's price cell is a live `GOOGLEFINANCE` formula, but it only recalculates
  when Google's servers next touch the sheet — not guaranteed before n8n's own
  schedule fires — so `/api/prices` fetches a Yahoo Finance quote independently and
  n8n prefers it when present. Either way, if the sheet's `GBP` column comes out under
  0.95 of `share price x share count`, that ratio is treated as a deliberate net-of-tax
  haircut (KNOS's scheme shares) and the same factor is applied to `avg_cost`, so value
  and cost basis stay on the same footing.
- **`.env` and `.mcp.json` are gitignored.** Only `.env.example` is tracked.
