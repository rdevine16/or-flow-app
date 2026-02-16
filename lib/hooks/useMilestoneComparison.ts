// lib/hooks/useMilestoneComparison.ts
// Fetches per-interval milestone medians via the get_milestone_interval_medians
// database function and this case's milestone timestamps, then merges them into
// enriched MilestoneComparisonData for the revamped Milestones tab.

'use client'

import { useMemo, useState } from 'react'
import { useSupabaseQueries } from '@/hooks/useSupabaseQuery'
import type { CaseMilestone } from '@/lib/dal/cases'
import {
  calculateIntervals,
  calculateTimeAllocation,
  identifyMissingMilestones,
  type MilestoneMedianRow,
  type MilestoneComparisonData,
  type CaseMilestoneWithDetails,
} from '@/lib/utils/milestoneAnalytics'

// ============================================
// TYPES
// ============================================

export interface UseMilestoneComparisonOptions {
  caseId: string | null
  surgeonId: string | null
  procedureTypeId: string | null
  facilityId: string | null
  enabled?: boolean
}

export interface UseMilestoneComparisonReturn {
  data: MilestoneComparisonData | null
  loading: boolean
  error: string | null
  comparisonSource: 'surgeon' | 'facility'
  setComparisonSource: (source: 'surgeon' | 'facility') => void
  surgeonCaseCount: number
  facilityCaseCount: number
  refetch: () => Promise<void>
}

// ============================================
// HOOK
// ============================================

export function useMilestoneComparison({
  caseId,
  surgeonId,
  procedureTypeId,
  facilityId,
  enabled = true,
}: UseMilestoneComparisonOptions): UseMilestoneComparisonReturn {
  const [comparisonSource, setComparisonSource] = useState<'surgeon' | 'facility'>('surgeon')

  const canFetch = enabled && !!caseId && !!facilityId && !!procedureTypeId

  // Parallel fetch: case milestones + medians from DB function
  const { data: raw, loading, errors, refetch } = useSupabaseQueries<{
    milestones: CaseMilestone[]
    medians: MilestoneMedianRow[]
    expectedNames: string[]
  }>(
    {
      // This case's milestone timestamps
      milestones: async (supabase) => {
        if (!caseId) return []
        const { data, error } = await supabase
          .from('case_milestones')
          .select(`
            id,
            case_id,
            facility_milestone_id,
            recorded_at,
            recorded_by,
            facility_milestone:facility_milestones (
              name,
              display_name,
              display_order,
              phase_group
            )
          `)
          .eq('case_id', caseId)
          .order('facility_milestone(display_order)', { ascending: true })
        if (error) throw new Error(error.message)
        return (data ?? []) as unknown as CaseMilestone[]
      },

      // Per-interval medians from DB function
      medians: async (supabase) => {
        if (!surgeonId || !procedureTypeId || !facilityId) return []
        const { data, error } = await supabase
          .rpc('get_milestone_interval_medians', {
            p_surgeon_id: surgeonId,
            p_procedure_type_id: procedureTypeId,
            p_facility_id: facilityId,
          })
        if (error) throw new Error(error.message)
        return (data ?? []) as MilestoneMedianRow[]
      },

      // Expected milestone names for this procedure (for missing detection)
      expectedNames: async (supabase) => {
        if (!procedureTypeId || !facilityId) return []
        const { data, error } = await supabase
          .from('procedure_milestone_config')
          .select('facility_milestone:facility_milestones ( name )')
          .eq('procedure_type_id', procedureTypeId)
          .eq('facility_id', facilityId)
          .eq('is_enabled', true)
        if (error) throw new Error(error.message)
        type MilestoneNameRow = { facility_milestone: { name: string } | { name: string }[] | null }
        return ((data ?? []) as MilestoneNameRow[]).map(
          (row) => {
            const fm = row.facility_milestone
            if (!fm) return ''
            if (Array.isArray(fm)) return fm[0]?.name ?? ''
            return fm.name
          },
        ).filter(Boolean)
      },
    },
    {
      enabled: canFetch,
      deps: [caseId, surgeonId, procedureTypeId, facilityId, enabled],
    },
  )

  // Derive enriched comparison data
  const result = useMemo((): MilestoneComparisonData | null => {
    if (!raw?.milestones) return null

    const caseMilestones = raw.milestones as unknown as CaseMilestoneWithDetails[]
    const medians = raw.medians ?? []
    const expectedNames = raw.expectedNames ?? []

    const intervals = calculateIntervals(caseMilestones, medians, comparisonSource)
    const timeAllocation = calculateTimeAllocation(intervals)
    const missingMilestones = identifyMissingMilestones(caseMilestones, expectedNames)

    // Compute totals from recorded milestones
    const recordedTimes = caseMilestones
      .filter((m) => m.recorded_at)
      .map((m) => new Date(m.recorded_at!).getTime())
      .sort((a, b) => a - b)

    const totalCaseMinutes = recordedTimes.length >= 2
      ? (recordedTimes[recordedTimes.length - 1] - recordedTimes[0]) / 60000
      : null

    // Surgical time: incision → closing
    const incisionMs = caseMilestones.find(
      (m) => m.recorded_at && m.facility_milestone?.name?.includes('incision'),
    )
    const closingMs = caseMilestones.find(
      (m) => m.recorded_at && m.facility_milestone?.name?.includes('closing'),
    )
    const totalSurgicalMinutes =
      incisionMs?.recorded_at && closingMs?.recorded_at
        ? (new Date(closingMs.recorded_at).getTime() - new Date(incisionMs.recorded_at).getTime()) / 60000
        : null

    return {
      intervals,
      time_allocation: timeAllocation,
      missing_milestones: missingMilestones,
      total_case_minutes: totalCaseMinutes,
      total_surgical_minutes: totalSurgicalMinutes != null && totalSurgicalMinutes > 0
        ? totalSurgicalMinutes
        : null,
      comparison_source: comparisonSource,
    }
  }, [raw, comparisonSource])

  // Max case count for confidence display
  const medians = raw?.medians
  const surgeonCaseCount = useMemo(() => {
    if (!medians) return 0
    return Math.max(0, ...medians.map((m) => m.surgeon_case_count ?? 0))
  }, [medians])

  const facilityCaseCount = useMemo(() => {
    if (!medians) return 0
    return Math.max(0, ...medians.map((m) => m.facility_case_count ?? 0))
  }, [medians])

  const errorMessage = errors.milestones || errors.medians || errors.expectedNames || null

  return {
    data: result,
    loading,
    error: errorMessage,
    comparisonSource,
    setComparisonSource,
    surgeonCaseCount,
    facilityCaseCount,
    refetch,
  }
}
