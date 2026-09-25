# n8n workflow: Daily Portfolio Snapshot

`portfolio-snapshot-import.json` is the current workflow, exported from the running
n8n instance. Import it via **Workflows -> Import from File**.

`workflow.json` is the original first version (Twelve Data prices) and is kept for
history only; it is superseded by the import file.

## What it does

Reads the holdings sheet, prices them (Finnhub for US stocks, CoinGecko for crypto,
Frankfurter for GBP/USD), works out per-position and portfolio totals in GBP, and
upserts them into Supabase (`position_snapshots` and `portfolio_daily`). It runs on a
22-hour schedule and can also be triggered by POSTing to its webhook (this is what the
dashboard's **Sync Now** button does).

```
Schedule Trigger / Webhook -> Google Sheets -> Code: Build Symbols -> HTTP: Finnhub Quote
  -> Code: Merge Prices -> HTTP: FX Rate -> HTTP: CoinGecko Crypto -> Code: Process Data
  -> HTTP: Upsert Positions
  -> Code: Daily Summary -> HTTP: Upsert Daily
```

## After importing, fill in the placeholders

The export is sanitised, and the workflow is imported **inactive**.

| Placeholder | Where | Replace with |
|---|---|---|
| `YOUR_GOOGLE_SHEET_ID` | Google Sheets node | ID of your holdings sheet |
| `YOUR_PROJECT_REF` | both Upsert nodes (URL) | your Supabase project ref |
| `REPLACE_WITH_A_RANDOM_PATH` | Webhook node (path) | a long random string, e.g. a UUID |

The webhook is unauthenticated, so keep its path secret and do not commit it.

## Credentials to create

- **Google Sheets** - a Google Sheets OAuth2 credential.
- **Finnhub** - a **Query Auth** credential (`httpQueryAuth`) named `Finnhub API`, with
  name `token` and your Finnhub API key as the value. The workflow's Finnhub node uses it,
  so the key is never stored in the workflow itself.
- **Supabase** - a **Custom Auth** credential (`httpCustomAuth`) containing both headers
  Supabase needs, using the project's `service_role` key:

  ```json
  { "headers": { "apikey": "<service_role key>", "Authorization": "Bearer <service_role key>" } }
  ```

  Use this rather than n8n's built-in Supabase credential, which sent a truncated
  `Authorization` header on the instance this was built on (`PGRST301: Expected 3 parts
  in JWT; got 2`). Both headers are required: `apikey` alone authenticates as `anon`,
  so writes fail row-level security (`42501`).

## Behaviour worth knowing

- **Scheme/tax-adjusted holdings.** For tickers with no live price (LSE-listed), the
  workflow trusts the sheet's `GBP` column. If that value is a clear reduction (< 0.95)
  of `share price x share count`, the same factor is applied to `avg_cost`, so value and
  cost basis stay on the same net-of-tax footing.
- **Upserts** use `Prefer: resolution=merge-duplicates,return=representation`, keyed on
  `snapshot_date,ticker,brokerage` (positions) and `snapshot_date` (daily), so re-running
  on the same day overwrites rather than duplicates.
- **Text fields are trimmed** so stray spaces in the sheet do not split categories.
