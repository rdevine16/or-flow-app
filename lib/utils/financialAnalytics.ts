// lib/utils/financialAnalytics.ts
// Pure functions and types for enhanced financial analytics.
// Used by useFinancialComparison hook and the revamped CaseDrawerFinancials component.

import type {
  CostItem,
  FinancialProjection,
  FinancialComparison,
  ActualFinancials,
} from '@/lib/financials'

// ============================================
// TYPES
// ============================================

export type MarginRating = 'excellent' | 'good' | 'fair' | 'poor'

export interface MarginBenchmark {
  median_margin: number | null
  case_count: number
}

export interface FinancialHeroMetrics {
  margin_percentage: number | null
  surgeon_margin_rating: MarginRating
  facility_margin_rating: MarginRating
  profit: number | null
  revenue: number | null
  total_costs: number | null
  surgeon_median_margin: number | null
  facility_median_margin: number | null
  surgeon_case_count: number
  facility_case_count: number
}

export interface CostBreakdownItem {
  category: string
  amount: number
  percentage_of_total: number
  source: 'actual' | 'projected'
}

export interface FullDayCase {
  case_id: string
  case_number: string
  procedure_name: string
  status: string
  revenue: number | null
  total_costs: number | null
  profit: number | null
  margin_pct: number | null
}

export interface FullDaySurgeonForecast {
  surgeon_name: string
  surgeon_id: string
  cases: FullDayCase[]
  total_revenue: number
  total_costs: number
  total_profit: number
  total_margin: number | null
}

export interface DataQuality {
  has_costs: boolean
  has_revenue: boolean
  cost_source: 'actual' | 'projected' | 'none'
  confidence: 'high' | 'medium' | 'low'
}

export interface CaseFinancialData {
  hero: FinancialHeroMetrics
  cost_breakdown: CostBreakdownItem[]
  projected_vs_actual: FinancialComparison | null
  full_day_forecast: FullDaySurgeonForecast | null
  data_quality: DataQuality
  projection: FinancialProjection | null
  actual: ActualFinancials | null
}

// ============================================
// MEDIAN CALCULATION
// ============================================

/**
 * Compute the median of a numeric array.
 * Returns null for empty arrays.
 */
export function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

// ============================================
// MARGIN RATING (per Q&A A7)
// ============================================

/**
 * Calculate margin rating based on comparison to a benchmark median.
 *
 * Logic (per A7):
 * - < 10 cases in benchmark: always 'good' (green, insufficient data)
 * - margin >= medianMargin: 'excellent' (green)
 * - margin >= medianMargin * 0.9: 'fair' (amber, within 10% below)
 * - margin < medianMargin * 0.9: 'poor' (red, >10% below)
 */
export function calculateMarginRating(
  margin: number | null,
  medianMargin: number | null,
  caseCount: number,
): MarginRating {
  if (margin == null) return 'good'
  if (caseCount < 10) return 'good'
  if (medianMargin == null) return 'good'

  // Handle edge case: median margin is zero or negative
  if (medianMargin <= 0) {
    return margin >= 0 ? 'excellent' : 'poor'
  }

  if (margin >= medianMargin) return 'excellent'
  if (margin >= medianMargin * 0.9) return 'fair'
  return 'poor'
}

// ============================================
// HERO METRICS
// ============================================

/**
 * Build hero metrics from projection/actual data and benchmarks.
 * Uses actual data if available, otherwise projection.
 */
export function buildHeroMetrics(
  projection: FinancialProjection | null,
  actual: ActualFinancials | null,
  surgeonBenchmark: MarginBenchmark | null,
  facilityBenchmark: MarginBenchmark | null,
): FinancialHeroMetrics {
  // Determine margin/profit/revenue/costs from actual or projection
  const isActual = actual != null && actual.reimbursement != null
  const revenue = isActual ? actual.reimbursement : projection?.revenue ?? null
  const profit = isActual ? actual.profit : projection?.profit ?? null
  const marginPct = isActual
    ? (revenue != null && revenue > 0 && profit != null
        ? (profit / revenue) * 100
        : null)
    : projection?.marginPercent ?? null

  // Compute total costs
  let totalCosts: number | null = null
  if (isActual) {
    const orCost = actual.orTimeCost ?? 0
    const debits = actual.totalDebits ?? 0
    const credits = actual.totalCredits ?? 0
    totalCosts = orCost + debits - credits
  } else if (projection) {
    totalCosts = (projection.orCost ?? 0) + projection.supplyDebits - projection.supplyCredits
  }

  const surgeonMedianMargin = surgeonBenchmark?.median_margin ?? null
  const facilityMedianMargin = facilityBenchmark?.median_margin ?? null
  const surgeonCaseCount = surgeonBenchmark?.case_count ?? 0
  const facilityCaseCount = facilityBenchmark?.case_count ?? 0

  return {
    margin_percentage: marginPct,
    surgeon_margin_rating: calculateMarginRating(marginPct, surgeonMedianMargin, surgeonCaseCount),
    facility_margin_rating: calculateMarginRating(marginPct, facilityMedianMargin, facilityCaseCount),
    profit,
    revenue,
    total_costs: totalCosts,
    surgeon_median_margin: surgeonMedianMargin,
    facility_median_margin: facilityMedianMargin,
    surgeon_case_count: surgeonCaseCount,
    facility_case_count: facilityCaseCount,
  }
}

// ============================================
// COST BREAKDOWN
// ============================================

/**
 * Build categorized cost breakdown with percentage of total.
 * Combines OR time cost with itemized supply costs.
 */
export function buildCostBreakdown(
  costItems: CostItem[],
  orCost: number | null,
  source: 'actual' | 'projected',
): CostBreakdownItem[] {
  const items: CostBreakdownItem[] = []

  // OR Time Cost
  if (orCost != null && orCost > 0) {
    items.push({
      category: 'OR Time',
      amount: orCost,
      percentage_of_total: 0, // calculated below
      source,
    })
  }

  // Group cost items by category
  const categoryTotals = new Map<string, number>()
  for (const item of costItems) {
    if (item.categoryType === 'credit') continue // credits handled separately
    const current = categoryTotals.get(item.categoryName) ?? 0
    categoryTotals.set(item.categoryName, current + item.amount)
  }

  categoryTotals.forEach((amount, category) => {
    if (amount <= 0) return
    items.push({
      category,
      amount,
      percentage_of_total: 0, // calculated below
      source,
    })
  })

  // Credits (as a single negative line)
  const totalCredits = costItems
    .filter(i => i.categoryType === 'credit')
    .reduce((sum, i) => sum + i.amount, 0)
  if (totalCredits > 0) {
    items.push({
      category: 'Credits',
      amount: -totalCredits,
      percentage_of_total: 0,
      source,
    })
  }

  // Sort by absolute amount descending (excluding credits)
  items.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))

  // Calculate percentages based on total costs (positive items only)
  const totalCosts = items
    .filter(i => i.amount > 0)
    .reduce((sum, i) => sum + i.amount, 0)

  if (totalCosts > 0) {
    for (const item of items) {
      item.percentage_of_total = item.amount > 0
        ? Math.round((item.amount / totalCosts) * 100)
        : 0
    }
  }

  return items
}

// ============================================
// FULL DAY FORECAST
// ============================================

/**
 * Transform raw DB rows from get_full_day_financials into typed forecast.
 */
export function buildFullDayForecast(
  rows: FullDayCase[],
  surgeonId: string,
  surgeonName: string,
): FullDaySurgeonForecast {
  const totalRevenue = rows.reduce((sum, r) => sum + (r.revenue ?? 0), 0)
  const totalCosts = rows.reduce((sum, r) => sum + (r.total_costs ?? 0), 0)
  const totalProfit = rows.reduce((sum, r) => sum + (r.profit ?? 0), 0)
  const totalMargin = totalRevenue > 0
    ? (totalProfit / totalRevenue) * 100
    : null

  return {
    surgeon_name: surgeonName,
    surgeon_id: surgeonId,
    cases: rows,
    total_revenue: totalRevenue,
    total_costs: totalCosts,
    total_profit: totalProfit,
    total_margin: totalMargin,
  }
}

// ============================================
// DATA QUALITY
// ============================================

/**
 * Assess confidence of financial data.
 * - 'high': actual data available (case completed + validated)
 * - 'medium': projected from surgeon history (>= 5 cases)
 * - 'low': projected from facility defaults or insufficient data
 */
export function assessDataQuality(
  hasActuals: boolean,
  hasRevenue: boolean,
  hasCosts: boolean,
  surgeonCaseCount: number,
): DataQuality {
  const costSource: DataQuality['cost_source'] = hasActuals
    ? 'actual'
    : hasCosts
      ? 'projected'
      : 'none'

  let confidence: DataQuality['confidence'] = 'low'
  if (hasActuals && hasRevenue && hasCosts) {
    confidence = 'high'
  } else if (hasRevenue && hasCosts && surgeonCaseCount >= 5) {
    confidence = 'medium'
  }

  return {
    has_costs: hasCosts,
    has_revenue: hasRevenue,
    cost_source: costSource,
    confidence,
  }
}
