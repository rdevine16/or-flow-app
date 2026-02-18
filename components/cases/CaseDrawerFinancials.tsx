// components/cases/CaseDrawerFinancials.tsx
// Financials tab content for the case drawer.
// Hero row with two MarginGauges + ProfitBadge, projected vs actual table,
// cost breakdown table, and collapsible full-day surgeon forecast.

'use client'

import { useState } from 'react'
import {
  formatCurrency,
  formatMargin,
} from '@/lib/financials'
import {
  type CaseFinancialData,
  type CostBreakdownItem,
  type FullDaySurgeonForecast,
  type MarginRating,
} from '@/lib/utils/financialAnalytics'
import { MarginGauge } from '@/components/ui/MarginGauge'
import { ProfitBadge } from '@/components/ui/ProfitBadge'
import { DeltaBadge } from '@/components/ui/DeltaBadge'
import {
  Info,
  AlertCircle,
  DollarSign,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

type CaseStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold'

interface CaseDrawerFinancialsProps {
  data: CaseFinancialData | null
  displayStatus: CaseStatus | string
  surgeonName: string | null
  loading: boolean
  error: string | null
}

// ============================================
// HELPERS
// ============================================

function isCompletedStatus(status: string): boolean {
  return status === 'completed'
}

// ============================================
// SKELETON / EMPTY / ERROR
// ============================================

function FinancialsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Hero skeleton: 2 gauge circles + profit/revenue/costs rectangles */}
      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div className="w-12 h-12 rounded-full bg-slate-200" />
        <div className="w-12 h-12 rounded-full bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-slate-200 rounded w-1/3" />
          <div className="h-3 bg-slate-100 rounded w-1/4" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-slate-200 rounded w-16" />
          <div className="h-4 bg-slate-200 rounded w-16" />
        </div>
      </div>

      {/* Projected vs Actual table skeleton */}
      <div>
        <div className="h-3 bg-slate-100 rounded w-28 mb-2" />
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="h-8 bg-slate-50" />
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="grid grid-cols-4 gap-2 px-3 py-2.5 border-t border-slate-100">
              <div className="h-4 bg-slate-100 rounded w-3/4" />
              <div className="h-4 bg-slate-100 rounded w-2/3 ml-auto" />
              <div className="h-4 bg-slate-100 rounded w-2/3 ml-auto" />
              <div className="h-4 bg-slate-100 rounded w-1/2 ml-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Cost breakdown skeleton */}
      <div>
        <div className="h-3 bg-slate-100 rounded w-24 mb-2" />
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="h-8 bg-slate-50" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="grid grid-cols-3 gap-2 px-3 py-2.5 border-t border-slate-100">
              <div className="h-4 bg-slate-100 rounded w-3/4" />
              <div className="h-4 bg-slate-100 rounded w-1/2 ml-auto" />
              <div className="h-4 bg-slate-100 rounded w-1/3 ml-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Forecast toggle skeleton */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200">
        <div className="w-8 h-8 rounded-full bg-slate-200" />
        <div className="flex-1 space-y-1">
          <div className="h-4 bg-slate-100 rounded w-1/3" />
        </div>
        <div className="w-4 h-4 bg-slate-100 rounded" />
      </div>
    </div>
  )
}

function NoDataMessage({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <DollarSign className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-700">{message}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

// ============================================
// HERO ROW
// ============================================

function HeroRow({
  data,
  surgeonName,
  isProjected,
}: {
  data: CaseFinancialData
  surgeonName: string | null
  isProjected: boolean
}) {
  const { hero } = data
  const surgeonMedianProfit = hero.surgeon_median_margin != null && hero.revenue != null
    ? (hero.surgeon_median_margin / 100) * hero.revenue
    : null

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex flex-wrap items-center gap-6">
        {/* Two margin gauges: surgeon median vs facility median */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <MarginGauge
            percentage={hero.surgeon_median_margin}
            size="lg"
            rating={hero.surgeon_margin_rating}
            label="Surgeon"
          />
          <MarginGauge
            percentage={hero.facility_median_margin}
            size="lg"
            rating={hero.facility_margin_rating}
            label="Facility"
          />
        </div>

        {/* Profit + badge */}
        <div className="flex-1 min-w-[140px]">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">
            Profit {isProjected ? 'Forecast' : 'Actual'}
          </p>
          <div className="flex items-center gap-2">
            <span className={`text-[22px] font-bold ${
              (hero.profit ?? 0) >= 0 ? 'text-slate-900' : 'text-red-700'
            } ${isProjected ? 'italic' : ''}`}>
              {formatCurrency(hero.profit)}
            </span>
            <ProfitBadge rating={hero.surgeon_margin_rating} />
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
              isProjected
                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
            }`}>
              {isProjected ? 'Projected' : 'Actual'}
            </span>
          </div>
          {surgeonMedianProfit != null && surgeonName && (
            <p className="text-[11px] text-slate-400 mt-0.5">
              {surgeonName} median: {formatCurrency(surgeonMedianProfit)}
            </p>
          )}
        </div>

        {/* Revenue & Costs — side by side */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Revenue</p>
            <p className={`text-lg font-semibold text-slate-800 ${isProjected ? 'italic' : ''}`}>
              {formatCurrency(hero.revenue)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Costs</p>
            <p className={`text-lg font-semibold text-red-600 ${isProjected ? 'italic' : ''}`}>
              {hero.total_costs != null ? formatCurrency(hero.total_costs) : '\u2014'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// PROJECTED VS ACTUAL TABLE
// ============================================

function ProjectedVsActualTable({
  data,
}: {
  data: CaseFinancialData
}) {
  const comparison = data.projected_vs_actual
  if (!comparison) return null

  return (
    <div className="mt-4">
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_80px_80px_80px] gap-1 px-3 py-2 bg-slate-50 border-b border-slate-200">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Projected vs Actual</span>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">
            Projected
          </span>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">
            Actual
          </span>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">
            Delta
          </span>
        </div>

        {/* Line items */}
        <div className="divide-y divide-slate-100">
          {comparison.lineItems.map((item) => {
            const showDelta = item.delta != null && item.projected != null && item.actual != null

            return (
              <div
                key={item.label}
                className="grid grid-cols-[1fr_80px_80px_80px] gap-1 px-3 py-2 items-center"
              >
                <span className="text-sm text-slate-700">{item.label}</span>
                <span className="text-sm text-slate-400 text-right">
                  {item.projected != null ? formatCurrency(item.projected) : '\u2014'}
                </span>
                <span className="text-sm font-medium text-slate-900 text-right">
                  {item.actual != null ? formatCurrency(item.actual) : (
                    <span className="text-slate-300">{'\u2014'}</span>
                  )}
                </span>
                <div className="flex justify-end">
                  {showDelta ? (
                    <DeltaBadge
                      delta={item.delta!}
                      format="currency"
                      invert={!item.isRevenue}
                    />
                  ) : (
                    <span className="text-xs text-slate-300">{'\u2014'}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Profit summary row */}
        <div className="border-t-2 border-teal-200 bg-teal-50/30">
          <div className="grid grid-cols-[1fr_80px_80px_80px] gap-1 px-3 py-2.5 items-center">
            <span className="text-sm font-bold text-slate-900">Profit</span>
            <span className="text-sm text-slate-400 text-right">
              {formatCurrency(comparison.projectedProfit)}
            </span>
            <span className={`text-sm font-bold text-right ${
              (comparison.actualProfit ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
            }`}>
              {formatCurrency(comparison.actualProfit)}
            </span>
            <div className="flex justify-end">
              {comparison.profitDelta != null ? (
                <DeltaBadge
                  delta={comparison.profitDelta}
                  format="currency"
                />
              ) : (
                <span className="text-xs text-slate-300">{'\u2014'}</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_80px_80px_80px] gap-1 px-3 pb-2.5 items-center">
            <span className="text-xs font-medium text-slate-500">Margin</span>
            <span className="text-xs text-slate-400 text-right">
              {formatMargin(comparison.projectedMargin)}
            </span>
            <span className="text-xs font-semibold text-slate-700 text-right">
              {formatMargin(comparison.actualMargin)}
            </span>
            <span />
          </div>
        </div>

        {/* Source footnote — inside table as footer */}
        {data.projection?.durationSource && (
          <div className="flex items-center gap-1.5 px-3 py-2 border-t border-slate-100 bg-slate-50/50">
            <Info className="w-3 h-3 text-slate-400 flex-shrink-0" />
            <span className="text-[11px] text-slate-400">
              Projected: {data.projection.durationSource}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// COST BREAKDOWN TABLE
// ============================================

function CostBreakdownTable({ items }: { items: CostBreakdownItem[] }) {
  if (items.length === 0) return null

  const totalCosts = items
    .filter(i => i.amount > 0)
    .reduce((sum, i) => sum + i.amount, 0)

  const maxPct = Math.max(...items.map(i => Math.abs(i.percentage_of_total)), 1)

  return (
    <div className="mt-4">
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_56px] gap-1 px-3 py-2 bg-slate-50 border-b border-slate-200">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Cost Breakdown
          </span>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">
            Amount
          </span>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">
            % Total
          </span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {items.map((item) => {
            const isCredit = item.amount < 0
            const barWidth = item.percentage_of_total > 0
              ? Math.round((item.percentage_of_total / maxPct) * 100)
              : 0

            return (
              <div
                key={item.category}
                className="relative grid grid-cols-[1fr_80px_56px] gap-1 px-3 py-2 items-center"
              >
                {/* Inline % bar (background) */}
                {barWidth > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 bg-teal-50/40"
                    style={{ width: `${barWidth}%` }}
                  />
                )}
                <span className={`relative text-sm ${isCredit ? 'text-green-600' : 'text-slate-700'}`}>
                  {item.category}
                  {item.source === 'projected' && (
                    <span className="text-[10px] text-slate-400 italic ml-1">(proj)</span>
                  )}
                </span>
                <span className={`relative text-sm font-medium text-right ${
                  isCredit ? 'text-green-600' : 'text-slate-800'
                }`}>
                  {isCredit ? '-' : ''}{formatCurrency(Math.abs(item.amount))}
                </span>
                <span className="relative text-xs text-slate-400 text-right">
                  {item.percentage_of_total > 0 ? `${item.percentage_of_total}%` : '\u2014'}
                </span>
              </div>
            )
          })}
        </div>

        {/* Footer total */}
        <div className="border-t-2 border-slate-200 grid grid-cols-[1fr_80px_56px] gap-1 px-3 py-2.5 items-center">
          <span className="text-sm font-bold text-slate-900">Total Costs</span>
          <span className="text-sm font-bold text-slate-900 text-right">
            {formatCurrency(totalCosts)}
          </span>
          <span />
        </div>
      </div>
    </div>
  )
}

// ============================================
// FULL DAY FORECAST
// ============================================

function FullDayForecastSection({
  forecast,
}: {
  forecast: FullDaySurgeonForecast
}) {
  const [expanded, setExpanded] = useState(false)
  const completedCount = forecast.cases.filter(c => c.status === 'completed').length
  const initials = forecast.surgeon_name
    .replace(/^Dr\.\s*/, '')
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left"
        aria-expanded={expanded}
        aria-label={`Full Day Forecast for ${forecast.surgeon_name}, ${forecast.cases.length} cases`}
      >
        {/* Surgeon avatar */}
        <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-slate-700">
            Full Day Forecast
          </span>
          <span className="text-[11px] text-slate-400 ml-1.5">
            {forecast.surgeon_name}
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[72px_1fr_76px_72px_56px] gap-1 px-3 py-2 bg-slate-50 border-b border-slate-200">
              <span className="text-[10px] font-medium text-slate-400 uppercase">Case #</span>
              <span className="text-[10px] font-medium text-slate-400 uppercase">Procedure</span>
              <span className="text-[10px] font-medium text-slate-400 uppercase">Status</span>
              <span className="text-[10px] font-medium text-slate-400 uppercase text-right">Profit</span>
              <span className="text-[10px] font-medium text-slate-400 uppercase text-right">Margin</span>
            </div>

            {/* Case rows */}
            <div className="divide-y divide-slate-100">
              {forecast.cases.map((c) => {
                const isNonCompleted = c.status !== 'completed'
                return (
                  <div
                    key={c.case_id}
                    className="grid grid-cols-[72px_1fr_76px_72px_56px] gap-1 px-3 py-2 items-center"
                  >
                    <span className="text-xs font-medium text-slate-700 truncate">
                      {c.case_number}
                    </span>
                    <span className="text-xs text-slate-600 truncate">
                      {c.procedure_name}
                    </span>
                    <span>
                      <StatusPill status={c.status} />
                    </span>
                    <span className={`text-xs font-medium text-right ${
                      isNonCompleted ? 'italic text-slate-400' : (
                        (c.profit ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
                      )
                    }`}>
                      {c.profit != null ? formatCurrency(c.profit) : (
                        <span className="italic text-slate-400">TBD</span>
                      )}
                    </span>
                    <span className={`text-xs text-right ${
                      isNonCompleted ? 'italic text-slate-400' : 'text-slate-600'
                    }`}>
                      {c.margin_pct != null ? `${Math.round(c.margin_pct)}%` : '\u2014'}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Footer totals */}
            <div className="border-t-2 border-slate-200 bg-slate-50/50 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Day Total ({completedCount} of {forecast.cases.length} completed)
                </span>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${
                    forecast.total_profit >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {formatCurrency(forecast.total_profit)}
                  </span>
                  <MarginGauge
                    percentage={forecast.total_margin}
                    size="sm"
                    rating={getMarginRatingSimple(forecast.total_margin)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    completed: { bg: 'bg-green-50', text: 'text-green-700', label: 'Done' },
    in_progress: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Active' },
    scheduled: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Sched' },
  }
  const c = config[status] ?? config.scheduled
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

/** Simple rating derived from margin % only (for forecast footer gauge) */
function getMarginRatingSimple(margin: number | null): MarginRating {
  if (margin == null || margin <= 0) return 'poor'
  if (margin >= 50) return 'excellent'
  if (margin >= 30) return 'good'
  if (margin >= 15) return 'fair'
  return 'poor'
}

// ============================================
// DATA QUALITY BANNERS
// ============================================

function DataQualityBanners({ data }: { data: CaseFinancialData }) {
  const { data_quality: dq, hero } = data
  const banners: { message: string; severity: 'amber' | 'blue' }[] = []

  if (!dq.has_costs) {
    banners.push({
      message: 'Cost data unavailable for this case. Margin may not be accurate.',
      severity: 'amber',
    })
  }

  if (!dq.has_revenue) {
    banners.push({
      message: 'Revenue not configured for this procedure.',
      severity: 'amber',
    })
  }

  if (dq.confidence === 'low' && hero.surgeon_case_count > 0 && hero.surgeon_case_count < 5) {
    banners.push({
      message: `Based on ${hero.surgeon_case_count} case${hero.surgeon_case_count === 1 ? '' : 's'} \u2014 projections improve with more data.`,
      severity: 'blue',
    })
  }

  if (hero.surgeon_case_count === 0 && hero.facility_case_count > 0) {
    banners.push({
      message: 'First case for this surgeon \u2014 using facility benchmarks.',
      severity: 'blue',
    })
  }

  if (banners.length === 0) return null

  return (
    <div className="space-y-2 mb-4">
      {banners.map((b, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 p-3 rounded-lg ${
            b.severity === 'amber' ? 'bg-amber-50' : 'bg-blue-50'
          }`}
        >
          {b.severity === 'amber' ? (
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          )}
          <p className={`text-xs ${
            b.severity === 'amber' ? 'text-amber-700' : 'text-blue-700'
          }`}>
            {b.message}
          </p>
        </div>
      ))}
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function CaseDrawerFinancials({
  data,
  displayStatus,
  surgeonName,
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

  if (!data) {
    return (
      <NoDataMessage
        message="No financial data available"
        hint="Revenue and cost data will appear once configured for this procedure"
      />
    )
  }

  const isProjected = !isCompletedStatus(displayStatus)

  return (
    <div>
      {/* Data quality banners */}
      <DataQualityBanners data={data} />

      {/* In-progress note */}
      {displayStatus === 'in_progress' && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg mb-4">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            Final financials available after completion and validation
          </p>
        </div>
      )}

      {/* Hero Row */}
      <HeroRow data={data} surgeonName={surgeonName} isProjected={isProjected} />

      {/* Projected vs Actual (unified layout: always show, actual="—" if not completed) */}
      <ProjectedVsActualTable data={data} />

      {/* Cost Breakdown */}
      <CostBreakdownTable items={data.cost_breakdown} />

      {/* Full Day Forecast */}
      {data.full_day_forecast && data.full_day_forecast.cases.length > 0 && (
        <FullDayForecastSection forecast={data.full_day_forecast} />
      )}
    </div>
  )
}
