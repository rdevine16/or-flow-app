// lib/utils/milestoneAnalytics.ts
// Pure functions and types for milestone analytics.
// Used by useMilestoneComparison hook and CaseDrawerMilestones component.

// ============================================
// TYPES
// ============================================

export interface MilestoneInterval {
  milestone_name: string
  facility_milestone_id: string
  display_order: number
  phase_group: string | null
  recorded_at: string | null
  /** Minutes since previous milestone (null for first milestone or unrecorded) */
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

// ============================================
// PHASE GROUP CONFIG
// ============================================

const PHASE_GROUP_CONFIG: Record<string, { label: string; color: string }> = {
  pre_op: { label: 'Pre-Op', color: 'bg-blue-500' },
  surgical: { label: 'Surgical', color: 'bg-teal-500' },
  closing: { label: 'Closing', color: 'bg-indigo-500' },
  post_op: { label: 'Post-Op', color: 'bg-slate-400' },
}

const IDLE_GROUP = { label: 'Idle/Gap', color: 'bg-slate-300' }

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

  let prevRecordedAt: Date | null = null

  return sorted.map((cm) => {
    const median = medianMap.get(cm.facility_milestone_id)
    const name = cm.facility_milestone?.display_name || cm.facility_milestone?.name || 'Unknown'
    const displayOrder = cm.facility_milestone?.display_order ?? 0
    const phaseGroup = median?.phase_group ?? cm.facility_milestone?.phase_group ?? null

    let intervalMinutes: number | null = null
    if (cm.recorded_at && prevRecordedAt) {
      const diff = new Date(cm.recorded_at).getTime() - prevRecordedAt.getTime()
      intervalMinutes = diff > 0 ? diff / 60000 : null
    }
    if (cm.recorded_at) {
      prevRecordedAt = new Date(cm.recorded_at)
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
// TIME ALLOCATION
// ============================================

/**
 * Bucket milestone intervals into phase groups (Pre-Op, Surgical, Closing, Post-Op).
 * Intervals without a phase_group are bucketed as "Idle/Gap".
 */
export function calculateTimeAllocation(
  intervals: MilestoneInterval[],
): TimeAllocation[] {
  const totals: Record<string, number> = {}

  for (const iv of intervals) {
    if (iv.interval_minutes == null || iv.interval_minutes <= 0) continue
    const group = iv.phase_group ?? 'idle'
    totals[group] = (totals[group] ?? 0) + iv.interval_minutes
  }

  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0)
  if (grandTotal <= 0) return []

  const allocations: TimeAllocation[] = []

  // Ordered: pre_op, surgical, closing, post_op, idle
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
 * Each segment width = its interval / total case time.
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
