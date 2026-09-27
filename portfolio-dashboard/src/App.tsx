import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import type { PortfolioDaily, Position, BenchmarkDaily, DividendPayment } from './lib/supabase'
import Overview from './pages/Overview'
import Dividends from './pages/Dividends'
import Retirement from './pages/Retirement'

function missingViteEnv(names: string[]) {
  return names.filter((name) => !import.meta.env[name])
}

export default function App() {
  const [history, setHistory] = useState<PortfolioDaily[]>([])
  const [latest, setLatest] = useState<PortfolioDaily | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [benchmark, setBenchmark] = useState<BenchmarkDaily[]>([])
  const [payments, setPayments] = useState<DividendPayment[]>([])
  const [paymentsError, setPaymentsError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'ok' | 'err'>('idle')
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  async function triggerSync() {
    const missing = missingViteEnv(['VITE_N8N_URL', 'VITE_N8N_WEBHOOK_ID'])
    if (missing.length) {
      setSyncStatus('err')
      setSyncMessage(
        `Sync is not configured. Set ${missing.join(' and ')} in Vercel Environment Variables, then redeploy.`
      )
      return
    }

    const base = String(import.meta.env.VITE_N8N_URL).replace(/\/$/, '')
    const id = String(import.meta.env.VITE_N8N_WEBHOOK_ID)
    const url = `${base}/webhook/${id}`

    setSyncing(true)
    setSyncStatus('idle')
    setSyncMessage(null)
    try {
      // Avoid no-cors: opaque responses always look like success and hid /undefined/webhook bugs.
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) {
        throw new Error(`Sync webhook returned ${res.status}`)
      }
      setSyncStatus('ok')
      setSyncMessage('Sync triggered. Refresh in a minute if positions are still empty.')
    } catch (e: unknown) {
      setSyncStatus('err')
      const msg = e instanceof Error ? e.message : 'Sync failed'
      // CORS failures often surface as TypeError: Failed to fetch even when n8n received the POST.
      setSyncMessage(
        `${msg}. If this is a CORS error, enable CORS on the n8n webhook or call Sync from n8n's schedule instead.`
      )
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    async function load() {
      const missing = missingViteEnv(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
      if (missing.length) {
        setError(
          `Missing ${missing.join(' and ')}. Add them in Vercel -> Settings -> Environment Variables, then redeploy (Vite bakes these in at build time).`
        )
        setLoading(false)
        return
      }

      try {
        const [histRes, posRes, bmRes] = await Promise.all([
          supabase
            .from('portfolio_daily')
            .select('*')
            .order('snapshot_date', { ascending: true }),
          supabase
            .from('latest_position_snapshots')
            .select('*')
            .order('gbp_value', { ascending: false }),
          supabase
            .from('benchmark_daily')
            .select('*')
            .order('snapshot_date', { ascending: true }),
        ])
        if (histRes.error) throw histRes.error
        if (posRes.error) throw posRes.error
        if (bmRes.error) throw bmRes.error
        const h = histRes.data ?? []
        setHistory(h)
        setLatest(h.length ? h[h.length - 1] : null)
        setPositions(posRes.data ?? [])
        setBenchmark(bmRes.data ?? [])
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Dividends load separately and never block the dashboard: the table may not
  // exist yet, and the Overview tab has no use for it either way.
  useEffect(() => {
    async function loadDividends() {
      if (missingViteEnv(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']).length) return
      const { data, error } = await supabase
        .from('dividend_payments')
        .select('*')
        .order('ex_date', { ascending: true })
      if (error) {
        setPaymentsError(
          `Dividend history unavailable (${error.message}). Run the dividend_payments migration, then call /api/dividends to populate it.`
        )
        return
      }
      setPayments(data ?? [])
    }
    loadDividends()
  }, [])

  const totalValue = latest?.total_gbp_value
    ?? positions.reduce((s, p) => s + p.gbp_value, 0)

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[1.6rem] font-bold tracking-tight">Portfolio</h1>
            <p className="text-[0.75rem] text-[var(--muted)] mt-0.5">
              {latest
              ? `Last updated ${latest.snapshot_date}`
              : loading ? 'Loading…' : `${positions.length} positions loaded`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {loading && (
              <div className="flex items-center gap-2 text-[0.75rem] text-[var(--muted)]">
                <span className="live-dot w-2 h-2 rounded-full bg-[var(--green)] inline-block" />
                Updating…
              </div>
            )}
            <button
              onClick={triggerSync}
              disabled={syncing}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold border transition-colors ${
                syncStatus === 'ok'  ? 'border-[var(--green)] text-[var(--green)]' :
                syncStatus === 'err' ? 'border-[#f26b6b] text-[#f26b6b]' :
                'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-white/20'
              } disabled:opacity-50`}
            >
              <span className={syncing ? 'live-dot' : ''}>⟳</span>
              {syncing ? 'Running…' : syncStatus === 'ok' ? 'Triggered!' : syncStatus === 'err' ? 'Failed' : 'Sync Now'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-1 border-b border-[var(--border)]">
          <Tab to="/">Overview</Tab>
          <Tab to="/dividends">Dividends</Tab>
          <Tab to="/retirement">Retirement</Tab>
        </nav>

        {error && (
          <div className="rounded-xl p-4 text-[0.82rem] border" style={{ background: 'rgba(242,107,107,0.08)', borderColor: 'rgba(242,107,107,0.3)', color: '#f26b6b' }}>
            {error}
          </div>
        )}

        {syncMessage && (
          <div
            className="rounded-xl p-4 text-[0.82rem] border"
            style={
              syncStatus === 'ok'
                ? { background: 'rgba(31,196,138,0.08)', borderColor: 'rgba(31,196,138,0.3)', color: '#1fc48a' }
                : { background: 'rgba(242,107,107,0.08)', borderColor: 'rgba(242,107,107,0.3)', color: '#f26b6b' }
            }
          >
            {syncMessage}
          </div>
        )}

        <Routes>
          <Route
            path="/"
            element={
              <Overview
                latest={latest}
                history={history}
                positions={positions}
                benchmark={benchmark}
                totalValue={totalValue}
              />
            }
          />
          <Route
            path="/dividends"
            element={
              <Dividends
                positions={positions}
                payments={payments}
                paymentsError={paymentsError}
              />
            }
          />
          <Route path="/retirement" element={<Retirement />} />
        </Routes>

      </div>
    </div>
  )
}

function Tab({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `px-4 py-2.5 text-[0.82rem] font-semibold border-b-2 -mb-px transition-colors ${
          isActive
            ? 'border-[var(--accent)] text-[var(--text)]'
            : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
        }`
      }
    >
      {children}
    </NavLink>
  )
}
