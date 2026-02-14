// lib/hooks/useCaseDrawer.ts
// Data fetching hook for the Case Drawer.
// Fetches full case detail via casesDAL.getById when a case is selected.
// Separate hook for milestone comparison data (lazy-loaded when tab is active).

'use client'

import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { casesDAL, type CaseDetail } from '@/lib/dal/cases'

// ============================================
// TYPES
// ============================================

export interface UseCaseDrawerReturn {
  caseDetail: CaseDetail | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/** Subset of surgeon_procedure_stats relevant for milestone comparisons */
export interface SurgeonProcedureStats {
  surgeon_id: string
  procedure_type_id: string
  facility_id: string
  sample_size: number
  median_duration: number | null
  median_surgical_duration: number | null
  median_call_to_patient_in: number | null
}

/** Subset of facility_procedure_stats relevant for milestone comparisons */
export interface FacilityProcedureStats {
  procedure_type_id: string
  facility_id: string
  sample_size: number
  surgeon_count: number
  median_duration: number | null
  median_surgical_duration: number | null
  median_call_to_patient_in: number | null
}

export interface UseMilestoneComparisonsReturn {
  surgeonStats: SurgeonProcedureStats | null
  facilityStats: FacilityProcedureStats | null
  loading: boolean
  error: string | null
}

// ============================================
// HOOKS
// ============================================

export function useCaseDrawer(caseId: string | null): UseCaseDrawerReturn {
  const { data, loading, error, refetch } = useSupabaseQuery<CaseDetail>(
    async (supabase) => {
      if (!caseId) return null as unknown as CaseDetail
      const { data: detail, error: fetchError } = await casesDAL.getById(supabase, caseId)
      if (fetchError) throw fetchError
      return detail as CaseDetail
    },
    {
      deps: [caseId],
      enabled: !!caseId,
    }
  )

  return {
    caseDetail: data,
    loading,
    error,
    refetch,
  }
}

/**
 * Lazy-loaded milestone comparison data from materialized views.
 * Fires only when enabled (milestones tab is active) and IDs are available.
 */
export function useMilestoneComparisons(
  facilityId: string | null,
  surgeonId: string | null,
  procedureTypeId: string | null,
  enabled: boolean,
): UseMilestoneComparisonsReturn {
  const STATS_SELECT = 'surgeon_id, procedure_type_id, facility_id, sample_size, median_duration, median_surgical_duration, median_call_to_patient_in'
  const FACILITY_STATS_SELECT = 'procedure_type_id, facility_id, sample_size, surgeon_count, median_duration, median_surgical_duration, median_call_to_patient_in'

  const canFetch = enabled && !!facilityId && !!procedureTypeId

  const { data: surgeonStats, loading: surgeonLoading, error: surgeonError } = useSupabaseQuery<SurgeonProcedureStats | null>(
    async (supabase) => {
      if (!facilityId || !surgeonId || !procedureTypeId) return null
      const { data, error } = await supabase
        .from('surgeon_procedure_stats')
        .select(STATS_SELECT)
        .eq('facility_id', facilityId)
        .eq('surgeon_id', surgeonId)
        .eq('procedure_type_id', procedureTypeId)
        .maybeSingle()
      if (error) throw error
      return data as SurgeonProcedureStats | null
    },
    {
      deps: [facilityId, surgeonId, procedureTypeId, enabled],
      enabled: canFetch && !!surgeonId,
    }
  )

  const { data: facilityStats, loading: facilityLoading, error: facilityError } = useSupabaseQuery<FacilityProcedureStats | null>(
    async (supabase) => {
      if (!facilityId || !procedureTypeId) return null
      const { data, error } = await supabase
        .from('facility_procedure_stats')
        .select(FACILITY_STATS_SELECT)
        .eq('facility_id', facilityId)
        .eq('procedure_type_id', procedureTypeId)
        .maybeSingle()
      if (error) throw error
      return data as FacilityProcedureStats | null
    },
    {
      deps: [facilityId, procedureTypeId, enabled],
      enabled: canFetch,
    }
  )

  return {
    surgeonStats: surgeonStats ?? null,
    facilityStats: facilityStats ?? null,
    loading: surgeonLoading || facilityLoading,
    error: surgeonError || facilityError,
  }
}
