import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import type { PortfolioDaily, Position, BenchmarkDaily } from './lib/supabase'
import SummaryCards from './components/SummaryCards'
import MoversStrip from './components/MoversStrip'
import PortfolioChart from './components/PortfolioChart'
import AllocationChart from './components/AllocationChart'
import SectorBreakdown from './components/SectorBreakdown'
import PositionsTable from './components/PositionsTable'

export default function App() {
  const [history, setHistory] = useState<PortfolioDaily[]>([])
  const [latest, setLatest] = useState<PortfolioDaily | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [benchmark, setBenchmark] = useState<BenchmarkDaily[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'ok' | 'err'>('idle')

  async function triggerSync() {
    setSyncing(true)
    setSyncStatus('idle')
    try {
      const res = await fetch(
        `${import.meta.env.VITE_N8N_URL}/api/v1/workflows/${import.meta.env.VITE_N8N_WORKFLOW_ID}/run`,
        { method: 'POST', headers: { 'X-N8N-API-KEY': import.meta.env.VITE_N8N_API_KEY } }
      )
      setSyncStatus(res.ok ? 'ok' : 'err')
    } catch {
      setSyncStatus('err')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    async function load() {
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

        {error && (
          <div className="rounded-xl p-4 text-[0.82rem] border" style={{ background: 'rgba(242,107,107,0.08)', borderColor: 'rgba(242,107,107,0.3)', color: '#f26b6b' }}>
            {error}
          </div>
        )}

        {/* Summary KPI cards */}
        <SummaryCards latest={latest} positions={positions} />

        {/* Portfolio value chart */}
        <PortfolioChart data={history} benchmark={benchmark} />

        {/* Movers strip */}
        <MoversStrip positions={positions} totalValue={totalValue} />

        {/* Allocation donut + top holdings */}
        <AllocationChart positions={positions} totalValue={totalValue} />

        {/* Sector breakdown */}
        <SectorBreakdown positions={positions} />

        {/* Positions table */}
        <PositionsTable positions={positions} totalValue={totalValue} />

      </div>
    </div>
  )
}
