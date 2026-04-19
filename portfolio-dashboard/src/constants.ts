export const CAT_COLORS: Record<string, string> = {
  ETF:       '#4f8eff',
  SoFi:      '#9b7fff',
  Cash:      '#4e5d74',
  'MAG 7':   '#1fc48a',
  Growth:    '#f5c142',
  Crypto:    '#f97316',
  Options:   '#ec4899',
  Dividend:  '#22d3ee',
}

export const DEFAULT_COLOR = '#4e5d74'

export function catColor(cat: string) {
  return CAT_COLORS[cat] ?? DEFAULT_COLOR
}

export function catBg(cat: string) {
  const hex = (catColor(cat)).replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r},${g},${b},0.12)`
}

export function fmtGbp(n: number, dp = 2) {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

export function fmtGbpShort(n: number) {
  if (n >= 1_000_000) return '£' + (n / 1_000_000).toFixed(1) + 'm'
  if (n >= 1_000) return '£' + (n / 1_000).toFixed(1) + 'k'
  return fmtGbp(n, 0)
}

export function plClass(v: number) {
  return v > 0 ? 'text-[#1fc48a]' : v < 0 ? 'text-[#f26b6b]' : 'text-[#4e5d74]'
}

export function plSign(v: number) {
  return v >= 0 ? '+' : ''
}
