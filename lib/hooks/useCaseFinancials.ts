// lib/hooks/useCaseFinancials.ts
// Thin data-fetching hook for the Financials tab.
// Fetches from 5 sources in parallel, passes to pure calculation functions.
// Lazy-loaded: only fires when enabled (financials tab is active).

'use client'

import { useMemo } from 'react'
import { useSupabaseQueries } from '@/hooks/useSupabaseQuery'
import {
  computeProjection,
  computeComparison,
  type CostItem,
  type ProjectionInputs,
  type FinancialProjection,
  type ActualFinancials,
  type FinancialComparison,
} from '@/lib/financials'

// ============================================
// INTERNAL TYPES (DB row shapes)
// ============================================

interface CaseCompletionStatsRow {
  case_id: string
  reimbursement: number | null
  total_debits: number | null
  total_credits: number | null
  or_time_cost: number | null
  profit: number | null
  total_duration_minutes: number | null
  or_hourly_rate: number | null
  soft_goods_cost: number | null
  hard_goods_cost: number | null
  or_cost: number | null
}

interface StatsRow {
  median_duration: number | null
  median_reimbursement: number | null
}

interface FacilityRow {
  or_hourly_rate: number | null
}

interface CostItemRow {
  amount: number
  cost_category: { name: string; type: string } | { name: string; type: string }[] | null
}

interface ReimbursementRow {
  reimbursement: number | null
}

type FinancialsData = {
  caseStats: CaseCompletionStatsRow | null
  surgeonStats: StatsRow | null
  facilityStats: StatsRow | null
  facility: FacilityRow | null
  costItems: CostItemRow[]
  defaultReimbursement: ReimbursementRow | null
}

// ============================================
// PUBLIC TYPES
// ============================================

export interface UseCaseFinancialsReturn {
  projection: FinancialProjection | null
  comparison: FinancialComparison | null
  actual: ActualFinancials | null
  loading: boolean
  error: string | null
}

// ============================================
// HOOK
// ============================================

export function useCaseFinancials(
  caseId: string | null,
  facilityId: string | null,
  surgeonId: string | null,
  procedureTypeId: string | null,
  scheduledDuration: number | null,
  surgeonName: string | null,
  enabled: boolean,
): UseCaseFinancialsReturn {
  const canFetch = enabled && !!caseId && !!facilityId

  const { data, loading, errors } = useSupabaseQueries<FinancialsData>(
    {
      caseStats: async (supabase) => {
        if (!caseId) return null
        const { data, error } = await supabase
          .from('case_completion_stats')
          .select('case_id, reimbursement, total_debits, total_credits, or_time_cost, profit, total_duration_minutes, or_hourly_rate, soft_goods_cost, hard_goods_cost, or_cost')
          .eq('case_id', caseId)
          .maybeSingle()
        if (error) throw new Error(error.message)
        return data as CaseCompletionStatsRow | null
      },

      surgeonStats: async (supabase) => {
        if (!facilityId || !surgeonId || !procedureTypeId) return null
        const { data, error } = await supabase
          .from('surgeon_procedure_stats')
          .select('median_duration, median_reimbursement')
          .eq('facility_id', facilityId)
          .eq('surgeon_id', surgeonId)
          .eq('procedure_type_id', procedureTypeId)
          .maybeSingle()
        if (error) throw new Error(error.message)
        return data as StatsRow | null
      },

      facilityStats: async (supabase) => {
        if (!facilityId || !procedureTypeId) return null
        const { data, error } = await supabase
          .from('facility_procedure_stats')
          .select('median_duration, median_reimbursement')
          .eq('facility_id', facilityId)
          .eq('procedure_type_id', procedureTypeId)
          .maybeSingle()
        if (error) throw new Error(error.message)
        return data as StatsRow | null
      },

      facility: async (supabase) => {
        if (!facilityId) return null
        const { data, error } = await supabase
          .from('facilities')
          .select('or_hourly_rate')
          .eq('id', facilityId)
          .single()
        if (error) throw new Error(error.message)
        return data as FacilityRow | null
      },

      costItems: async (supabase) => {
        if (!facilityId || !procedureTypeId) return []
        const { data, error } = await supabase
          .from('procedure_cost_items')
          .select('amount, cost_category:cost_categories(name, type)')
          .eq('facility_id', facilityId)
          .eq('procedure_type_id', procedureTypeId)
          .is('effective_to', null)
        if (error) throw new Error(error.message)
        return (data ?? []) as CostItemRow[]
      },

      defaultReimbursement: async (supabase) => {
        if (!facilityId || !procedureTypeId) return null
        const { data, error } = await supabase
          .from('procedure_reimbursements')
          .select('reimbursement')
          .eq('facility_id', facilityId)
          .eq('procedure_type_id', procedureTypeId)
          .is('payer_id', null)
          .order('effective_date', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error) throw new Error(error.message)
        return data as ReimbursementRow | null
      },
    },
    {
      enabled: canFetch,
      deps: [caseId, facilityId, surgeonId, procedureTypeId, enabled],
    },
  )

  const result = useMemo(() => {
    if (!data) return { projection: null, comparison: null, actual: null }

    // Normalize cost_category joins (Supabase may return array or object)
    const costItems: CostItem[] = (data.costItems ?? [])
      .filter((item) => item.cost_category != null)
      .map((item) => {
        const cat = Array.isArray(item.cost_category)
          ? item.cost_category[0]
          : item.cost_category!
        return {
          amount: item.amount,
          categoryName: cat.name,
          categoryType: cat.type as 'debit' | 'credit',
        }
      })

    const projInputs: ProjectionInputs = {
      surgeonMedianDuration: data.surgeonStats?.median_duration ?? null,
      facilityMedianDuration: data.facilityStats?.median_duration ?? null,
      scheduledDuration,
      defaultReimbursement: data.defaultReimbursement?.reimbursement ?? null,
      surgeonMedianReimbursement: data.surgeonStats?.median_reimbursement ?? null,
      facilityMedianReimbursement: data.facilityStats?.median_reimbursement ?? null,
      orHourlyRate: data.facility?.or_hourly_rate ?? null,
      costItems,
    }

    const projection = computeProjection(projInputs, surgeonName)

    // Build actuals from case_completion_stats (only if they exist)
    let actual: ActualFinancials | null = null
    let comparison: FinancialComparison | null = null

    if (data.caseStats) {
      actual = {
        reimbursement: data.caseStats.reimbursement,
        totalDebits: data.caseStats.total_debits ?? data.caseStats.soft_goods_cost,
        totalCredits: data.caseStats.total_credits ?? data.caseStats.hard_goods_cost,
        orTimeCost: data.caseStats.or_time_cost ?? data.caseStats.or_cost,
        profit: data.caseStats.profit,
        totalDurationMinutes: data.caseStats.total_duration_minutes,
        orHourlyRate: data.caseStats.or_hourly_rate,
      }
      comparison = computeComparison(projection, actual)
    }

    return { projection, comparison, actual }
  }, [data, scheduledDuration, surgeonName])

  const firstError = Object.values(errors).find(Boolean) ?? null

  return {
    ...result,
    loading,
    error: firstError ?? null,
  }
}
