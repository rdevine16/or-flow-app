// components/analytics/financials/utils.ts

/**
 * Format a number as USD currency
 * Handles negative values with parentheses (accounting format)
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'

  const absValue = Math.abs(value)
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(absValue)

  if (value < 0) return `(${formatted})`
  return formatted
}

/**
 * Format as percentage with 1 decimal
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${value.toFixed(1)}%`
}

/**
 * Format duration in minutes to human-readable
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—'
  const hrs = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hrs > 0) return `${hrs}h ${mins}m`
  return `${mins}m`
}

/**
 * Format large numbers compactly (e.g., $1.2M, $450K)
 */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (absValue >= 1_000_000) {
    return `${sign}$${(absValue / 1_000_000).toFixed(1)}M`
  }
  if (absValue >= 1_000) {
    return `${sign}$${(absValue / 1_000).toFixed(0)}K`
  }
  return formatCurrency(value)
}

/**
 * Format currency with K suffix (e.g., $4.2k, $850)
 * Used in compact table cells and chart labels
 */
export function fmtK(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1000) {
    const k = abs / 1000
    return `${sign}$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`
  }
  return `${sign}$${abs.toLocaleString()}`
}

/**
 * Short duration format (e.g., "1h 32m", "45m")
 * Alias for formatDuration, kept for mockup consistency
 */
export const fmtDur = formatDuration

/**
 * Format hour/minute to 12-hour time string (e.g., "7:30 AM")
 */
export function fmtTime(hours: number, minutes: number): string {
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${suffix}`
}

/**
 * Format a raw number with $ prefix (no K/M suffix)
 * Used for exact amounts in tooltips
 */
export function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `$${Math.abs(value).toLocaleString()}`
}

/**
 * Normalize Supabase join data — handles both single object and array forms
 */
export function normalizeJoin<T>(data: T | T[] | null | undefined): T | null {
  if (Array.isArray(data)) return data[0] || null
  return data ?? null
}

/**
 * Standard payer color palette for charts
 */
export const PAYER_COLORS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444',
  '#10b981', '#ec4899', '#6366f1', '#14b8a6', '#f97316',
] as const

/**
 * Compute median of a number array
 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Compute percentile of a number array
 */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (idx - lower) * (sorted[upper] - sorted[lower])
}

/**
 * Map phase_group values to PhasePill colors
 */
export function phaseGroupColor(group: string): 'blue' | 'green' | 'amber' | 'violet' {
  switch (group) {
    case 'pre_op': return 'blue'
    case 'surgical': return 'green'
    case 'closing': return 'amber'
    case 'post_op': return 'violet'
    default: return 'blue'
  }
}