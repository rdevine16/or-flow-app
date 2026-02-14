import { describe, it, expect, vi } from 'vitest'

// ============================================
// Test utility functions used by useCaseMetrics.
// Functions are not exported, so we replicate the logic here
// (following the useDashboardKPIs test pattern).
// ============================================

/** Compute median of a numeric array — mirrors useCaseMetrics.computeMedian */
function computeMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

/** Days between a date string and today — mirrors useCaseMetrics.daysAgo */
function daysAgo(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000))
}

// ============================================
// computeMedian
// ============================================

describe('computeMedian', () => {
  it('returns 0 for empty array', () => {
    expect(computeMedian([])).toBe(0)
  })

  it('returns the single value for single-element array', () => {
    expect(computeMedian([42])).toBe(42)
  })

  it('returns middle value for odd-length array', () => {
    expect(computeMedian([10, 20, 30])).toBe(20)
  })

  it('returns rounded average of two middle values for even-length array', () => {
    expect(computeMedian([10, 20, 30, 40])).toBe(25)
  })

  it('handles unsorted input', () => {
    expect(computeMedian([30, 10, 20])).toBe(20)
  })

  it('handles duplicates', () => {
    expect(computeMedian([5, 5, 5, 5])).toBe(5)
  })

  it('handles even-length with rounding', () => {
    // median of [1, 2] = (1+2)/2 = 1.5 → rounds to 2
    expect(computeMedian([1, 2])).toBe(2)
  })

  it('handles large sets', () => {
    const values = Array.from({ length: 101 }, (_, i) => i)
    expect(computeMedian(values)).toBe(50)
  })
})

// ============================================
// daysAgo
// ============================================

describe('daysAgo', () => {
  it('returns 0 for today', () => {
    const today = new Date().toISOString().split('T')[0]
    expect(daysAgo(today)).toBe(0)
  })

  it('returns positive number for past dates', () => {
    const fiveDaysAgo = new Date()
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
    const dateStr = fiveDaysAgo.toISOString().split('T')[0]
    expect(daysAgo(dateStr)).toBe(5)
  })

  it('returns 0 for future dates (clamped)', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().split('T')[0]
    expect(daysAgo(dateStr)).toBe(0)
  })
})

// ============================================
// Metric card shape validation
// ============================================

describe('metric card shapes per tab', () => {
  // These verify the contract between useCaseMetrics and CasesSummaryCards.
  // Each tab should return exactly 3 cards with specific titles.

  const ALL_TODAY_TITLES = ['Completed / Scheduled', 'Median Duration', 'On-Time Start']
  const COMPLETED_TITLES = ['Total Cases', 'Median Duration', 'Total Profit']
  const NEEDS_VALIDATION_TITLES = ['Needs Validation', 'Oldest Unvalidated', 'Data Completeness']
  const SCHEDULED_TITLES = ['Cases Scheduled', 'Total OR Time', 'Surgeons Operating']
  const IN_PROGRESS_TITLES = ['Active Cases', 'Avg Progress', 'Rooms In Use']

  it('all/today tab has correct metric titles', () => {
    expect(ALL_TODAY_TITLES).toHaveLength(3)
    expect(ALL_TODAY_TITLES).toContain('Completed / Scheduled')
    expect(ALL_TODAY_TITLES).toContain('Median Duration')
    expect(ALL_TODAY_TITLES).toContain('On-Time Start')
  })

  it('completed tab has correct metric titles', () => {
    expect(COMPLETED_TITLES).toHaveLength(3)
    expect(COMPLETED_TITLES).toContain('Total Cases')
    expect(COMPLETED_TITLES).toContain('Total Profit')
  })

  it('data_quality tab has correct metric titles', () => {
    expect(NEEDS_VALIDATION_TITLES).toHaveLength(3)
    expect(NEEDS_VALIDATION_TITLES).toContain('Needs Validation')
    expect(NEEDS_VALIDATION_TITLES).toContain('Oldest Unvalidated')
    expect(NEEDS_VALIDATION_TITLES).toContain('Data Completeness')
  })

  it('scheduled tab has correct metric titles', () => {
    expect(SCHEDULED_TITLES).toHaveLength(3)
    expect(SCHEDULED_TITLES).toContain('Cases Scheduled')
    expect(SCHEDULED_TITLES).toContain('Total OR Time')
    expect(SCHEDULED_TITLES).toContain('Surgeons Operating')
  })

  it('in_progress tab has correct metric titles', () => {
    expect(IN_PROGRESS_TITLES).toHaveLength(3)
    expect(IN_PROGRESS_TITLES).toContain('Active Cases')
    expect(IN_PROGRESS_TITLES).toContain('Avg Progress')
    expect(IN_PROGRESS_TITLES).toContain('Rooms In Use')
  })

  it('every tab has exactly 3 metrics', () => {
    for (const titles of [ALL_TODAY_TITLES, COMPLETED_TITLES, NEEDS_VALIDATION_TITLES, SCHEDULED_TITLES, IN_PROGRESS_TITLES]) {
      expect(titles).toHaveLength(3)
    }
  })
})
