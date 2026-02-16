import { describe, it, expect } from 'vitest'
import {
  computeMedian,
  calculateMarginRating,
  buildHeroMetrics,
  buildCostBreakdown,
  buildFullDayForecast,
  assessDataQuality,
  type MarginBenchmark,
  type FullDayCase,
} from '../utils/financialAnalytics'
import type {
  FinancialProjection,
  ActualFinancials,
  CostItem,
} from '../financials'

// ============================================
// FIXTURES
// ============================================

function baseProjection(overrides: Partial<FinancialProjection> = {}): FinancialProjection {
  return {
    revenue: 5000,
    revenueSource: 'Procedure default',
    orCost: 1500,
    projectedDuration: 90,
    durationSource: "Based on Dr. Smith's median of 90 min",
    supplyDebits: 800,
    supplyCredits: 200,
    profit: 2900, // 5000 - 1500 - 800 + 200
    marginPercent: 58, // (2900/5000)*100
    costItemBreakdown: [
      { amount: 500, categoryName: 'Soft Goods', categoryType: 'debit' },
      { amount: 300, categoryName: 'Hard Goods', categoryType: 'debit' },
      { amount: 200, categoryName: 'Vendor Credit', categoryType: 'credit' },
    ],
    hasData: true,
    ...overrides,
  }
}

function baseActual(overrides: Partial<ActualFinancials> = {}): ActualFinancials {
  return {
    reimbursement: 5200,
    totalDebits: 750,
    totalCredits: 250,
    orTimeCost: 1600,
    profit: 3100,
    totalDurationMinutes: 96,
    orHourlyRate: 1000,
    ...overrides,
  }
}

// ============================================
// computeMedian
// ============================================

describe('computeMedian', () => {
  it('returns null for empty array', () => {
    expect(computeMedian([])).toBeNull()
  })

  it('returns the single value for array of one', () => {
    expect(computeMedian([42])).toBe(42)
  })

  it('returns middle value for odd-length array', () => {
    expect(computeMedian([1, 3, 5])).toBe(3)
  })

  it('returns average of two middle values for even-length array', () => {
    expect(computeMedian([1, 3, 5, 7])).toBe(4)
  })

  it('handles unsorted input', () => {
    expect(computeMedian([5, 1, 3])).toBe(3)
  })

  it('handles negative values', () => {
    expect(computeMedian([-10, -5, 0, 5, 10])).toBe(0)
  })

  it('handles duplicate values', () => {
    expect(computeMedian([3, 3, 3, 3])).toBe(3)
  })
})

// ============================================
// calculateMarginRating
// ============================================

describe('calculateMarginRating', () => {
  it('returns good when margin is null', () => {
    expect(calculateMarginRating(null, 50, 20)).toBe('good')
  })

  it('returns good when case count is below 10', () => {
    expect(calculateMarginRating(20, 50, 9)).toBe('good')
  })

  it('returns good when median margin is null', () => {
    expect(calculateMarginRating(40, null, 20)).toBe('good')
  })

  it('returns excellent when margin >= median', () => {
    expect(calculateMarginRating(55, 50, 20)).toBe('excellent')
  })

  it('returns excellent when margin equals median', () => {
    expect(calculateMarginRating(50, 50, 20)).toBe('excellent')
  })

  it('returns fair when within 10% below median', () => {
    // 50 * 0.9 = 45 → margin 46 is within 10% below
    expect(calculateMarginRating(46, 50, 20)).toBe('fair')
  })

  it('returns poor when more than 10% below median', () => {
    // 50 * 0.9 = 45 → margin 44 is >10% below
    expect(calculateMarginRating(44, 50, 20)).toBe('poor')
  })

  it('handles zero median: positive margin = excellent', () => {
    expect(calculateMarginRating(5, 0, 20)).toBe('excellent')
  })

  it('handles zero median: negative margin = poor', () => {
    expect(calculateMarginRating(-5, 0, 20)).toBe('poor')
  })

  it('handles negative median: higher margin = excellent', () => {
    expect(calculateMarginRating(10, -5, 20)).toBe('excellent')
  })

  it('edge: exactly at 90% of median = fair', () => {
    // 50 * 0.9 = 45 → margin 45 should be 'fair'
    expect(calculateMarginRating(45, 50, 10)).toBe('fair')
  })
})

// ============================================
// buildHeroMetrics
// ============================================

describe('buildHeroMetrics', () => {
  const surgeonBenchmark: MarginBenchmark = {
    median_margin: 55,
    case_count: 25,
  }

  const facilityBenchmark: MarginBenchmark = {
    median_margin: 50,
    case_count: 100,
  }

  it('uses actual data when available', () => {
    const hero = buildHeroMetrics(
      baseProjection(),
      baseActual(),
      surgeonBenchmark,
      facilityBenchmark,
    )
    // Actual: revenue = 5200, profit = 3100
    expect(hero.revenue).toBe(5200)
    expect(hero.profit).toBe(3100)
    expect(hero.margin_percentage).toBeCloseTo((3100 / 5200) * 100, 1)
  })

  it('uses projection data when no actuals', () => {
    const hero = buildHeroMetrics(
      baseProjection(),
      null,
      surgeonBenchmark,
      facilityBenchmark,
    )
    expect(hero.revenue).toBe(5000)
    expect(hero.profit).toBe(2900)
    expect(hero.margin_percentage).toBe(58)
  })

  it('computes total costs from actuals', () => {
    const hero = buildHeroMetrics(
      baseProjection(),
      baseActual(),
      surgeonBenchmark,
      facilityBenchmark,
    )
    // orTimeCost=1600, debits=750, credits=250 → 1600 + 750 - 250 = 2100
    expect(hero.total_costs).toBe(2100)
  })

  it('computes total costs from projection', () => {
    const hero = buildHeroMetrics(
      baseProjection(),
      null,
      surgeonBenchmark,
      facilityBenchmark,
    )
    // orCost=1500, debits=800, credits=200 → 1500 + 800 - 200 = 2100
    expect(hero.total_costs).toBe(2100)
  })

  it('calculates surgeon margin rating', () => {
    const hero = buildHeroMetrics(
      baseProjection(),
      null,
      surgeonBenchmark,
      facilityBenchmark,
    )
    // margin=58, surgeon median=55, count=25 → 58 >= 55 → excellent
    expect(hero.surgeon_margin_rating).toBe('excellent')
  })

  it('calculates facility margin rating', () => {
    const hero = buildHeroMetrics(
      baseProjection(),
      null,
      surgeonBenchmark,
      facilityBenchmark,
    )
    // margin=58, facility median=50, count=100 → 58 >= 50 → excellent
    expect(hero.facility_margin_rating).toBe('excellent')
  })

  it('returns good for both ratings with no benchmarks', () => {
    const hero = buildHeroMetrics(baseProjection(), null, null, null)
    expect(hero.surgeon_margin_rating).toBe('good')
    expect(hero.facility_margin_rating).toBe('good')
  })

  it('returns good when below threshold with few cases', () => {
    const lowCountBenchmark: MarginBenchmark = {
      median_margin: 80,
      case_count: 5, // below 10 threshold
    }
    const hero = buildHeroMetrics(
      baseProjection(),
      null,
      lowCountBenchmark,
      facilityBenchmark,
    )
    // margin=58 < 80 but only 5 cases → good
    expect(hero.surgeon_margin_rating).toBe('good')
  })

  it('handles null projection and null actual', () => {
    const hero = buildHeroMetrics(null, null, surgeonBenchmark, facilityBenchmark)
    expect(hero.revenue).toBeNull()
    expect(hero.profit).toBeNull()
    expect(hero.margin_percentage).toBeNull()
    expect(hero.total_costs).toBeNull()
  })
})

// ============================================
// buildCostBreakdown
// ============================================

describe('buildCostBreakdown', () => {
  const costItems: CostItem[] = [
    { amount: 500, categoryName: 'Soft Goods', categoryType: 'debit' },
    { amount: 300, categoryName: 'Hard Goods', categoryType: 'debit' },
    { amount: 200, categoryName: 'Vendor Credit', categoryType: 'credit' },
  ]

  it('includes OR cost as first category (when largest)', () => {
    const breakdown = buildCostBreakdown(costItems, 1500, 'projected')
    const orItem = breakdown.find((b) => b.category === 'OR Time')
    expect(orItem).toBeDefined()
    expect(orItem!.amount).toBe(1500)
  })

  it('groups debit cost items by category', () => {
    const breakdown = buildCostBreakdown(costItems, 1500, 'projected')
    const softGoods = breakdown.find((b) => b.category === 'Soft Goods')
    expect(softGoods).toBeDefined()
    expect(softGoods!.amount).toBe(500)
  })

  it('aggregates credits into a single negative line', () => {
    const breakdown = buildCostBreakdown(costItems, 1500, 'projected')
    const credits = breakdown.find((b) => b.category === 'Credits')
    expect(credits).toBeDefined()
    expect(credits!.amount).toBe(-200)
  })

  it('sorts by absolute amount descending', () => {
    const breakdown = buildCostBreakdown(costItems, 1500, 'projected')
    const amounts = breakdown.map((b) => Math.abs(b.amount))
    for (let i = 1; i < amounts.length; i++) {
      expect(amounts[i]).toBeLessThanOrEqual(amounts[i - 1])
    }
  })

  it('calculates percentages from positive items only', () => {
    const breakdown = buildCostBreakdown(costItems, 1500, 'projected')
    // Total positive = 1500 + 500 + 300 = 2300
    const orItem = breakdown.find((b) => b.category === 'OR Time')!
    expect(orItem.percentage_of_total).toBe(Math.round((1500 / 2300) * 100))
  })

  it('handles empty cost items with OR cost', () => {
    const breakdown = buildCostBreakdown([], 1500, 'actual')
    expect(breakdown).toHaveLength(1)
    expect(breakdown[0].category).toBe('OR Time')
    expect(breakdown[0].percentage_of_total).toBe(100)
    expect(breakdown[0].source).toBe('actual')
  })

  it('handles null OR cost', () => {
    const breakdown = buildCostBreakdown(costItems, null, 'projected')
    const orItem = breakdown.find((b) => b.category === 'OR Time')
    expect(orItem).toBeUndefined()
    expect(breakdown.length).toBe(3) // 2 debits + 1 credits
  })

  it('handles zero OR cost', () => {
    const breakdown = buildCostBreakdown(costItems, 0, 'projected')
    const orItem = breakdown.find((b) => b.category === 'OR Time')
    expect(orItem).toBeUndefined()
  })

  it('handles all credits, no debits', () => {
    const allCredits: CostItem[] = [
      { amount: 100, categoryName: 'Vendor Credit', categoryType: 'credit' },
      { amount: 50, categoryName: 'Discount', categoryType: 'credit' },
    ]
    const breakdown = buildCostBreakdown(allCredits, null, 'projected')
    expect(breakdown).toHaveLength(1)
    expect(breakdown[0].category).toBe('Credits')
    expect(breakdown[0].amount).toBe(-150)
  })

  it('returns empty for no cost data', () => {
    const breakdown = buildCostBreakdown([], null, 'projected')
    expect(breakdown).toHaveLength(0)
  })

  it('merges same-category debits', () => {
    const dupes: CostItem[] = [
      { amount: 100, categoryName: 'Soft Goods', categoryType: 'debit' },
      { amount: 200, categoryName: 'Soft Goods', categoryType: 'debit' },
    ]
    const breakdown = buildCostBreakdown(dupes, null, 'projected')
    const soft = breakdown.find((b) => b.category === 'Soft Goods')
    expect(soft).toBeDefined()
    expect(soft!.amount).toBe(300)
  })
})

// ============================================
// buildFullDayForecast
// ============================================

describe('buildFullDayForecast', () => {
  const cases: FullDayCase[] = [
    {
      case_id: 'c1',
      case_number: 'CASE-001',
      procedure_name: 'TKA',
      status: 'completed',
      revenue: 5000,
      total_costs: 2000,
      profit: 3000,
      margin_pct: 60,
    },
    {
      case_id: 'c2',
      case_number: 'CASE-002',
      procedure_name: 'THA',
      status: 'scheduled',
      revenue: 4000,
      total_costs: 1800,
      profit: 2200,
      margin_pct: 55,
    },
  ]

  it('aggregates revenue, costs, profit', () => {
    const forecast = buildFullDayForecast(cases, 'surgeon-1', 'Dr. Smith')
    expect(forecast.total_revenue).toBe(9000)
    expect(forecast.total_costs).toBe(3800)
    expect(forecast.total_profit).toBe(5200)
  })

  it('calculates total margin from aggregated values', () => {
    const forecast = buildFullDayForecast(cases, 'surgeon-1', 'Dr. Smith')
    expect(forecast.total_margin).toBeCloseTo((5200 / 9000) * 100, 1)
  })

  it('sets surgeon info', () => {
    const forecast = buildFullDayForecast(cases, 'surgeon-1', 'Dr. Smith')
    expect(forecast.surgeon_name).toBe('Dr. Smith')
    expect(forecast.surgeon_id).toBe('surgeon-1')
  })

  it('preserves case list', () => {
    const forecast = buildFullDayForecast(cases, 'surgeon-1', 'Dr. Smith')
    expect(forecast.cases).toHaveLength(2)
    expect(forecast.cases[0].case_number).toBe('CASE-001')
  })

  it('handles single case', () => {
    const forecast = buildFullDayForecast([cases[0]], 'surgeon-1', 'Dr. Smith')
    expect(forecast.total_revenue).toBe(5000)
    expect(forecast.total_margin).toBeCloseTo(60, 0)
  })

  it('handles cases with null financials', () => {
    const nullCases: FullDayCase[] = [
      {
        case_id: 'c1',
        case_number: 'CASE-001',
        procedure_name: 'TKA',
        status: 'scheduled',
        revenue: null,
        total_costs: null,
        profit: null,
        margin_pct: null,
      },
    ]
    const forecast = buildFullDayForecast(nullCases, 'surgeon-1', 'Dr. Smith')
    expect(forecast.total_revenue).toBe(0)
    expect(forecast.total_costs).toBe(0)
    expect(forecast.total_profit).toBe(0)
    expect(forecast.total_margin).toBeNull()
  })

  it('returns null margin when total revenue is zero', () => {
    const zeroCases: FullDayCase[] = [
      {
        case_id: 'c1',
        case_number: 'CASE-001',
        procedure_name: 'TKA',
        status: 'scheduled',
        revenue: 0,
        total_costs: 500,
        profit: -500,
        margin_pct: null,
      },
    ]
    const forecast = buildFullDayForecast(zeroCases, 'surgeon-1', 'Dr. Smith')
    expect(forecast.total_margin).toBeNull()
  })
})

// ============================================
// assessDataQuality
// ============================================

describe('assessDataQuality', () => {
  it('returns high confidence for actual data with revenue and costs', () => {
    const quality = assessDataQuality(true, true, true, 20)
    expect(quality.confidence).toBe('high')
    expect(quality.cost_source).toBe('actual')
  })

  it('returns medium confidence for projected with sufficient surgeon history', () => {
    const quality = assessDataQuality(false, true, true, 10)
    expect(quality.confidence).toBe('medium')
    expect(quality.cost_source).toBe('projected')
  })

  it('returns low confidence for projected with insufficient surgeon history', () => {
    const quality = assessDataQuality(false, true, true, 3)
    expect(quality.confidence).toBe('low')
  })

  it('returns low confidence when no revenue', () => {
    const quality = assessDataQuality(false, false, true, 20)
    expect(quality.confidence).toBe('low')
    expect(quality.has_revenue).toBe(false)
  })

  it('returns low confidence when no costs', () => {
    const quality = assessDataQuality(false, true, false, 20)
    expect(quality.confidence).toBe('low')
    expect(quality.has_costs).toBe(false)
  })

  it('returns none cost source when no costs available', () => {
    const quality = assessDataQuality(false, true, false, 0)
    expect(quality.cost_source).toBe('none')
  })

  it('actual overrides cost source even with missing revenue', () => {
    const quality = assessDataQuality(true, false, true, 20)
    expect(quality.cost_source).toBe('actual')
    // confidence is low because hasRevenue=false
    expect(quality.confidence).toBe('low')
  })
})
