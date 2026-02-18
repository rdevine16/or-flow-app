// lib/utils/milestoneAnalytics.ts
// Pure functions and types for milestone analytics.
// Used by useMilestoneComparison hook and CaseDrawerMilestones component.

import { resolveColorKey } from '@/lib/milestone-phase-config'

// ============================================
// TYPES
// ============================================

export interface MilestoneInterval {
  milestone_name: string
  facility_milestone_id: string
  display_order: number
  phase_group: string | null
  recorded_at: string | null
  /** Minutes from this milestone to next recorded milestone (null for last milestone or unrecorded) */
  interval_minutes: number | null
  surgeon_median_minutes: number | null
  facility_median_minutes: number | null
  /** Actual interval minus active comparison median */
  delta_from_surgeon: number | null
  delta_from_facility: number | null
  delta_severity: 'faster' | 'on-pace' | 'slower' | 'critical' | null
}

export interface TimeAllocation {
  label: string
  phase_group: string
  minutes: number
  percentage: number
  color: string // tailwind color token
}

export interface MilestoneComparisonData {
  intervals: MilestoneInterval[]
  time_allocation: TimeAllocation[]
  phase_groups: PhaseGroupData[]
  missing_milestones: string[]
  total_case_minutes: number | null
  total_surgical_minutes: number | null
  comparison_source: 'surgeon' | 'facility'
}

/** Row shape returned by the get_milestone_interval_medians RPC function */
export interface MilestoneMedianRow {
  milestone_name: string
  facility_milestone_id: string
  display_order: number
  phase_group: string | null
  surgeon_median_minutes: number | null
  surgeon_case_count: number
  facility_median_minutes: number | null
  facility_case_count: number
}

/** Raw case milestone with joined facility milestone data */
export interface CaseMilestoneWithDetails {
  id: string
  facility_milestone_id: string
  recorded_at: string | null
  facility_milestone?: {
    name: string
    display_name: string | null
    display_order: number
    phase_group?: string | null
  }
}

/** Phase definition with boundary milestone details for analytics */
export interface PhaseDefinitionWithMilestones {
  id: string
  name: string
  display_name: string
  display_order: number
  color_key: string | null
  start_milestone_id: string
  end_milestone_id: string
  start_milestone?: {
    id: string
    name: string
    display_name: string | null
    display_order: number
  }
  end_milestone?: {
    id: string
    name: string
    display_name: string | null
    display_order: number
  }
}

/** Row shape returned by the get_phase_medians RPC function */
export interface PhaseMedianRow {
  phase_name: string
  phase_display_name: string
  color_key: string | null
  display_order: number
  surgeon_median_minutes: number | null
  surgeon_n: number
  facility_median_minutes: number | null
  facility_n: number
}

/** Phase group data for collapsible phase headers in the milestone table */
export interface PhaseGroupData {
  phaseId: string
  phaseName: string
  phaseDisplayName: string
  colorKey: string | null
  displayOrder: number
  /** Phase duration from this case's boundary milestone timestamps */
  durationMinutes: number | null
  /** Active comparison median (surgeon or facility) */
  medianMinutes: number | null
  surgeonMedianMinutes: number | null
  facilityMedianMinutes: number | null
  surgeonN: number
  facilityN: number
  /** Milestone intervals belonging to this phase */
  intervals: MilestoneInterval[]
}

// ============================================
// DELTA SEVERITY (ratio-based per Q3/A3)
// ============================================

/**
 * Calculate severity of a delta using ratio-based thresholds.
 * ≤ 1.0x median = 'faster'
 * 1.0-1.1x = 'on-pace' (within 10%)
 * 1.1-1.25x = 'slower'
 * > 1.25x = 'critical'
 */
export function calculateDeltaSeverity(
  actual: number | null,
  median: number | null,
): 'faster' | 'on-pace' | 'slower' | 'critical' | null {
  if (actual == null || median == null || median <= 0) return null
  const ratio = actual / median
  if (ratio <= 1.0) return 'faster'
  if (ratio <= 1.1) return 'on-pace'
  if (ratio <= 1.25) return 'slower'
  return 'critical'
}

// ============================================
// INTERVAL CALCULATIONS
// ============================================

/**
 * Merge case milestone timestamps with median benchmark data
 * to produce enriched MilestoneInterval[] rows.
 */
export function calculateIntervals(
  caseMilestones: CaseMilestoneWithDetails[],
  medians: MilestoneMedianRow[],
  comparisonSource: 'surgeon' | 'facility' = 'surgeon',
): MilestoneInterval[] {
  // Sort by display_order
  const sorted = [...caseMilestones].sort((a, b) => {
    const orderA = a.facility_milestone?.display_order ?? 0
    const orderB = b.facility_milestone?.display_order ?? 0
    return orderA - orderB
  })

  // Build median lookup by facility_milestone_id
  const medianMap = new Map(medians.map((m) => [m.facility_milestone_id, m]))

  return sorted.map((cm, idx) => {
    const median = medianMap.get(cm.facility_milestone_id)
    const name = cm.facility_milestone?.display_name || cm.facility_milestone?.name || 'Unknown'
    const displayOrder = cm.facility_milestone?.display_order ?? 0
    const phaseGroup = median?.phase_group ?? cm.facility_milestone?.phase_group ?? null

    // Duration = time from this milestone to the next recorded milestone
    let intervalMinutes: number | null = null
    if (cm.recorded_at) {
      for (let j = idx + 1; j < sorted.length; j++) {
        if (sorted[j].recorded_at) {
          const diff = new Date(sorted[j].recorded_at!).getTime() - new Date(cm.recorded_at).getTime()
          intervalMinutes = diff > 0 ? diff / 60000 : null
          break
        }
      }
    }

    const surgeonMedian = median?.surgeon_median_minutes ?? null
    const facilityMedian = median?.facility_median_minutes ?? null
    const activeMedian = comparisonSource === 'surgeon' ? surgeonMedian : facilityMedian

    return {
      milestone_name: name,
      facility_milestone_id: cm.facility_milestone_id,
      display_order: displayOrder,
      phase_group: phaseGroup,
      recorded_at: cm.recorded_at,
      interval_minutes: intervalMinutes,
      surgeon_median_minutes: surgeonMedian != null ? Number(surgeonMedian) : null,
      facility_median_minutes: facilityMedian != null ? Number(facilityMedian) : null,
      delta_from_surgeon: intervalMinutes != null && surgeonMedian != null
        ? intervalMinutes - Number(surgeonMedian)
        : null,
      delta_from_facility: intervalMinutes != null && facilityMedian != null
        ? intervalMinutes - Number(facilityMedian)
        : null,
      delta_severity: calculateDeltaSeverity(intervalMinutes, activeMedian != null ? Number(activeMedian) : null),
    }
  })
}

// ============================================
// TIME ALLOCATION (phase_definitions-based)
// ============================================

/**
 * Calculate time allocation from phase_definitions boundary milestones.
 * Each phase duration = end_milestone.recorded_at - start_milestone.recorded_at.
 * Replaces the old phase_group bucketing approach.
 */
export function calculatePhaseTimeAllocation(
  phaseDefinitions: PhaseDefinitionWithMilestones[],
  caseMilestones: CaseMilestoneWithDetails[],
): TimeAllocation[] {
  // Build lookup: facility_milestone_id → recorded_at timestamp
  const milestoneTimeMap = new Map<string, number>()
  for (const cm of caseMilestones) {
    if (cm.recorded_at) {
      milestoneTimeMap.set(cm.facility_milestone_id, new Date(cm.recorded_at).getTime())
    }
  }

  const phaseDurations: { phase: PhaseDefinitionWithMilestones; minutes: number }[] = []

  for (const phase of phaseDefinitions) {
    const startTime = milestoneTimeMap.get(phase.start_milestone_id)
    const endTime = milestoneTimeMap.get(phase.end_milestone_id)
    if (startTime != null && endTime != null && endTime > startTime) {
      phaseDurations.push({
        phase,
        minutes: (endTime - startTime) / 60000,
      })
    }
  }

  const grandTotal = phaseDurations.reduce((s, pd) => s + pd.minutes, 0)
  if (grandTotal <= 0) return []

  // Sort by display_order
  phaseDurations.sort((a, b) => a.phase.display_order - b.phase.display_order)

  return phaseDurations.map((pd) => ({
    label: pd.phase.display_name,
    phase_group: pd.phase.name,
    minutes: pd.minutes,
    percentage: Math.round((pd.minutes / grandTotal) * 100),
    color: resolveColorKey(pd.phase.color_key).accentBg,
  }))
}

/**
 * Legacy: Bucket milestone intervals into phase groups.
 * @deprecated Use calculatePhaseTimeAllocation with phase_definitions instead.
 */
export function calculateTimeAllocation(
  intervals: MilestoneInterval[],
): TimeAllocation[] {
  const PHASE_GROUP_CONFIG: Record<string, { label: string; color: string }> = {
    pre_op: { label: 'Pre-Op', color: 'bg-blue-500' },
    surgical: { label: 'Surgical', color: 'bg-teal-500' },
    closing: { label: 'Closing', color: 'bg-indigo-500' },
    post_op: { label: 'Post-Op', color: 'bg-slate-400' },
  }
  const IDLE_GROUP = { label: 'Idle/Gap', color: 'bg-slate-300' }

  const totals: Record<string, number> = {}

  for (const iv of intervals) {
    if (iv.interval_minutes == null || iv.interval_minutes <= 0) continue
    const group = iv.phase_group ?? 'idle'
    totals[group] = (totals[group] ?? 0) + iv.interval_minutes
  }

  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0)
  if (grandTotal <= 0) return []

  const allocations: TimeAllocation[] = []
  const orderedGroups = ['pre_op', 'surgical', 'closing', 'post_op', 'idle']

  for (const group of orderedGroups) {
    const minutes = totals[group]
    if (minutes == null || minutes <= 0) continue

    const config = group === 'idle' ? IDLE_GROUP : PHASE_GROUP_CONFIG[group]
    if (!config) continue

    allocations.push({
      label: config.label,
      phase_group: group,
      minutes,
      percentage: Math.round((minutes / grandTotal) * 100),
      color: config.color,
    })
  }

  return allocations
}

// ============================================
// PHASE GROUPING
// ============================================

/**
 * Assign milestone intervals to phases based on phase_definitions boundary display_orders.
 * A milestone belongs to a phase if its display_order >= start_milestone.display_order
 * and < the next phase's start_milestone.display_order (or <= end for the last phase).
 */
export function assignMilestonesToPhases(
  intervals: MilestoneInterval[],
  phaseDefinitions: PhaseDefinitionWithMilestones[],
): { grouped: Map<string, MilestoneInterval[]>; ungrouped: MilestoneInterval[] } {
  const sortedPhases = [...phaseDefinitions].sort((a, b) => a.display_order - b.display_order)

  const grouped = new Map<string, MilestoneInterval[]>()
  const ungrouped: MilestoneInterval[] = []

  for (const iv of intervals) {
    let assigned = false
    for (let i = 0; i < sortedPhases.length; i++) {
      const phase = sortedPhases[i]
      const startOrder = phase.start_milestone?.display_order ?? 0
      const endOrder = phase.end_milestone?.display_order ?? Infinity
      const isLast = i === sortedPhases.length - 1

      // Milestone belongs to this phase if display_order >= start AND < end
      // (or <= end for the last phase)
      if (iv.display_order >= startOrder && (isLast ? iv.display_order <= endOrder : iv.display_order < endOrder)) {
        const existing = grouped.get(phase.id) ?? []
        existing.push(iv)
        grouped.set(phase.id, existing)
        assigned = true
        break
      }
    }
    if (!assigned) {
      ungrouped.push(iv)
    }
  }

  return { grouped, ungrouped }
}

/**
 * Build PhaseGroupData[] by combining phase_definitions, case milestones,
 * milestone intervals, and phase medians.
 */
export function buildPhaseGroups(
  phaseDefinitions: PhaseDefinitionWithMilestones[],
  intervals: MilestoneInterval[],
  caseMilestones: CaseMilestoneWithDetails[],
  phaseMedians: PhaseMedianRow[],
  comparisonSource: 'surgeon' | 'facility',
): PhaseGroupData[] {
  const { grouped } = assignMilestonesToPhases(intervals, phaseDefinitions)

  // Build milestone time lookup
  const milestoneTimeMap = new Map<string, number>()
  for (const cm of caseMilestones) {
    if (cm.recorded_at) {
      milestoneTimeMap.set(cm.facility_milestone_id, new Date(cm.recorded_at).getTime())
    }
  }

  // Build phase median lookup
  const medianMap = new Map(phaseMedians.map((pm) => [pm.phase_name, pm]))

  const sortedPhases = [...phaseDefinitions].sort((a, b) => a.display_order - b.display_order)

  return sortedPhases.map((phase) => {
    const phaseIntervals = grouped.get(phase.id) ?? []
    const median = medianMap.get(phase.name)

    // Calculate phase duration from boundary milestone timestamps
    const startTime = milestoneTimeMap.get(phase.start_milestone_id)
    const endTime = milestoneTimeMap.get(phase.end_milestone_id)
    const durationMinutes = startTime != null && endTime != null && endTime > startTime
      ? (endTime - startTime) / 60000
      : null

    const surgeonMedian = median?.surgeon_median_minutes != null ? Number(median.surgeon_median_minutes) : null
    const facilityMedian = median?.facility_median_minutes != null ? Number(median.facility_median_minutes) : null
    const activeMedian = comparisonSource === 'surgeon' ? surgeonMedian : facilityMedian

    return {
      phaseId: phase.id,
      phaseName: phase.name,
      phaseDisplayName: phase.display_name,
      colorKey: phase.color_key,
      displayOrder: phase.display_order,
      durationMinutes,
      medianMinutes: activeMedian,
      surgeonMedianMinutes: surgeonMedian,
      facilityMedianMinutes: facilityMedian,
      surgeonN: median?.surgeon_n ?? 0,
      facilityN: median?.facility_n ?? 0,
      intervals: phaseIntervals,
    }
  })
}

// ============================================
// MISSING MILESTONES
// ============================================

/**
 * Identify milestones that were expected but not recorded.
 * Only meaningful for completed cases.
 */
export function identifyMissingMilestones(
  caseMilestones: CaseMilestoneWithDetails[],
  expectedMilestoneNames: string[],
): string[] {
  const recordedNames = new Set(
    caseMilestones
      .filter((m) => m.recorded_at)
      .map((m) => m.facility_milestone?.name ?? '')
      .filter(Boolean),
  )

  return expectedMilestoneNames.filter((name) => !recordedNames.has(name))
}

// ============================================
// SWIMLANE POSITIONING
// ============================================

export interface SwimlaneSectionData {
  facility_milestone_id: string
  milestone_name: string
  width_percent: number
  interval_minutes: number | null
  is_recorded: boolean
  is_missing: boolean
}

/**
 * Calculate proportional widths for horizontal swimlane timeline segments.
 * Each segment width = its duration / total case time.
 */
export function calculateSwimlaneSections(
  intervals: MilestoneInterval[],
  totalMinutes: number | null,
): SwimlaneSectionData[] {
  if (!totalMinutes || totalMinutes <= 0) {
    // Equal-width fallback when no timing data
    return intervals.map((iv) => ({
      facility_milestone_id: iv.facility_milestone_id,
      milestone_name: iv.milestone_name,
      width_percent: intervals.length > 0 ? 100 / intervals.length : 0,
      interval_minutes: iv.interval_minutes,
      is_recorded: !!iv.recorded_at,
      is_missing: !iv.recorded_at && iv.interval_minutes == null,
    }))
  }

  return intervals.map((iv) => ({
    facility_milestone_id: iv.facility_milestone_id,
    milestone_name: iv.milestone_name,
    width_percent: iv.interval_minutes != null && iv.interval_minutes > 0
      ? (iv.interval_minutes / totalMinutes) * 100
      : intervals.length > 0 ? 100 / intervals.length / 3 : 0, // minimal width for unrecorded
    interval_minutes: iv.interval_minutes,
    is_recorded: !!iv.recorded_at,
    is_missing: !iv.recorded_at && iv.interval_minutes == null,
  }))
}

// ============================================
// FORMATTING HELPERS
// ============================================

export function formatMinutes(minutes: number | null): string {
  if (minutes == null) return '—'
  const hrs = Math.floor(Math.abs(minutes) / 60)
  const mins = Math.round(Math.abs(minutes) % 60)
  const sign = minutes < 0 ? '-' : ''
  if (hrs === 0) return `${sign}${mins}m`
  return `${sign}${hrs}h ${mins}m`
}

export function formatDelta(minutes: number | null): string {
  if (minutes == null) return '—'
  const sign = minutes > 0 ? '+' : ''
  return `${sign}${formatMinutes(minutes)}`
}
