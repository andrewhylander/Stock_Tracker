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

If Sync fails in the browser with a network/CORS error, enable CORS on the n8n webhook or rely on the scheduled n8n run instead.

## Features

- Portfolio value over time chart
- Supabase integration for data fetching
- Responsive design with Tailwind CSS
- Sync Now trigger for the n8n snapshot workflow

## Future Features

- Current positions table
- Portfolio allocation pie chart
- Currency breakdown
- Individual position history
