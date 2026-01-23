// ============================================
// FORMATTING FUNCTIONS
// ============================================

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return `${value.toFixed(1)}%`
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '-'
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
}

// ============================================
// DATE FORMATTING
// ============================================

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  })
}

export function formatShortDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric'
  })
}

// ============================================
// CALCULATION HELPERS (for UI display)
// ============================================

/**
 * Calculate profit margin as a percentage
 */
export function calculateMargin(profit: number, reimbursement: number): number {
  if (reimbursement === 0) return 0
  return (profit / reimbursement) * 100
}

/**
 * Calculate consistency rating based on coefficient of variation
 * CV = stddev / mean
 */
export function getConsistencyRating(
  median: number | null, 
  stddev: number | null
): 'high' | 'medium' | 'low' | null {
  if (median === null || stddev === null || median === 0) return null
  const cv = stddev / median
  if (cv < 0.15) return 'high'    // < 15% variation
  if (cv < 0.30) return 'medium'  // 15-30% variation
  return 'low'                     // > 30% variation
}

/**
 * Format a number with +/- sign for comparison displays
 */
export function formatDiff(value: number, formatter: (v: number) => string = String): string {
  const formatted = formatter(Math.abs(value))
  return value >= 0 ? `+${formatted}` : `-${formatted}`
}

/**
 * Format minutes difference with +/- sign
 */
export function formatMinutesDiff(minutes: number): string {
  const sign = minutes >= 0 ? '+' : ''
  return `${sign}${Math.round(minutes)} min`
}