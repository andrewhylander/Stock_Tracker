import type { PortfolioDaily, Position, BenchmarkDaily } from '../lib/supabase'
import SummaryCards from '../components/SummaryCards'
import MoversStrip from '../components/MoversStrip'
import PortfolioChart from '../components/PortfolioChart'
import AllocationChart from '../components/AllocationChart'
import SectorBreakdown from '../components/SectorBreakdown'
import PositionsTable from '../components/PositionsTable'

interface Props {
  latest: PortfolioDaily | null
  history: PortfolioDaily[]
  positions: Position[]
  benchmark: BenchmarkDaily[]
  totalValue: number
}

export default function Overview({ latest, history, positions, benchmark, totalValue }: Props) {
  return (
    <div className="space-y-6">
      <SummaryCards latest={latest} positions={positions} />
      <PortfolioChart data={history} benchmark={benchmark} />
      <MoversStrip positions={positions} totalValue={totalValue} />
      <AllocationChart positions={positions} totalValue={totalValue} />
      <SectorBreakdown positions={positions} />
      <PositionsTable positions={positions} totalValue={totalValue} />
    </div>
  )
}
