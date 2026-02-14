import { describe, it, expect } from 'vitest'
import {
  computeProjection,
  computeComparison,
  formatCurrency,
  formatMargin,
  formatDeltaCurrency,
  type ProjectionInputs,
  type ActualFinancials,
} from '../financials'

// ============================================
// FIXTURES
// ============================================

function baseInputs(overrides: Partial<ProjectionInputs> = {}): ProjectionInputs {
  return {
    surgeonMedianDuration: 90,
    facilityMedianDuration: 100,
    scheduledDuration: 120,
    defaultReimbursement: 5000,
    surgeonMedianReimbursement: 4800,
    facilityMedianReimbursement: 4500,
    orHourlyRate: 3000,
    costItems: [
      { amount: 500, categoryName: 'Soft Goods', categoryType: 'debit' },
      { amount: 300, categoryName: 'Hard Goods', categoryType: 'debit' },
      { amount: 200, categoryName: 'Vendor Credit', categoryType: 'credit' },
    ],
    ...overrides,
  }
}

// ============================================
// computeProjection
// ============================================

describe('computeProjection', () => {
  it('uses surgeon median duration as first priority', () => {
    const result = computeProjection(baseInputs())
    expect(result.projectedDuration).toBe(90)
    expect(result.durationSource).toContain('90 min')
  })

  it('includes surgeon name in duration source when provided', () => {
    const result = computeProjection(baseInputs(), 'Dr. Smith')
    expect(result.durationSource).toContain("Dr. Smith's median")
  })

  it('falls back to facility median when surgeon median is null', () => {
    const result = computeProjection(baseInputs({ surgeonMedianDuration: null }))
    expect(result.projectedDuration).toBe(100)
    expect(result.durationSource).toContain('Facility median')
  })

  it('falls back to scheduled duration when both medians are null', () => {
    const result = computeProjection(baseInputs({
      surgeonMedianDuration: null,
      facilityMedianDuration: null,
    }))
    expect(result.projectedDuration).toBe(120)
    expect(result.durationSource).toContain('Scheduled')
  })

  it('returns null duration when all sources are null', () => {
    const result = computeProjection(baseInputs({
      surgeonMedianDuration: null,
      facilityMedianDuration: null,
      scheduledDuration: null,
    }))
    expect(result.projectedDuration).toBeNull()
    expect(result.durationSource).toBeNull()
  })

  it('uses default reimbursement as first priority for revenue', () => {
    const result = computeProjection(baseInputs())
    expect(result.revenue).toBe(5000)
    expect(result.revenueSource).toBe('Procedure default')
  })

  it('falls back to surgeon median reimbursement when default is null', () => {
    const result = computeProjection(baseInputs({ defaultReimbursement: null }))
    expect(result.revenue).toBe(4800)
    expect(result.revenueSource).toBe('Surgeon median')
  })

  it('falls back to facility median reimbursement as last resort', () => {
    const result = computeProjection(baseInputs({
      defaultReimbursement: null,
      surgeonMedianReimbursement: null,
    }))
    expect(result.revenue).toBe(4500)
    expect(result.revenueSource).toBe('Facility median')
  })

  it('returns null revenue when all sources are null', () => {
    const result = computeProjection(baseInputs({
      defaultReimbursement: null,
      surgeonMedianReimbursement: null,
      facilityMedianReimbursement: null,
    }))
    expect(result.revenue).toBeNull()
    expect(result.revenueSource).toBeNull()
  })

  it('skips zero-value reimbursements', () => {
    const result = computeProjection(baseInputs({
      defaultReimbursement: 0,
      surgeonMedianReimbursement: 4800,
    }))
    expect(result.revenue).toBe(4800)
    expect(result.revenueSource).toBe('Surgeon median')
  })

  it('computes OR cost = (duration / 60) * hourly rate', () => {
    const result = computeProjection(baseInputs())
    // 90 / 60 * 3000 = 4500
    expect(result.orCost).toBe(4500)
  })

  it('returns null OR cost when duration is null', () => {
    const result = computeProjection(baseInputs({
      surgeonMedianDuration: null,
      facilityMedianDuration: null,
      scheduledDuration: null,
    }))
    expect(result.orCost).toBeNull()
  })

  it('returns null OR cost when hourly rate is null', () => {
    const result = computeProjection(baseInputs({ orHourlyRate: null }))
    expect(result.orCost).toBeNull()
  })

  it('sums debit cost items for supply debits', () => {
    const result = computeProjection(baseInputs())
    // 500 + 300 = 800
    expect(result.supplyDebits).toBe(800)
  })

  it('sums credit cost items for supply credits', () => {
    const result = computeProjection(baseInputs())
    expect(result.supplyCredits).toBe(200)
  })

  it('handles empty cost items', () => {
    const result = computeProjection(baseInputs({ costItems: [] }))
    expect(result.supplyDebits).toBe(0)
    expect(result.supplyCredits).toBe(0)
  })

  it('computes profit = revenue - OR cost - debits + credits', () => {
    const result = computeProjection(baseInputs())
    // 5000 - 4500 - 800 + 200 = -100
    expect(result.profit).toBe(-100)
  })

  it('returns null profit when revenue is null', () => {
    const result = computeProjection(baseInputs({
      defaultReimbursement: null,
      surgeonMedianReimbursement: null,
      facilityMedianReimbursement: null,
    }))
    expect(result.profit).toBeNull()
  })

  it('computes margin percent', () => {
    const result = computeProjection(baseInputs({
      orHourlyRate: 1000, // lower rate to get positive profit
      costItems: [],
    }))
    // revenue=5000, orCost=(90/60)*1000=1500, debits=0, credits=0
    // profit=3500, margin=3500/5000*100=70
    expect(result.profit).toBe(3500)
    expect(result.marginPercent).toBeCloseTo(70)
  })

  it('returns null margin when revenue is zero', () => {
    const result = computeProjection(baseInputs({
      defaultReimbursement: null,
      surgeonMedianReimbursement: null,
      facilityMedianReimbursement: null,
    }))
    expect(result.marginPercent).toBeNull()
  })

  it('hasData is true when any financial data exists', () => {
    const result = computeProjection(baseInputs())
    expect(result.hasData).toBe(true)
  })

  it('hasData is false when no financial data exists', () => {
    const result = computeProjection(baseInputs({
      defaultReimbursement: null,
      surgeonMedianReimbursement: null,
      facilityMedianReimbursement: null,
      orHourlyRate: null,
      surgeonMedianDuration: null,
      facilityMedianDuration: null,
      scheduledDuration: null,
      costItems: [],
    }))
    expect(result.hasData).toBe(false)
  })
})

// ============================================
// computeComparison
// ============================================

describe('computeComparison', () => {
  const projection = computeProjection(baseInputs({
    orHourlyRate: 1000,
    costItems: [
      { amount: 500, categoryName: 'Soft Goods', categoryType: 'debit' },
      { amount: 200, categoryName: 'Credit', categoryType: 'credit' },
    ],
  }))

  const actual: ActualFinancials = {
    reimbursement: 5200,
    totalDebits: 450,
    totalCredits: 250,
    orTimeCost: 1600,
    profit: 3400,
    totalDurationMinutes: 96,
    orHourlyRate: 1000,
  }

  it('produces 4 line items', () => {
    const result = computeComparison(projection, actual)
    expect(result.lineItems).toHaveLength(4)
    expect(result.lineItems.map(l => l.label)).toEqual([
      'Revenue', 'OR Time Cost', 'Supply Costs', 'Credits',
    ])
  })

  it('computes revenue delta (actual - projected)', () => {
    const result = computeComparison(projection, actual)
    const revenue = result.lineItems[0]
    expect(revenue.projected).toBe(5000)
    expect(revenue.actual).toBe(5200)
    expect(revenue.delta).toBe(200) // 5200 - 5000
    expect(revenue.isRevenue).toBe(true)
  })

  it('computes OR cost delta', () => {
    const result = computeComparison(projection, actual)
    const orCost = result.lineItems[1]
    // projected OR cost = (90/60)*1000 = 1500
    expect(orCost.projected).toBe(1500)
    expect(orCost.actual).toBe(1600)
    expect(orCost.delta).toBe(100) // 1600 - 1500 (cost went up)
    expect(orCost.isRevenue).toBe(false)
  })

  it('computes profit delta and margin', () => {
    const result = computeComparison(projection, actual)
    expect(result.projectedProfit).toBe(projection.profit)
    expect(result.actualProfit).toBe(3400)
    expect(result.profitDelta).toBe(3400 - projection.profit!)
    expect(result.actualMargin).toBeCloseTo((3400 / 5200) * 100)
  })

  it('handles null actuals gracefully', () => {
    const nullActual: ActualFinancials = {
      reimbursement: null,
      totalDebits: null,
      totalCredits: null,
      orTimeCost: null,
      profit: null,
      totalDurationMinutes: null,
      orHourlyRate: null,
    }
    const result = computeComparison(projection, nullActual)
    expect(result.lineItems[0].delta).toBeNull()
    expect(result.actualProfit).toBeNull()
    expect(result.profitDelta).toBeNull()
    expect(result.actualMargin).toBeNull()
  })
})

// ============================================
// FORMATTERS
// ============================================

describe('formatCurrency', () => {
  it('formats positive values', () => {
    expect(formatCurrency(5000)).toBe('$5,000')
  })

  it('formats negative values', () => {
    expect(formatCurrency(-1500)).toBe('-$1,500')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0')
  })

  it('returns em dash for null', () => {
    expect(formatCurrency(null)).toBe('\u2014')
  })
})

describe('formatMargin', () => {
  it('formats positive margin', () => {
    expect(formatMargin(70.5)).toBe('70.5%')
  })

  it('formats negative margin', () => {
    expect(formatMargin(-5.2)).toBe('-5.2%')
  })

  it('returns em dash for null', () => {
    expect(formatMargin(null)).toBe('\u2014')
  })
})

describe('formatDeltaCurrency', () => {
  it('formats positive delta with plus sign', () => {
    expect(formatDeltaCurrency(200)).toBe('+$200')
  })

  it('formats negative delta', () => {
    expect(formatDeltaCurrency(-300)).toBe('-$300')
  })

  it('formats zero with plus sign', () => {
    expect(formatDeltaCurrency(0)).toBe('+$0')
  })

  it('returns em dash for null', () => {
    expect(formatDeltaCurrency(null)).toBe('\u2014')
  })
})
