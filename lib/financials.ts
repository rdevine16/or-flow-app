// lib/financials.ts
// Pure financial calculation functions for the case drawer financials tab.
// Separated from React for testability and potential iOS reuse.

// ============================================
// TYPES
// ============================================

export interface CostItem {
  amount: number
  categoryName: string
  categoryType: 'debit' | 'credit'
}

export interface ProjectionInputs {
  /** Surgeon's median duration for this procedure (first priority) */
  surgeonMedianDuration: number | null
  /** Facility median duration for this procedure (fallback) */
  facilityMedianDuration: number | null
  /** Case scheduled duration (last resort fallback) */
  scheduledDuration: number | null

  /** Default procedure reimbursement rate (first priority) */
  defaultReimbursement: number | null
  /** Surgeon's median reimbursement for this procedure (fallback) */
  surgeonMedianReimbursement: number | null
  /** Facility median reimbursement (last resort) */
  facilityMedianReimbursement: number | null

  /** Facility OR hourly rate */
  orHourlyRate: number | null

  /** Itemized supply costs from procedure_cost_items */
  costItems: CostItem[]
}

export interface FinancialProjection {
  revenue: number | null
  revenueSource: string | null

  orCost: number | null
  projectedDuration: number | null
  durationSource: string | null

  supplyDebits: number
  supplyCredits: number

  profit: number | null
  marginPercent: number | null

  costItemBreakdown: CostItem[]

  hasData: boolean
}

export interface ActualFinancials {
  reimbursement: number | null
  totalDebits: number | null
  totalCredits: number | null
  orTimeCost: number | null
  profit: number | null
  totalDurationMinutes: number | null
  orHourlyRate: number | null
}

export interface FinancialLineItem {
  label: string
  projected: number | null
  actual: number | null
  delta: number | null
  /** true = higher is better (revenue/credits), false = lower is better (costs) */
  isRevenue: boolean
}

export interface FinancialComparison {
  lineItems: FinancialLineItem[]
  projectedProfit: number | null
  actualProfit: number | null
  profitDelta: number | null
  projectedMargin: number | null
  actualMargin: number | null
}

// ============================================
// PROJECTION
// ============================================

export function computeProjection(
  inputs: ProjectionInputs,
  surgeonName?: string | null,
): FinancialProjection {
  // Resolve duration: surgeon median → facility median → scheduled
  let projectedDuration: number | null = null
  let durationSource: string | null = null

  if (inputs.surgeonMedianDuration != null) {
    projectedDuration = inputs.surgeonMedianDuration
    durationSource = surgeonName
      ? `Based on ${surgeonName}'s median of ${Math.round(inputs.surgeonMedianDuration)} min`
      : `Surgeon median: ${Math.round(inputs.surgeonMedianDuration)} min`
  } else if (inputs.facilityMedianDuration != null) {
    projectedDuration = inputs.facilityMedianDuration
    durationSource = `Facility median: ${Math.round(inputs.facilityMedianDuration)} min`
  } else if (inputs.scheduledDuration != null) {
    projectedDuration = inputs.scheduledDuration
    durationSource = `Scheduled: ${Math.round(inputs.scheduledDuration)} min`
  }

  // Resolve revenue: procedure default → surgeon median → facility median
  let revenue: number | null = null
  let revenueSource: string | null = null

  if (inputs.defaultReimbursement != null && inputs.defaultReimbursement > 0) {
    revenue = inputs.defaultReimbursement
    revenueSource = 'Procedure default'
  } else if (inputs.surgeonMedianReimbursement != null && inputs.surgeonMedianReimbursement > 0) {
    revenue = inputs.surgeonMedianReimbursement
    revenueSource = 'Surgeon median'
  } else if (inputs.facilityMedianReimbursement != null && inputs.facilityMedianReimbursement > 0) {
    revenue = inputs.facilityMedianReimbursement
    revenueSource = 'Facility median'
  }

  // OR cost = (duration / 60) × hourly rate
  let orCost: number | null = null
  if (projectedDuration != null && inputs.orHourlyRate != null && inputs.orHourlyRate > 0) {
    orCost = (projectedDuration / 60) * inputs.orHourlyRate
  }

  // Supply costs by category type
  const supplyDebits = inputs.costItems
    .filter(item => item.categoryType === 'debit')
    .reduce((sum, item) => sum + item.amount, 0)

  const supplyCredits = inputs.costItems
    .filter(item => item.categoryType === 'credit')
    .reduce((sum, item) => sum + item.amount, 0)

  // Profit = revenue - OR cost - debits + credits
  let profit: number | null = null
  if (revenue != null) {
    profit = revenue - (orCost ?? 0) - supplyDebits + supplyCredits
  }

  // Margin %
  let marginPercent: number | null = null
  if (revenue != null && revenue > 0 && profit != null) {
    marginPercent = (profit / revenue) * 100
  }

  const hasData = revenue != null || orCost != null || supplyDebits > 0 || supplyCredits > 0

  return {
    revenue,
    revenueSource,
    orCost,
    projectedDuration,
    durationSource,
    supplyDebits,
    supplyCredits,
    profit,
    marginPercent,
    costItemBreakdown: inputs.costItems,
    hasData,
  }
}

// ============================================
// COMPARISON (projected vs actual)
// ============================================

export function computeComparison(
  projection: FinancialProjection,
  actual: ActualFinancials,
): FinancialComparison {
  const lineItems: FinancialLineItem[] = [
    {
      label: 'Revenue',
      projected: projection.revenue,
      actual: actual.reimbursement,
      delta: safeDelta(projection.revenue, actual.reimbursement),
      isRevenue: true,
    },
    {
      label: 'OR Time Cost',
      projected: projection.orCost,
      actual: actual.orTimeCost,
      delta: safeDelta(projection.orCost, actual.orTimeCost),
      isRevenue: false,
    },
    {
      label: 'Supply Costs',
      projected: projection.supplyDebits > 0 ? projection.supplyDebits : null,
      actual: actual.totalDebits,
      delta: safeDelta(
        projection.supplyDebits > 0 ? projection.supplyDebits : null,
        actual.totalDebits,
      ),
      isRevenue: false,
    },
    {
      label: 'Credits',
      projected: projection.supplyCredits > 0 ? projection.supplyCredits : null,
      actual: actual.totalCredits,
      delta: safeDelta(
        projection.supplyCredits > 0 ? projection.supplyCredits : null,
        actual.totalCredits,
      ),
      isRevenue: true,
    },
  ]

  const actualProfit = actual.profit
  const actualRevenue = actual.reimbursement
  const actualMargin =
    actualRevenue != null && actualRevenue > 0 && actualProfit != null
      ? (actualProfit / actualRevenue) * 100
      : null

  return {
    lineItems,
    projectedProfit: projection.profit,
    actualProfit,
    profitDelta: safeDelta(projection.profit, actualProfit),
    projectedMargin: projection.marginPercent,
    actualMargin,
  }
}

// ============================================
// FORMATTERS
// ============================================

export function formatCurrency(value: number | null): string {
  if (value == null) return '\u2014'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatMargin(value: number | null): string {
  if (value == null) return '\u2014'
  return `${value.toFixed(1)}%`
}

export function formatDeltaCurrency(value: number | null): string {
  if (value == null) return '\u2014'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${formatCurrency(value)}`
}

// ============================================
// HELPERS
// ============================================

function safeDelta(projected: number | null, actual: number | null): number | null {
  if (projected == null || actual == null) return null
  return actual - projected
}
