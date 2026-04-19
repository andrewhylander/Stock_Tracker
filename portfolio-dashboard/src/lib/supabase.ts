import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface PortfolioDaily {
  snapshot_date: string
  total_gbp_value: number
  total_unrealised_pl: number
  total_unrealised_pl_pct: number
  cash_gbp: number
  invested_gbp: number
}

export interface BenchmarkDaily {
  snapshot_date: string
  symbol: string
  price_usd: number
}

export interface Position {
  id: number
  snapshot_date: string
  brokerage: string
  exchange: string
  ticker: string
  category: string
  sector: string
  region: string
  currency: string
  share_price: number
  share_count: number
  gbp_value: number
  avg_cost: number
  fx_rate: number
  unrealised_pl: number
  unrealised_pl_pct: number
  dividend: number
  dividend_pct: number
  dividend_return: number
}
