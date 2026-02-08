// components/analytics/financials/utils.ts
// UPDATED: Added formatPercent, formatRate, formatCompact for enterprise metrics

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