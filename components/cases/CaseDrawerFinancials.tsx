// components/cases/CaseDrawerFinancials.tsx
// Financials tab content for the case drawer.
// Shows projected financials for scheduled/in-progress, projected-vs-actual for completed.

'use client'

import {
  formatCurrency,
  formatMargin,
  formatDeltaCurrency,
  type FinancialProjection,
  type FinancialComparison,
  type ActualFinancials,
} from '@/lib/financials'
import {
  TrendingUp,
  TrendingDown,
  Info,
  AlertCircle,
  DollarSign,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

type CaseStatus = 'scheduled' | 'in_progress' | 'completed' | 'needs_validation' | 'cancelled' | 'on_hold'

interface CaseDrawerFinancialsProps {
  displayStatus: CaseStatus | string
  projection: FinancialProjection | null
  comparison: FinancialComparison | null
  actual: ActualFinancials | null
  loading: boolean
  error: string | null
  surgeonName: string | null
}

// ============================================
// HELPERS
// ============================================

/** Is this a "completed" case that should show actual data? */
function isCompletedStatus(status: string): boolean {
  return status === 'completed' || status === 'needs_validation'
}

/** Is the delta favorable? For revenue/credits: positive is good. For costs: negative is good. */
function isDeltaFavorable(delta: number, isRevenue: boolean): boolean {
  return isRevenue ? delta > 0 : delta < 0
}

// ============================================
// SUB-COMPONENTS
// ============================================

function FinancialsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-5 bg-slate-200 rounded w-1/3" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex justify-between py-3">
          <div className="h-4 bg-slate-100 rounded w-1/4" />
          <div className="h-4 bg-slate-100 rounded w-1/5" />
        </div>
      ))}
      <div className="h-px bg-slate-200" />
      <div className="flex justify-between py-3">
        <div className="h-5 bg-slate-200 rounded w-1/4" />
        <div className="h-5 bg-slate-200 rounded w-1/5" />
      </div>
    </div>
  )
}

function NoDataMessage({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <DollarSign className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  )
}

function SourceLabel({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <Info className="w-3 h-3 text-slate-400 flex-shrink-0" />
      <span className="text-[11px] text-slate-400">{text}</span>
    </div>
  )
}

/** Projection-only view for scheduled and in-progress cases */
function ProjectionView({
  projection,
  showInProgressNote,
}: {
  projection: FinancialProjection
  showInProgressNote: boolean
}) {
  if (!projection.hasData) {
    return <NoDataMessage message="Insufficient data for financial projection" />
  }

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Projected Financials
      </h3>

      {showInProgressNote && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg mb-4">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            Final financials available after completion and validation
          </p>
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {/* Revenue */}
        <div className="flex items-center justify-between py-2.5">
          <div>
            <span className="text-sm text-slate-700">Revenue</span>
            {projection.revenueSource && (
              <SourceLabel text={projection.revenueSource} />
            )}
          </div>
          <span className="text-sm font-medium text-slate-900">
            {formatCurrency(projection.revenue)}
          </span>
        </div>

        {/* OR Cost */}
        <div className="flex items-center justify-between py-2.5">
          <div>
            <span className="text-sm text-slate-700">OR Time Cost</span>
            {projection.durationSource && (
              <SourceLabel text={projection.durationSource} />
            )}
          </div>
          <span className="text-sm font-medium text-red-600">
            {projection.orCost != null ? `\u2212${formatCurrency(projection.orCost)}` : '\u2014'}
          </span>
        </div>

        {/* Supply Debits */}
        {projection.supplyDebits > 0 && (
          <div className="flex items-center justify-between py-2.5">
            <span className="text-sm text-slate-700">Supply Costs</span>
            <span className="text-sm font-medium text-red-600">
              {`\u2212${formatCurrency(projection.supplyDebits)}`}
            </span>
          </div>
        )}

        {/* Credits */}
        {projection.supplyCredits > 0 && (
          <div className="flex items-center justify-between py-2.5">
            <span className="text-sm text-slate-700">Credits</span>
            <span className="text-sm font-medium text-green-600">
              {`+${formatCurrency(projection.supplyCredits)}`}
            </span>
          </div>
        )}

        {/* Cost item breakdown (if any) */}
        {projection.costItemBreakdown.length > 0 && (
          <div className="py-2.5">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Cost Breakdown
            </span>
            <div className="mt-2 space-y-1.5">
              {projection.costItemBreakdown.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between pl-3">
                  <span className="text-xs text-slate-500">{item.categoryName}</span>
                  <span className={`text-xs font-medium ${item.categoryType === 'credit' ? 'text-green-600' : 'text-slate-600'}`}>
                    {item.categoryType === 'credit' ? '+' : '\u2212'}
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Profit summary */}
      <div className="mt-2 pt-3 border-t-2 border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">Projected Profit</span>
          <span className={`text-sm font-bold ${
            projection.profit != null && projection.profit >= 0
              ? 'text-green-700'
              : 'text-red-700'
          }`}>
            {formatCurrency(projection.profit)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-slate-500">Margin</span>
          <span className="text-xs font-medium text-slate-600">
            {formatMargin(projection.marginPercent)}
          </span>
        </div>
      </div>
    </div>
  )
}

/** Two-column projected vs actual view for completed cases */
function ComparisonView({
  projection,
  comparison,
}: {
  projection: FinancialProjection
  comparison: FinancialComparison
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Projected vs Actual
      </h3>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 pb-2 border-b border-slate-200">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide" />
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide text-right">
          Projected
        </span>
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide text-right">
          Actual
        </span>
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide text-right">
          Delta
        </span>
      </div>

      {/* Line items */}
      <div className="divide-y divide-slate-50">
        {comparison.lineItems.map((item) => {
          const showDelta = item.delta != null && item.projected != null && item.actual != null
          const favorable = showDelta && isDeltaFavorable(item.delta!, item.isRevenue)

          return (
            <div
              key={item.label}
              className="grid grid-cols-[1fr_80px_80px_80px] gap-2 py-2.5 items-center"
            >
              <span className="text-sm text-slate-700">{item.label}</span>
              <span className="text-sm text-slate-500 text-right">
                {formatCurrency(item.projected)}
              </span>
              <span className="text-sm font-medium text-slate-900 text-right">
                {formatCurrency(item.actual)}
              </span>
              <span className="text-right">
                {showDelta ? (
                  <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                    favorable ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {favorable ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {formatDeltaCurrency(item.isRevenue ? item.delta! : -item.delta!)}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">{'\u2014'}</span>
                )}
              </span>
            </div>
          )
        })}
      </div>

      {/* Profit summary row */}
      <div className="mt-2 pt-3 border-t-2 border-slate-200">
        <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 items-center">
          <span className="text-sm font-semibold text-slate-900">Profit</span>
          <span className="text-sm text-slate-500 text-right">
            {formatCurrency(comparison.projectedProfit)}
          </span>
          <span className={`text-sm font-bold text-right ${
            comparison.actualProfit != null && comparison.actualProfit >= 0
              ? 'text-green-700'
              : 'text-red-700'
          }`}>
            {formatCurrency(comparison.actualProfit)}
          </span>
          <span className="text-right">
            {comparison.profitDelta != null ? (
              <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                comparison.profitDelta >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {comparison.profitDelta >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {formatDeltaCurrency(comparison.profitDelta)}
              </span>
            ) : (
              <span className="text-xs text-slate-400">{'\u2014'}</span>
            )}
          </span>
        </div>

        {/* Margin row */}
        <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 items-center mt-1">
          <span className="text-xs text-slate-500">Margin</span>
          <span className="text-xs text-slate-400 text-right">
            {formatMargin(comparison.projectedMargin)}
          </span>
          <span className="text-xs font-medium text-slate-600 text-right">
            {formatMargin(comparison.actualMargin)}
          </span>
          <span />
        </div>
      </div>

      {/* Duration source label */}
      {projection.durationSource && (
        <div className="mt-3">
          <SourceLabel text={projection.durationSource} />
        </div>
      )}
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function CaseDrawerFinancials({
  displayStatus,
  projection,
  comparison,
  actual,
  loading,
  error,
}: CaseDrawerFinancialsProps) {
  if (loading) return <FinancialsSkeleton />

  if (error) {
    return (
      <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-red-700">Failed to load financial data</p>
          <p className="text-xs text-red-500 mt-0.5">{error}</p>
        </div>
      </div>
    )
  }

  if (!projection) {
    return <NoDataMessage message="No financial data available for this case" />
  }

  // Completed cases with actual data: show two-column comparison
  if (isCompletedStatus(displayStatus) && comparison && actual) {
    // Edge case: case_completion_stats has zero costs (known bug)
    const hasZeroCosts =
      actual.reimbursement === 0 &&
      (actual.totalDebits ?? 0) === 0 &&
      (actual.orTimeCost ?? 0) === 0

    return (
      <div>
        {hasZeroCosts && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg mb-4">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Cost data unavailable for this case. Actual values may be incomplete.
            </p>
          </div>
        )}
        <ComparisonView projection={projection} comparison={comparison} />
      </div>
    )
  }

  // In-progress: projection with note
  if (displayStatus === 'in_progress') {
    return <ProjectionView projection={projection} showInProgressNote />
  }

  // Scheduled (or any other status): projection only
  return <ProjectionView projection={projection} showInProgressNote={false} />
}
