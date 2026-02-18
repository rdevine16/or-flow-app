// lib/hooks/useFinancialComparison.ts
// Extended financial data hook that adds benchmarking, cost breakdown,
// and full-day forecast on top of the base useCaseFinancials hook.
// Lazy-loaded: only fires when enabled (financials tab is active).

'use client'

import { useMemo } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useSupabaseQueries } from '@/hooks/useSupabaseQuery'
import { useCaseFinancials } from '@/lib/hooks/useCaseFinancials'
import {
  type MarginBenchmark,
  type CaseFinancialData,
  computeMedian,
  buildHeroMetrics,
  buildCostBreakdown,
  buildFullDayForecast,
  assessDataQuality,
} from '@/lib/utils/financialAnalytics'

// ============================================
// INTERNAL TYPES (DB row shapes)
// ============================================

interface MarginStatsRow {
  profit: number | null
  reimbursement: number | null
}

interface FullDayRow {
  case_id: string
  case_number: string
  procedure_name: string
  status: string
  revenue: number | null
  total_costs: number | null
  profit: number | null
  margin_pct: number | null
}

interface CaseIdRow {
  id: string
}

type BenchmarkData = {
  surgeonBenchmark: MarginBenchmark | null
  facilityBenchmark: MarginBenchmark | null
  fullDayRows: FullDayRow[] | null
}

// ============================================
// HELPERS
// ============================================

/**
 * Fetch case IDs from `cases` table, then get their profit/reimbursement
 * from `case_completion_stats` to compute median margin.
 * Two sequential queries within one async function.
 */
const DEFAULT_BENCHMARK_CASE_COUNT = 10

async function fetchBenchmarkLimit(
  supabase: SupabaseClient,
  facilityId: string,
): Promise<number> {
  const { data } = await supabase
    .from('facility_analytics_settings')
    .select('financial_benchmark_case_count')
    .eq('facility_id', facilityId)
    .maybeSingle()
  return (data as { financial_benchmark_case_count?: number } | null)
    ?.financial_benchmark_case_count ?? DEFAULT_BENCHMARK_CASE_COUNT
}

async function fetchMarginBenchmark(
  supabase: SupabaseClient,
  facilityId: string,
  procedureTypeId: string,
  surgeonId?: string,
  benchmarkLimit: number = DEFAULT_BENCHMARK_CASE_COUNT,
): Promise<MarginBenchmark | null> {
  // Step 1: Get case IDs of recent validated cases
  let query = supabase
    .from('cases')
    .select('id')
    .eq('procedure_type_id', procedureTypeId)
    .eq('facility_id', facilityId)
    .eq('data_validated', true)
    .order('scheduled_date', { ascending: false })
    .limit(benchmarkLimit)

  if (surgeonId) {
    query = query.eq('surgeon_id', surgeonId)
  }

  const { data: cases, error: casesError } = await query
  if (casesError) throw new Error(casesError.message)

  const caseIds = (cases as CaseIdRow[] | null)?.map((c) => c.id) ?? []
  if (caseIds.length === 0) return { median_margin: null, case_count: 0 }

  // Step 2: Fetch profit/reimbursement for those cases
  const { data: stats, error: statsError } = await supabase
    .from('case_completion_stats')
    .select('profit, reimbursement')
    .in('case_id', caseIds)

  if (statsError) throw new Error(statsError.message)

  const margins = ((stats as MarginStatsRow[] | null) ?? [])
    .filter(
      (s): s is { profit: number; reimbursement: number } =>
        s.profit != null && s.reimbursement != null && s.reimbursement > 0,
    )
    .map((s) => (s.profit / s.reimbursement) * 100)

  return {
    median_margin: computeMedian(margins),
    case_count: margins.length,
  }
}

// ============================================
// PUBLIC TYPES
// ============================================

export interface UseFinancialComparisonReturn {
  data: CaseFinancialData | null
  loading: boolean
  error: string | null
}

// ============================================
// HOOK
// ============================================

export function useFinancialComparison(
  caseId: string | null,
  facilityId: string | null,
  surgeonId: string | null,
  procedureTypeId: string | null,
  scheduledDuration: number | null,
  scheduledDate: string | null,
  surgeonName: string | null,
  enabled: boolean,
): UseFinancialComparisonReturn {
  // Base financial data (projection, comparison, actuals)
  const base = useCaseFinancials(
    caseId,
    facilityId,
    surgeonId,
    procedureTypeId,
    scheduledDuration,
    surgeonName,
    enabled,
  )

  const canFetchBenchmarks = enabled && !!facilityId

  // Benchmark + full day data (all three queries run in parallel)
  const {
    data: benchmarks,
    loading: benchLoading,
    errors: benchErrors,
  } = useSupabaseQueries<BenchmarkData>(
    {
      // Surgeon margin benchmark: median margin from recent validated cases
      surgeonBenchmark: async (supabase) => {
        if (!surgeonId || !procedureTypeId || !facilityId) return null
        const limit = await fetchBenchmarkLimit(supabase, facilityId)
        return fetchMarginBenchmark(supabase, facilityId, procedureTypeId, surgeonId, limit)
      },

      // Facility margin benchmark: same but across all surgeons
      facilityBenchmark: async (supabase) => {
        if (!procedureTypeId || !facilityId) return null
        const limit = await fetchBenchmarkLimit(supabase, facilityId)
        return fetchMarginBenchmark(supabase, facilityId, procedureTypeId, undefined, limit)
      },

      // Full day forecast via RPC
      fullDayRows: async (supabase) => {
        if (!surgeonId || !scheduledDate || !facilityId) return null
        const { data, error } = await supabase.rpc('get_full_day_financials', {
          p_surgeon_id: surgeonId,
          p_scheduled_date: scheduledDate,
          p_facility_id: facilityId,
        })
        if (error) throw new Error(error.message)
        return (data ?? []) as FullDayRow[]
      },
    },
    {
      enabled: canFetchBenchmarks,
      deps: [facilityId, surgeonId, procedureTypeId, scheduledDate, enabled],
    },
  )

  // Combine everything into CaseFinancialData
  const result = useMemo((): CaseFinancialData | null => {
    if (!base.projection && !base.actual) return null

    const surgeonBenchmark = benchmarks?.surgeonBenchmark ?? null
    const facilityBenchmark = benchmarks?.facilityBenchmark ?? null

    const hero = buildHeroMetrics(
      base.projection,
      base.actual,
      surgeonBenchmark,
      facilityBenchmark,
    )

    // Build cost breakdown
    const isCompleted = base.actual != null
    const costSource: 'actual' | 'projected' = isCompleted ? 'actual' : 'projected'
    const costItems = base.projection?.costItemBreakdown ?? []
    const orCost = isCompleted
      ? base.actual?.orTimeCost ?? null
      : base.projection?.orCost ?? null

    const costBreakdown = buildCostBreakdown(costItems, orCost, costSource)

    // Full day forecast
    const fullDayForecast =
      benchmarks?.fullDayRows && benchmarks.fullDayRows.length > 0 && surgeonId && surgeonName
        ? buildFullDayForecast(benchmarks.fullDayRows, surgeonId, surgeonName)
        : null

    // Data quality assessment
    const hasCosts =
      (base.projection?.orCost ?? 0) > 0 || (base.projection?.supplyDebits ?? 0) > 0
    const hasRevenue = (base.projection?.revenue ?? 0) > 0
    const dataQuality = assessDataQuality(
      isCompleted,
      hasRevenue,
      hasCosts,
      surgeonBenchmark?.case_count ?? 0,
    )

    return {
      hero,
      cost_breakdown: costBreakdown,
      projected_vs_actual: base.comparison,
      full_day_forecast: fullDayForecast,
      data_quality: dataQuality,
      projection: base.projection,
      actual: base.actual,
    }
  }, [base.projection, base.actual, base.comparison, benchmarks, surgeonId, surgeonName])

  const isLoading = base.loading || benchLoading
  const firstError =
    base.error ?? Object.values(benchErrors).find(Boolean) ?? null

  return {
    data: result,
    loading: isLoading,
    error: firstError ?? null,
  }
}
