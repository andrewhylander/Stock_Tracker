# Personal Portfolio Dashboard

A React application for tracking personal investment portfolio.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in values:
   ```
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_N8N_URL=https://your-n8n-host
   VITE_N8N_WEBHOOK_ID=your-webhook-id
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

## Vercel deploy

Set the same `VITE_*` variables under **Project → Settings → Environment Variables** for Production, then **Redeploy**.

Vite inlines `import.meta.env.VITE_*` at **build** time. Changing env vars without a new deploy will not update the live site.

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL (dashboard data load) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_N8N_URL` | n8n base URL, no trailing slash (Sync Now) |
| `VITE_N8N_WEBHOOK_ID` | Path id after `/webhook/` |

Server-side only, for `/api/dividends`. These must **not** be prefixed `VITE_`:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key, used to upsert dividend rows |
| `ALPHAVANTAGE_API_KEY` | Free key for US dividend history |
| `DIVIDENDS_REFRESH_SECRET` | Optional. Required to use `?force=1` |

If Sync fails in the browser with a network/CORS error, enable CORS on the n8n webhook or rely on the scheduled n8n run instead.

## Tabs

**Overview** — value over time with an S&P 500 comparison, movers, allocation, sector
breakdown and the positions table.

**Dividends** — income by month, yield and yield on cost per holding. See the root
[README](../README.md#the-dividends-tab) for where the data comes from and why the chart
is keyed on ex-dividend dates. Needs the `dividend_payments` table and one call to
`/api/dividends` before it shows anything.

## Routing

Client-side routing via `react-router-dom`. `vercel.json` rewrites everything except
`/api/*` to `index.html`, so deep links like `/dividends` survive a page refresh.

## Future Features

- Currency breakdown
- Individual position history
- Dividend increase / cut history per holding
