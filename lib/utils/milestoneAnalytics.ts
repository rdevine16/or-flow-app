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
  parent_phase_id: string | null
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
  parentPhaseId: string | null
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
// TIME ALLOCATION (template phase boundary-based)
// ============================================

/**
 * Calculate time allocation from template-resolved phase boundary milestones.
 * Each phase duration = end_milestone.recorded_at - start_milestone.recorded_at.
 * Replaces the old phase_group bucketing approach.
 *
 * Only includes parent phases (excludes subphases) since the TimeAllocationBar
 * renders flat segments. When a boundary milestone is missing from the case
 * (e.g. case was created before the milestone was added to the template),
 * falls back to the adjacent phase's boundary as a proxy.
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

  // Only include parent phases (no subphases) — TimeAllocationBar is flat
  const parentPhases = phaseDefinitions
    .filter((p) => !p.parent_phase_id)
    .sort((a, b) => a.display_order - b.display_order)

  const phaseDurations: { phase: PhaseDefinitionWithMilestones; minutes: number }[] = []

  for (let i = 0; i < parentPhases.length; i++) {
    const phase = parentPhases[i]
    let startTime = milestoneTimeMap.get(phase.start_milestone_id)
    let endTime = milestoneTimeMap.get(phase.end_milestone_id)

    // Fallback: if end milestone is missing, use next phase's start milestone
    if (endTime == null && i < parentPhases.length - 1) {
      endTime = milestoneTimeMap.get(parentPhases[i + 1].start_milestone_id)
    }
    // Fallback: if start milestone is missing, use previous phase's end milestone
    if (startTime == null && i > 0) {
      startTime = milestoneTimeMap.get(parentPhases[i - 1].end_milestone_id)
    }

    if (startTime != null && endTime != null && endTime > startTime) {
      phaseDurations.push({
        phase,
        minutes: (endTime - startTime) / 60000,
      })
    }
  }

  const grandTotal = phaseDurations.reduce((s, pd) => s + pd.minutes, 0)
  if (grandTotal <= 0) return []

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
 * @deprecated Use calculatePhaseTimeAllocation with template-based phase resolution instead.
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
 * Assign milestone intervals to phases based on template-resolved boundary display_orders.
 *
 * Shared boundary milestones (e.g. "Closing" is end of Surgical AND start of Closing)
 * are assigned to the phase where they serve as the START milestone (appears once).
 *
 * Non-shared end milestones (e.g. "Prep/Drape Complete" is end of Pre-Op but NOT start
 * of Surgical) are included in their phase — end is inclusive when not shared.
 *
 * Subphase assignment: milestones within a subphase range are assigned to the MOST
 * SPECIFIC phase (subphase preferred over parent). Subphases are checked first.
 */
export function assignMilestonesToPhases(
  intervals: MilestoneInterval[],
  phaseDefinitions: PhaseDefinitionWithMilestones[],
): { grouped: Map<string, MilestoneInterval[]>; ungrouped: MilestoneInterval[] } {
  const sortedPhases = [...phaseDefinitions].sort((a, b) => a.display_order - b.display_order)

  // Separate into subphases (checked first) and parents
  const subphases = sortedPhases.filter((p) => p.parent_phase_id)
  const parents = sortedPhases.filter((p) => !p.parent_phase_id)

  // Build set of display_orders that are start milestones of the NEXT parent phase.
  // These are "shared boundaries" — the end milestone of one phase is the start of the next.
  // For shared boundaries, we use exclusive end so the milestone appears at the start position only.
  const nextPhaseStartOrders = new Set<number>()
  for (let i = 1; i < parents.length; i++) {
    const startOrder = parents[i].start_milestone?.display_order
    if (startOrder != null) nextPhaseStartOrders.add(startOrder)
  }

  const grouped = new Map<string, MilestoneInterval[]>()
  const ungrouped: MilestoneInterval[] = []

  for (const iv of intervals) {
    let assigned = false

    // 1. Try subphases first (most specific match)
    for (const phase of subphases) {
      const startOrder = phase.start_milestone?.display_order ?? 0
      const endOrder = phase.end_milestone?.display_order ?? Infinity

      if (iv.display_order >= startOrder && iv.display_order <= endOrder) {
        const existing = grouped.get(phase.id) ?? []
        existing.push(iv)
        grouped.set(phase.id, existing)
        assigned = true
        break
      }
    }

    // 2. Try parent phases
    //    - Shared boundary (end order = next phase's start order): use [start, end)
    //    - Non-shared end (end order is NOT start of next phase): use [start, end]
    //    - Last phase: always [start, end]
    if (!assigned) {
      for (let i = 0; i < parents.length; i++) {
        const phase = parents[i]
        const startOrder = phase.start_milestone?.display_order ?? 0
        const endOrder = phase.end_milestone?.display_order ?? Infinity
        const isLast = i === parents.length - 1
        // Include end milestone unless it's a shared boundary with the next phase
        const endInclusive = isLast || !nextPhaseStartOrders.has(endOrder)

        if (iv.display_order >= startOrder && (endInclusive ? iv.display_order <= endOrder : iv.display_order < endOrder)) {
          const existing = grouped.get(phase.id) ?? []
          existing.push(iv)
          grouped.set(phase.id, existing)
          assigned = true
          break
        }
      }
    }

    if (!assigned) {
      ungrouped.push(iv)
    }
  }

  return { grouped, ungrouped }
}

/**
 * Build PhaseGroupData[] by combining phase boundary definitions, case milestones,
 * milestone intervals, and phase medians.
 *
 * Phase medians come from the get_phase_medians RPC — the true statistical median
 * of each phase's total duration across cases. Note: these may not equal the sum
 * of individual interval medians (median of sums ≠ sum of medians).
 *
 * When a parent phase's boundary milestone is missing from the case (created before
 * the milestone was added to the template), falls back to the adjacent parent phase's
 * boundary as a proxy — phases are contiguous by design.
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
  const parentPhases = sortedPhases.filter((p) => !p.parent_phase_id)

  return sortedPhases.map((phase) => {
    const phaseIntervals = grouped.get(phase.id) ?? []
    const median = medianMap.get(phase.name)

    // Calculate phase duration from boundary milestone timestamps
    let startTime = milestoneTimeMap.get(phase.start_milestone_id)
    let endTime = milestoneTimeMap.get(phase.end_milestone_id)

    // Fallback for parent phases with missing boundary milestones
    if (!phase.parent_phase_id) {
      const parentIdx = parentPhases.indexOf(phase)
      if (endTime == null && parentIdx >= 0 && parentIdx < parentPhases.length - 1) {
        endTime = milestoneTimeMap.get(parentPhases[parentIdx + 1].start_milestone_id)
      }
      if (startTime == null && parentIdx > 0) {
        startTime = milestoneTimeMap.get(parentPhases[parentIdx - 1].end_milestone_id)
      }
    }

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
      parentPhaseId: phase.parent_phase_id,
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
