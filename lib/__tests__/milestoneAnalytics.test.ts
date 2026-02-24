import { describe, it, expect } from 'vitest'
import {
  calculateDeltaSeverity,
  calculateIntervals,
  calculateTimeAllocation,
  calculatePhaseTimeAllocation,
  assignMilestonesToPhases,
  buildPhaseGroups,
  identifyMissingMilestones,
  calculateSwimlaneSections,
  formatMinutes,
  formatDelta,
  type MilestoneMedianRow,
  type CaseMilestoneWithDetails,
  type PhaseDefinitionWithMilestones,
  type PhaseMedianRow,
} from '../utils/milestoneAnalytics'

// ============================================
// FIXTURES
// ============================================

function makeMedianRow(overrides: Partial<MilestoneMedianRow> = {}): MilestoneMedianRow {
  return {
    milestone_name: 'patient_in',
    facility_milestone_id: 'fm-1',
    display_order: 1,
    phase_group: 'pre_op',
    surgeon_median_minutes: 10,
    surgeon_case_count: 20,
    facility_median_minutes: 12,
    facility_case_count: 100,
    ...overrides,
  }
}

function makeCaseMilestone(
  overrides: Partial<CaseMilestoneWithDetails> & { name?: string; order?: number; phase?: string | null },
): CaseMilestoneWithDetails {
  const { name, order, phase, ...rest } = overrides
  return {
    id: `cm-${order ?? 1}`,
    facility_milestone_id: `fm-${order ?? 1}`,
    recorded_at: null,
    facility_milestone: {
      name: name ?? 'patient_in',
      display_name: null,
      display_order: order ?? 1,
      phase_group: phase !== undefined ? phase : 'pre_op',
    },
    ...rest,
  }
}

/** Generate a timestamp N minutes after a base time */
function minutesAfter(baseIso: string, minutes: number): string {
  return new Date(new Date(baseIso).getTime() + minutes * 60000).toISOString()
}

const BASE_TIME = '2026-02-15T08:00:00.000Z'

function buildCompleteCaseMilestones(): CaseMilestoneWithDetails[] {
  return [
    makeCaseMilestone({ name: 'patient_in', order: 1, phase: 'pre_op', facility_milestone_id: 'fm-1', recorded_at: BASE_TIME }),
    makeCaseMilestone({ name: 'anes_start', order: 2, phase: 'pre_op', facility_milestone_id: 'fm-2', recorded_at: minutesAfter(BASE_TIME, 5) }),
    makeCaseMilestone({ name: 'incision', order: 3, phase: 'surgical', facility_milestone_id: 'fm-3', recorded_at: minutesAfter(BASE_TIME, 15) }),
    makeCaseMilestone({ name: 'closing', order: 4, phase: 'closing', facility_milestone_id: 'fm-4', recorded_at: minutesAfter(BASE_TIME, 55) }),
    makeCaseMilestone({ name: 'patient_out', order: 5, phase: 'post_op', facility_milestone_id: 'fm-5', recorded_at: minutesAfter(BASE_TIME, 70) }),
  ]
}

function buildCompleteMedians(): MilestoneMedianRow[] {
  // Medians now represent duration AT each milestone (time to next), not time since previous.
  // Last milestone has null medians (no next milestone to measure to).
  return [
    makeMedianRow({ milestone_name: 'patient_in', facility_milestone_id: 'fm-1', display_order: 1, phase_group: 'pre_op', surgeon_median_minutes: 4, facility_median_minutes: 5 }),
    makeMedianRow({ milestone_name: 'anes_start', facility_milestone_id: 'fm-2', display_order: 2, phase_group: 'pre_op', surgeon_median_minutes: 8, facility_median_minutes: 10 }),
    makeMedianRow({ milestone_name: 'incision', facility_milestone_id: 'fm-3', display_order: 3, phase_group: 'surgical', surgeon_median_minutes: 38, facility_median_minutes: 42 }),
    makeMedianRow({ milestone_name: 'closing', facility_milestone_id: 'fm-4', display_order: 4, phase_group: 'closing', surgeon_median_minutes: 14, facility_median_minutes: 16 }),
    makeMedianRow({ milestone_name: 'patient_out', facility_milestone_id: 'fm-5', display_order: 5, phase_group: 'post_op', surgeon_median_minutes: null, facility_median_minutes: null }),
  ]
}

// ============================================
// calculateDeltaSeverity
// ============================================

describe('calculateDeltaSeverity', () => {
  it('returns "faster" when actual is at or below median', () => {
    expect(calculateDeltaSeverity(30, 40)).toBe('faster')
    expect(calculateDeltaSeverity(40, 40)).toBe('faster')
  })

  it('returns "on-pace" when within 10% over median', () => {
    expect(calculateDeltaSeverity(43, 40)).toBe('on-pace')
    expect(calculateDeltaSeverity(44, 40)).toBe('on-pace')
  })

  it('returns "slower" when 10-25% over median', () => {
    expect(calculateDeltaSeverity(46, 40)).toBe('slower')
    expect(calculateDeltaSeverity(50, 40)).toBe('slower')
  })

  it('returns "critical" when >25% over median', () => {
    expect(calculateDeltaSeverity(52, 40)).toBe('critical')
    expect(calculateDeltaSeverity(80, 40)).toBe('critical')
  })

  it('returns null for null or zero inputs', () => {
    expect(calculateDeltaSeverity(null, 40)).toBeNull()
    expect(calculateDeltaSeverity(40, null)).toBeNull()
    expect(calculateDeltaSeverity(40, 0)).toBeNull()
    expect(calculateDeltaSeverity(null, null)).toBeNull()
  })
})

// ============================================
// calculateIntervals
// ============================================

describe('calculateIntervals', () => {
  it('computes correct durations for a complete case', () => {
    const milestones = buildCompleteCaseMilestones()
    const medians = buildCompleteMedians()

    const intervals = calculateIntervals(milestones, medians, 'surgeon')

    expect(intervals).toHaveLength(5)

    // patient_in: 5 min duration (patient_in → anes_start)
    expect(intervals[0].milestone_name).toBe('patient_in')
    expect(intervals[0].interval_minutes).toBe(5)
    expect(intervals[0].surgeon_median_minutes).toBe(4)
    expect(intervals[0].delta_from_surgeon).toBeCloseTo(1)
    // 5/4 = 1.25 → slower (exactly at boundary)
    expect(intervals[0].delta_severity).toBe('slower')

    // anes_start: 10 min duration (anes_start → incision)
    expect(intervals[1].interval_minutes).toBe(10)
    expect(intervals[1].surgeon_median_minutes).toBe(8)
    // 10/8 = 1.25 → slower
    expect(intervals[1].delta_severity).toBe('slower')

    // incision: 40 min duration (incision → closing)
    expect(intervals[2].interval_minutes).toBe(40)
    expect(intervals[2].surgeon_median_minutes).toBe(38)
    // 40/38 = 1.053 → on-pace (within 10%)
    expect(intervals[2].delta_severity).toBe('on-pace')

    // closing: 15 min duration (closing → patient_out)
    expect(intervals[3].interval_minutes).toBe(15)
    expect(intervals[3].surgeon_median_minutes).toBe(14)
    // 15/14 = 1.071 → on-pace
    expect(intervals[3].delta_severity).toBe('on-pace')

    // Last milestone has no duration (no next milestone)
    expect(intervals[4].interval_minutes).toBeNull()
    expect(intervals[4].surgeon_median_minutes).toBeNull()
    expect(intervals[4].delta_severity).toBeNull()
  })

  it('uses facility medians when comparisonSource is "facility"', () => {
    const milestones = buildCompleteCaseMilestones()
    const medians = buildCompleteMedians()

    const intervals = calculateIntervals(milestones, medians, 'facility')

    // closing: 15 min, facility median = 16 → ratio 15/16 = 0.9375 → faster
    expect(intervals[3].delta_severity).toBe('faster')
  })

  it('handles partial case with missing milestones', () => {
    const milestones = [
      makeCaseMilestone({ name: 'patient_in', order: 1, phase: 'pre_op', facility_milestone_id: 'fm-1', recorded_at: BASE_TIME }),
      makeCaseMilestone({ name: 'anes_start', order: 2, phase: 'pre_op', facility_milestone_id: 'fm-2', recorded_at: minutesAfter(BASE_TIME, 5) }),
      makeCaseMilestone({ name: 'incision', order: 3, phase: 'surgical', facility_milestone_id: 'fm-3', recorded_at: null }), // not recorded
      makeCaseMilestone({ name: 'closing', order: 4, phase: 'closing', facility_milestone_id: 'fm-4', recorded_at: null }), // not recorded
      makeCaseMilestone({ name: 'patient_out', order: 5, phase: 'post_op', facility_milestone_id: 'fm-5', recorded_at: null }),
    ]

    const intervals = calculateIntervals(milestones, buildCompleteMedians(), 'surgeon')

    expect(intervals).toHaveLength(5)
    // patient_in: looks ahead to anes_start (recorded) → 5 min duration
    expect(intervals[0].interval_minutes).toBe(5)
    // anes_start: looks ahead but no more recorded milestones → null
    expect(intervals[1].interval_minutes).toBeNull()
    expect(intervals[2].interval_minutes).toBeNull()
    expect(intervals[2].delta_severity).toBeNull()
  })

  it('handles case with no medians (surgeon first case)', () => {
    const milestones = buildCompleteCaseMilestones()
    const emptyMedians: MilestoneMedianRow[] = []

    const intervals = calculateIntervals(milestones, emptyMedians, 'surgeon')

    expect(intervals).toHaveLength(5)
    // All surgeon/facility medians should be null
    intervals.forEach((iv) => {
      expect(iv.surgeon_median_minutes).toBeNull()
      expect(iv.facility_median_minutes).toBeNull()
      expect(iv.delta_severity).toBeNull()
    })
    // But durations should still be computed from timestamps
    expect(intervals[0].interval_minutes).toBe(5) // patient_in → anes_start
    expect(intervals[4].interval_minutes).toBeNull() // last milestone
  })

  it('handles milestones recorded out of order', () => {
    // Milestones appear out of display_order in the input array
    const milestones = [
      makeCaseMilestone({ name: 'closing', order: 4, phase: 'closing', facility_milestone_id: 'fm-4', recorded_at: minutesAfter(BASE_TIME, 55) }),
      makeCaseMilestone({ name: 'patient_in', order: 1, phase: 'pre_op', facility_milestone_id: 'fm-1', recorded_at: BASE_TIME }),
      makeCaseMilestone({ name: 'incision', order: 3, phase: 'surgical', facility_milestone_id: 'fm-3', recorded_at: minutesAfter(BASE_TIME, 15) }),
    ]

    const intervals = calculateIntervals(milestones, buildCompleteMedians(), 'surgeon')

    // Should be sorted by display_order regardless of input order
    expect(intervals[0].milestone_name).toBe('patient_in')
    expect(intervals[1].milestone_name).toBe('incision')
    expect(intervals[2].milestone_name).toBe('closing')

    // Durations computed correctly after sorting (forward-looking)
    expect(intervals[0].interval_minutes).toBe(15) // patient_in → incision
    expect(intervals[1].interval_minutes).toBe(40) // incision → closing
    expect(intervals[2].interval_minutes).toBeNull() // last milestone
  })

  it('handles empty milestones', () => {
    const intervals = calculateIntervals([], [], 'surgeon')
    expect(intervals).toHaveLength(0)
  })
})

// ============================================
// calculateTimeAllocation
// ============================================

describe('calculateTimeAllocation', () => {
  it('buckets durations by phase_group', () => {
    const milestones = buildCompleteCaseMilestones()
    const intervals = calculateIntervals(milestones, buildCompleteMedians(), 'surgeon')
    const allocation = calculateTimeAllocation(intervals)

    // Forward-looking: patient_in(5m, pre_op) + anes_start(10m, pre_op) = 15 pre_op
    // incision(40m, surgical), closing(15m, closing), patient_out(null, post_op)
    expect(allocation.length).toBeGreaterThan(0)

    const preOp = allocation.find((a) => a.phase_group === 'pre_op')
    expect(preOp?.minutes).toBe(15) // patient_in(5) + anes_start(10)

    const surgical = allocation.find((a) => a.phase_group === 'surgical')
    expect(surgical?.minutes).toBe(40) // incision duration

    const closing = allocation.find((a) => a.phase_group === 'closing')
    expect(closing?.minutes).toBe(15) // closing duration

    // post_op has no duration (patient_out is last milestone)
    const postOp = allocation.find((a) => a.phase_group === 'post_op')
    expect(postOp).toBeUndefined()
  })

  it('percentages sum to ~100%', () => {
    const milestones = buildCompleteCaseMilestones()
    const intervals = calculateIntervals(milestones, buildCompleteMedians(), 'surgeon')
    const allocation = calculateTimeAllocation(intervals)

    const totalPct = allocation.reduce((s, a) => s + a.percentage, 0)
    // Due to rounding, may not be exactly 100
    expect(totalPct).toBeGreaterThanOrEqual(98)
    expect(totalPct).toBeLessThanOrEqual(102)
  })

  it('returns empty for case with no intervals', () => {
    const milestones = [
      makeCaseMilestone({ name: 'patient_in', order: 1, recorded_at: null }),
    ]
    const intervals = calculateIntervals(milestones, [], 'surgeon')
    const allocation = calculateTimeAllocation(intervals)
    expect(allocation).toHaveLength(0)
  })

  it('buckets null phase_group as idle', () => {
    const milestones = [
      makeCaseMilestone({ name: 'step_a', order: 1, phase: null, facility_milestone_id: 'fm-1', recorded_at: BASE_TIME }),
      makeCaseMilestone({ name: 'step_b', order: 2, phase: null, facility_milestone_id: 'fm-2', recorded_at: minutesAfter(BASE_TIME, 10) }),
    ]
    // No medians and phase_group is null → should bucket as idle
    // Forward-looking: step_a duration = 10 min (step_a → step_b), step_b = null (last)
    const intervals = calculateIntervals(milestones, [], 'surgeon')
    const allocation = calculateTimeAllocation(intervals)

    const idle = allocation.find((a) => a.phase_group === 'idle')
    expect(idle?.minutes).toBe(10)
  })
})

// ============================================
// identifyMissingMilestones
// ============================================

describe('identifyMissingMilestones', () => {
  it('identifies unrecorded milestones', () => {
    const milestones = [
      makeCaseMilestone({ name: 'patient_in', order: 1, recorded_at: BASE_TIME }),
      makeCaseMilestone({ name: 'incision', order: 2, recorded_at: minutesAfter(BASE_TIME, 15) }),
      makeCaseMilestone({ name: 'closing', order: 3, recorded_at: null }),
      makeCaseMilestone({ name: 'patient_out', order: 4, recorded_at: null }),
    ]

    const missing = identifyMissingMilestones(milestones, [
      'patient_in',
      'incision',
      'closing',
      'patient_out',
    ])

    expect(missing).toEqual(['closing', 'patient_out'])
  })

  it('returns empty when all milestones recorded', () => {
    const milestones = buildCompleteCaseMilestones()
    const expected = ['patient_in', 'anes_start', 'incision', 'closing', 'patient_out']
    const missing = identifyMissingMilestones(milestones, expected)
    expect(missing).toHaveLength(0)
  })

  it('returns all when none recorded', () => {
    const milestones = [
      makeCaseMilestone({ name: 'patient_in', order: 1, recorded_at: null }),
      makeCaseMilestone({ name: 'incision', order: 2, recorded_at: null }),
    ]
    const missing = identifyMissingMilestones(milestones, ['patient_in', 'incision'])
    expect(missing).toEqual(['patient_in', 'incision'])
  })
})

// ============================================
// calculateSwimlaneSections
// ============================================

describe('calculateSwimlaneSections', () => {
  it('produces proportional widths based on durations', () => {
    const milestones = buildCompleteCaseMilestones()
    const intervals = calculateIntervals(milestones, buildCompleteMedians(), 'surgeon')

    const sections = calculateSwimlaneSections(intervals, 70) // 70 min total

    expect(sections).toHaveLength(5)
    // patient_in: 5/70 ≈ 7.14% (duration at patient_in milestone)
    expect(sections[0].width_percent).toBeCloseTo(5 / 70 * 100, 1)
    // incision: 40/70 ≈ 57.14% (duration at incision milestone)
    expect(sections[2].width_percent).toBeCloseTo(40 / 70 * 100, 1)
  })

  it('uses equal widths when totalMinutes is null', () => {
    const milestones = [
      makeCaseMilestone({ name: 'a', order: 1, recorded_at: null }),
      makeCaseMilestone({ name: 'b', order: 2, recorded_at: null }),
    ]
    const intervals = calculateIntervals(milestones, [], 'surgeon')
    const sections = calculateSwimlaneSections(intervals, null)

    expect(sections).toHaveLength(2)
    expect(sections[0].width_percent).toBe(50)
    expect(sections[1].width_percent).toBe(50)
  })

  it('marks unrecorded milestones', () => {
    const milestones = [
      makeCaseMilestone({ name: 'a', order: 1, recorded_at: BASE_TIME }),
      makeCaseMilestone({ name: 'b', order: 2, recorded_at: null }),
    ]
    const intervals = calculateIntervals(milestones, [], 'surgeon')
    const sections = calculateSwimlaneSections(intervals, 10)

    expect(sections[0].is_recorded).toBe(true)
    expect(sections[1].is_recorded).toBe(false)
    expect(sections[1].is_missing).toBe(true)
  })
})

// ============================================
// Formatting helpers
// ============================================

describe('formatMinutes', () => {
  it('formats minutes-only values', () => {
    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(0)).toBe('0m')
  })

  it('formats hours and minutes', () => {
    expect(formatMinutes(90)).toBe('1h 30m')
    expect(formatMinutes(120)).toBe('2h 0m')
  })

  it('handles negative values', () => {
    expect(formatMinutes(-5)).toBe('-5m')
    expect(formatMinutes(-90)).toBe('-1h 30m')
  })

  it('returns dash for null', () => {
    expect(formatMinutes(null)).toBe('—')
  })
})

describe('formatDelta', () => {
  it('adds + sign for positive', () => {
    expect(formatDelta(5)).toBe('+5m')
    expect(formatDelta(90)).toBe('+1h 30m')
  })

  it('shows negative with -', () => {
    expect(formatDelta(-5)).toBe('-5m')
  })

  it('shows zero without sign', () => {
    expect(formatDelta(0)).toBe('0m')
  })

  it('returns dash for null', () => {
    expect(formatDelta(null)).toBe('—')
  })
})

// ============================================
// Phase 7: Phase-based time allocation
// ============================================

function buildPhaseDefinitions(): PhaseDefinitionWithMilestones[] {
  return [
    {
      id: 'phase-1',
      name: 'pre_op',
      display_name: 'Pre-Op',
      display_order: 1,
      color_key: 'blue',
      parent_phase_id: null,
      start_milestone_id: 'fm-1',
      end_milestone_id: 'fm-3',
      start_milestone: { id: 'fm-1', name: 'patient_in', display_name: 'Patient In', display_order: 1 },
      end_milestone: { id: 'fm-3', name: 'incision', display_name: 'Incision', display_order: 3 },
    },
    {
      id: 'phase-2',
      name: 'surgical',
      display_name: 'Surgical',
      display_order: 2,
      color_key: 'green',
      parent_phase_id: null,
      start_milestone_id: 'fm-3',
      end_milestone_id: 'fm-4',
      start_milestone: { id: 'fm-3', name: 'incision', display_name: 'Incision', display_order: 3 },
      end_milestone: { id: 'fm-4', name: 'closing', display_name: 'Closing', display_order: 4 },
    },
    {
      id: 'phase-3',
      name: 'post_op',
      display_name: 'Post-Op',
      display_order: 3,
      color_key: 'purple',
      parent_phase_id: null,
      start_milestone_id: 'fm-4',
      end_milestone_id: 'fm-5',
      start_milestone: { id: 'fm-4', name: 'closing', display_name: 'Closing', display_order: 4 },
      end_milestone: { id: 'fm-5', name: 'patient_out', display_name: 'Patient Out', display_order: 5 },
    },
  ]
}

function buildPhaseMedians(): PhaseMedianRow[] {
  return [
    {
      phase_name: 'pre_op',
      phase_display_name: 'Pre-Op',
      color_key: 'blue',
      display_order: 1,
      surgeon_median_minutes: 14,
      surgeon_n: 20,
      facility_median_minutes: 16,
      facility_n: 100,
    },
    {
      phase_name: 'surgical',
      phase_display_name: 'Surgical',
      color_key: 'green',
      display_order: 2,
      surgeon_median_minutes: 38,
      surgeon_n: 20,
      facility_median_minutes: 42,
      facility_n: 100,
    },
    {
      phase_name: 'post_op',
      phase_display_name: 'Post-Op',
      color_key: 'purple',
      display_order: 3,
      surgeon_median_minutes: 14,
      surgeon_n: 20,
      facility_median_minutes: 16,
      facility_n: 100,
    },
  ]
}

describe('calculatePhaseTimeAllocation', () => {
  it('computes phase durations from boundary milestone timestamps', () => {
    const phases = buildPhaseDefinitions()
    const milestones = buildCompleteCaseMilestones()

    const allocation = calculatePhaseTimeAllocation(phases, milestones)

    expect(allocation).toHaveLength(3)

    // Pre-Op: patient_in(0m) → incision(15m) = 15m
    expect(allocation[0].label).toBe('Pre-Op')
    expect(allocation[0].minutes).toBe(15)

    // Surgical: incision(15m) → closing(55m) = 40m
    expect(allocation[1].label).toBe('Surgical')
    expect(allocation[1].minutes).toBe(40)

    // Post-Op: closing(55m) → patient_out(70m) = 15m
    expect(allocation[2].label).toBe('Post-Op')
    expect(allocation[2].minutes).toBe(15)
  })

  it('percentages sum to ~100%', () => {
    const phases = buildPhaseDefinitions()
    const milestones = buildCompleteCaseMilestones()

    const allocation = calculatePhaseTimeAllocation(phases, milestones)
    const totalPct = allocation.reduce((s, a) => s + a.percentage, 0)
    expect(totalPct).toBeGreaterThanOrEqual(98)
    expect(totalPct).toBeLessThanOrEqual(102)
  })

  it('skips phases when boundary milestones not recorded', () => {
    const phases = buildPhaseDefinitions()
    // Only patient_in and incision recorded — no closing/patient_out
    const milestones = [
      makeCaseMilestone({ name: 'patient_in', order: 1, phase: 'pre_op', facility_milestone_id: 'fm-1', recorded_at: BASE_TIME }),
      makeCaseMilestone({ name: 'incision', order: 3, phase: 'surgical', facility_milestone_id: 'fm-3', recorded_at: minutesAfter(BASE_TIME, 15) }),
    ]

    const allocation = calculatePhaseTimeAllocation(phases, milestones)

    // Only Pre-Op has both boundary milestones recorded
    expect(allocation).toHaveLength(1)
    expect(allocation[0].label).toBe('Pre-Op')
    expect(allocation[0].minutes).toBe(15)
  })

  it('returns empty when no milestones recorded', () => {
    const phases = buildPhaseDefinitions()
    const allocation = calculatePhaseTimeAllocation(phases, [])
    expect(allocation).toHaveLength(0)
  })

  it('uses correct color from color_key', () => {
    const phases = buildPhaseDefinitions()
    const milestones = buildCompleteCaseMilestones()

    const allocation = calculatePhaseTimeAllocation(phases, milestones)

    expect(allocation[0].color).toBe('bg-blue-500')
    expect(allocation[1].color).toBe('bg-green-500')
    expect(allocation[2].color).toBe('bg-purple-500')
  })
})

// ============================================
// Phase 7: Assign milestones to phases
// ============================================

describe('assignMilestonesToPhases', () => {
  it('assigns milestones to correct phases by display_order range', () => {
    const milestones = buildCompleteCaseMilestones()
    const intervals = calculateIntervals(milestones, buildCompleteMedians(), 'surgeon')
    const phases = buildPhaseDefinitions()

    const { grouped, ungrouped } = assignMilestonesToPhases(intervals, phases)

    // Pre-Op: display_order 1, 2 (patient_in, anes_start) — range [1, 3)
    // incision (order 3) is the shared boundary: start of Surgical, so it goes there
    const preOp = grouped.get('phase-1') ?? []
    expect(preOp).toHaveLength(2)
    expect(preOp[0].milestone_name).toBe('patient_in')
    expect(preOp[1].milestone_name).toBe('anes_start')

    // Surgical: display_order 3 (incision) — range [3, 4)
    // closing (order 4) is shared boundary: start of Post-Op, so it goes there
    const surgical = grouped.get('phase-2') ?? []
    expect(surgical).toHaveLength(1)
    expect(surgical[0].milestone_name).toBe('incision')

    // Post-Op: display_order 4, 5 (closing, patient_out) — range [4, 5] (last phase, inclusive)
    const postOp = grouped.get('phase-3') ?? []
    expect(postOp).toHaveLength(2)
    expect(postOp[0].milestone_name).toBe('closing')
    expect(postOp[1].milestone_name).toBe('patient_out')

    expect(ungrouped).toHaveLength(0)
  })

  it('puts milestones outside all ranges into ungrouped', () => {
    const intervals = calculateIntervals(
      [makeCaseMilestone({ name: 'extra', order: 99, phase: null, facility_milestone_id: 'fm-99', recorded_at: BASE_TIME })],
      [],
      'surgeon',
    )
    const phases = buildPhaseDefinitions()

    const { ungrouped } = assignMilestonesToPhases(intervals, phases)
    expect(ungrouped).toHaveLength(1)
    expect(ungrouped[0].milestone_name).toBe('extra')
  })
})

// ============================================
// Phase 7: Build phase groups
// ============================================

describe('buildPhaseGroups', () => {
  it('combines phase definitions, intervals, and medians into PhaseGroupData', () => {
    const phases = buildPhaseDefinitions()
    const milestones = buildCompleteCaseMilestones()
    const medians = buildCompleteMedians()
    const phaseMedians = buildPhaseMedians()

    const intervals = calculateIntervals(milestones, medians, 'surgeon')
    const groups = buildPhaseGroups(phases, intervals, milestones, phaseMedians, 'surgeon')

    expect(groups).toHaveLength(3)

    // Pre-Op phase
    expect(groups[0].phaseDisplayName).toBe('Pre-Op')
    expect(groups[0].durationMinutes).toBe(15) // patient_in(0) → incision(15)
    expect(groups[0].medianMinutes).toBe(14) // surgeon median
    expect(groups[0].surgeonN).toBe(20)
    expect(groups[0].facilityN).toBe(100)
    expect(groups[0].intervals).toHaveLength(2) // patient_in, anes_start (incision is start of Surgical)

    // Surgical phase
    expect(groups[1].phaseDisplayName).toBe('Surgical')
    expect(groups[1].durationMinutes).toBe(40) // incision(15) → closing(55)
    expect(groups[1].medianMinutes).toBe(38) // surgeon median

    // Post-Op phase
    expect(groups[2].phaseDisplayName).toBe('Post-Op')
    expect(groups[2].durationMinutes).toBe(15) // closing(55) → patient_out(70)
  })

  it('uses facility median when comparisonSource is facility', () => {
    const phases = buildPhaseDefinitions()
    const milestones = buildCompleteCaseMilestones()
    const phaseMedians = buildPhaseMedians()
    const intervals = calculateIntervals(milestones, buildCompleteMedians(), 'facility')

    const groups = buildPhaseGroups(phases, intervals, milestones, phaseMedians, 'facility')

    expect(groups[0].medianMinutes).toBe(16) // facility median for pre_op
    expect(groups[1].medianMinutes).toBe(42) // facility median for surgical
  })

  it('returns null duration when boundary milestones not recorded', () => {
    const phases = buildPhaseDefinitions()
    const milestones = [
      makeCaseMilestone({ name: 'patient_in', order: 1, phase: 'pre_op', facility_milestone_id: 'fm-1', recorded_at: BASE_TIME }),
      // incision not recorded
      makeCaseMilestone({ name: 'incision', order: 3, phase: 'surgical', facility_milestone_id: 'fm-3', recorded_at: null }),
    ]
    const intervals = calculateIntervals(milestones, [], 'surgeon')

    const groups = buildPhaseGroups(phases, intervals, milestones, [], 'surgeon')

    // Pre-Op duration null because end milestone (incision) not recorded
    expect(groups[0].durationMinutes).toBeNull()
  })

  it('handles empty phase medians gracefully', () => {
    const phases = buildPhaseDefinitions()
    const milestones = buildCompleteCaseMilestones()
    const intervals = calculateIntervals(milestones, buildCompleteMedians(), 'surgeon')

    const groups = buildPhaseGroups(phases, intervals, milestones, [], 'surgeon')

    expect(groups).toHaveLength(3)
    // All medians should be null since no phase medians provided
    groups.forEach((g) => {
      expect(g.medianMinutes).toBeNull()
      expect(g.surgeonN).toBe(0)
      expect(g.facilityN).toBe(0)
    })
    // But durations should still be computed from case milestones
    expect(groups[0].durationMinutes).toBe(15)
  })
})
