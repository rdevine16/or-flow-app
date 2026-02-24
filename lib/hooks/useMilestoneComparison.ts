// lib/hooks/useMilestoneComparison.ts
// Fetches per-interval milestone medians via the get_milestone_interval_medians
// database function, phase medians via get_phase_medians, phase definitions,
// and this case's milestone timestamps, then merges them into enriched
// MilestoneComparisonData for the Milestones tab.

'use client'

import { useMemo, useState } from 'react'
import { useSupabaseQueries } from '@/hooks/useSupabaseQuery'
import type { CaseMilestone } from '@/lib/dal/cases'
import {
  resolvePhaseDefsFromTemplate,
  resolveTemplateForCase,
} from '@/lib/dal/phase-resolver'
import {
  calculateIntervals,
  calculatePhaseTimeAllocation,
  calculateTimeAllocation,
  buildPhaseGroups,
  identifyMissingMilestones,
  type MilestoneMedianRow,
  type MilestoneComparisonData,
  type CaseMilestoneWithDetails,
  type PhaseDefinitionWithMilestones,
  type PhaseMedianRow,
} from '@/lib/utils/milestoneAnalytics'

// ============================================
// TYPES
// ============================================

export interface UseMilestoneComparisonOptions {
  caseId: string | null
  surgeonId: string | null
  procedureTypeId: string | null
  facilityId: string | null
  milestoneTemplateId?: string | null
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
  /** Minimum facility n-count across all phase medians */
  facilityPhaseN: number
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
  milestoneTemplateId,
  enabled = true,
}: UseMilestoneComparisonOptions): UseMilestoneComparisonReturn {
  const [comparisonSource, setComparisonSource] = useState<'surgeon' | 'facility'>('surgeon')

  const canFetch = enabled && !!caseId && !!facilityId && !!procedureTypeId

  // Parallel fetch: case milestones + medians + phase definitions + phase medians
  const { data: raw, loading, errors, refetch } = useSupabaseQueries<{
    milestones: CaseMilestone[]
    medians: MilestoneMedianRow[]
    expectedNames: string[]
    phaseDefinitions: PhaseDefinitionWithMilestones[]
    phaseMedians: PhaseMedianRow[]
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

      // Expected milestone names for this procedure (resolved from template cascade)
      expectedNames: async (supabase) => {
        if (!procedureTypeId || !facilityId) return []

        // Resolve template: procedure assignment → facility default
        let templateId: string | null = null

        const { data: procData } = await supabase
          .from('procedure_types')
          .select('milestone_template_id')
          .eq('id', procedureTypeId)
          .single()
        templateId = procData?.milestone_template_id ?? null

        if (!templateId) {
          const { data: defaultTemplate } = await supabase
            .from('milestone_templates')
            .select('id')
            .eq('facility_id', facilityId)
            .eq('is_default', true)
            .eq('is_active', true)
            .single()
          templateId = defaultTemplate?.id ?? null
        }

        if (!templateId) return []

        const { data, error } = await supabase
          .from('milestone_template_items')
          .select('facility_milestone:facility_milestones ( name )')
          .eq('template_id', templateId)
        if (error) throw new Error(error.message)

        type MilestoneNameRow = { facility_milestone: { name: string } | { name: string }[] | null }
        const names = ((data ?? []) as MilestoneNameRow[]).map(
          (row) => {
            const fm = row.facility_milestone
            if (!fm) return ''
            if (Array.isArray(fm)) return fm[0]?.name ?? ''
            return fm.name
          },
        ).filter(Boolean)
        // Deduplicate: shared boundary milestones appear in multiple phases
        return [...new Set(names)]
      },

      // Phase definitions resolved from template (per-case)
      phaseDefinitions: async (supabase) => {
        if (!facilityId) return []
        // Resolve template via cascade: case snapshot → surgeon override → procedure → facility default
        const templateId = await resolveTemplateForCase(supabase, {
          milestone_template_id: milestoneTemplateId,
          surgeon_id: surgeonId,
          procedure_type_id: procedureTypeId,
          facility_id: facilityId,
        })
        return resolvePhaseDefsFromTemplate(supabase, templateId)
      },

      // Phase-level medians from DB function (template-aware)
      phaseMedians: async (supabase) => {
        if (!surgeonId || !procedureTypeId || !facilityId) return []
        // Resolve template for this case's medians
        const templateId = await resolveTemplateForCase(supabase, {
          milestone_template_id: milestoneTemplateId,
          surgeon_id: surgeonId,
          procedure_type_id: procedureTypeId,
          facility_id: facilityId,
        })
        if (!templateId) return []
        const { data, error } = await supabase
          .rpc('get_phase_medians', {
            p_facility_id: facilityId,
            p_procedure_type_id: procedureTypeId,
            p_surgeon_id: surgeonId,
            p_milestone_template_id: templateId,
          })
        if (error) throw new Error(error.message)
        return (data ?? []) as PhaseMedianRow[]
      },
    },
    {
      enabled: canFetch,
      deps: [caseId, surgeonId, procedureTypeId, facilityId, milestoneTemplateId, enabled],
    },
  )

  // Derive enriched comparison data
  const result = useMemo((): MilestoneComparisonData | null => {
    if (!raw?.milestones) return null

    const caseMilestones = raw.milestones as unknown as CaseMilestoneWithDetails[]
    const medians = raw.medians ?? []
    const expectedNames = raw.expectedNames ?? []
    const phaseDefinitions = raw.phaseDefinitions ?? []
    const phaseMedians = raw.phaseMedians ?? []

    const intervals = calculateIntervals(caseMilestones, medians, comparisonSource)

    // Use phase_definitions-based time allocation when available, fall back to legacy
    const timeAllocation = phaseDefinitions.length > 0
      ? calculatePhaseTimeAllocation(phaseDefinitions, caseMilestones)
      : calculateTimeAllocation(intervals)

    const phaseGroups = phaseDefinitions.length > 0
      ? buildPhaseGroups(phaseDefinitions, intervals, caseMilestones, phaseMedians, comparisonSource)
      : []

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
      phase_groups: phaseGroups,
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

  // Minimum facility n-count across phase medians (for phase-level confidence)
  const phaseMedians = raw?.phaseMedians
  const facilityPhaseN = useMemo(() => {
    if (!phaseMedians || phaseMedians.length === 0) return 0
    return Math.min(...phaseMedians.map((pm) => pm.facility_n ?? 0))
  }, [phaseMedians])

  const errorMessage = errors.milestones || errors.medians || errors.expectedNames
    || errors.phaseDefinitions || errors.phaseMedians || null

  return {
    data: result,
    loading,
    error: errorMessage,
    comparisonSource,
    setComparisonSource,
    surgeonCaseCount,
    facilityCaseCount,
    facilityPhaseN,
    refetch,
  }
}
