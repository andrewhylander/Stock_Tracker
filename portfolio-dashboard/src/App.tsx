import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import type { PortfolioDaily, Position } from './lib/supabase'
import SummaryCards from './components/SummaryCards'
import PortfolioChart from './components/PortfolioChart'
import PositionsTable from './components/PositionsTable'

export default function App() {
  const [history, setHistory] = useState<PortfolioDaily[]>([])
  const [latest, setLatest] = useState<PortfolioDaily | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [histRes, posRes] = await Promise.all([
          supabase
            .from('portfolio_daily')
            .select('*')
            .order('snapshot_date', { ascending: true }),
          supabase
            .from('latest_position_snapshots')
            .select('*')
            .order('gbp_value', { ascending: false }),
        ])

        if (histRes.error) throw histRes.error
        if (posRes.error) throw posRes.error

        const h = histRes.data ?? []
        setHistory(h)
        setLatest(h.length ? h[h.length - 1] : null)
        setPositions(posRes.data ?? [])
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Portfolio Dashboard</h1>
          {loading && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        <SummaryCards data={latest} />
        <PortfolioChart data={history} />
        <PositionsTable positions={positions} />
      </div>
    </div>
  )
}
