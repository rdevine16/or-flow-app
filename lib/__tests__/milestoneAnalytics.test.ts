import { describe, it, expect } from 'vitest'
import {
  calculateDeltaSeverity,
  calculateIntervals,
  calculateTimeAllocation,
  identifyMissingMilestones,
  calculateSwimlaneSections,
  formatMinutes,
  formatDelta,
  type MilestoneMedianRow,
  type CaseMilestoneWithDetails,
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
  return [
    makeMedianRow({ milestone_name: 'patient_in', facility_milestone_id: 'fm-1', display_order: 1, phase_group: 'pre_op', surgeon_median_minutes: null, facility_median_minutes: null }),
    makeMedianRow({ milestone_name: 'anes_start', facility_milestone_id: 'fm-2', display_order: 2, phase_group: 'pre_op', surgeon_median_minutes: 6, facility_median_minutes: 7 }),
    makeMedianRow({ milestone_name: 'incision', facility_milestone_id: 'fm-3', display_order: 3, phase_group: 'surgical', surgeon_median_minutes: 10, facility_median_minutes: 12 }),
    makeMedianRow({ milestone_name: 'closing', facility_milestone_id: 'fm-4', display_order: 4, phase_group: 'closing', surgeon_median_minutes: 38, facility_median_minutes: 42 }),
    makeMedianRow({ milestone_name: 'patient_out', facility_milestone_id: 'fm-5', display_order: 5, phase_group: 'post_op', surgeon_median_minutes: 12, facility_median_minutes: 15 }),
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
  it('computes correct intervals for a complete case', () => {
    const milestones = buildCompleteCaseMilestones()
    const medians = buildCompleteMedians()

    const intervals = calculateIntervals(milestones, medians, 'surgeon')

    expect(intervals).toHaveLength(5)

    // First milestone has no interval
    expect(intervals[0].interval_minutes).toBeNull()
    expect(intervals[0].milestone_name).toBe('patient_in')

    // anes_start: 5 min after patient_in
    expect(intervals[1].interval_minutes).toBe(5)
    expect(intervals[1].surgeon_median_minutes).toBe(6)
    expect(intervals[1].delta_from_surgeon).toBeCloseTo(-1)
    expect(intervals[1].delta_severity).toBe('faster')

    // incision: 10 min after anes_start
    expect(intervals[2].interval_minutes).toBe(10)
    expect(intervals[2].surgeon_median_minutes).toBe(10)
    expect(intervals[2].delta_severity).toBe('faster') // exactly at median = faster

    // closing: 40 min after incision
    expect(intervals[3].interval_minutes).toBe(40)
    expect(intervals[3].surgeon_median_minutes).toBe(38)
    // 40/38 = 1.053 → on-pace (within 10%)
    expect(intervals[3].delta_severity).toBe('on-pace')

    // patient_out: 15 min after closing
    expect(intervals[4].interval_minutes).toBe(15)
    expect(intervals[4].surgeon_median_minutes).toBe(12)
    // 15/12 = 1.25 → slower (exactly at boundary)
    expect(intervals[4].delta_severity).toBe('slower')
  })

  it('uses facility medians when comparisonSource is "facility"', () => {
    const milestones = buildCompleteCaseMilestones()
    const medians = buildCompleteMedians()

    const intervals = calculateIntervals(milestones, medians, 'facility')

    // patient_out: 15 min, facility median = 15 → ratio 1.0 → faster
    expect(intervals[4].delta_severity).toBe('faster')
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
    // First two recorded, rest null intervals
    expect(intervals[0].interval_minutes).toBeNull()
    expect(intervals[1].interval_minutes).toBe(5)
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
    // But intervals should still be computed from timestamps
    expect(intervals[1].interval_minutes).toBe(5)
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

    // Intervals computed correctly after sorting
    expect(intervals[0].interval_minutes).toBeNull() // first
    expect(intervals[1].interval_minutes).toBe(15) // incision - patient_in
    expect(intervals[2].interval_minutes).toBe(40) // closing - incision
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
  it('buckets intervals by phase_group', () => {
    const milestones = buildCompleteCaseMilestones()
    const intervals = calculateIntervals(milestones, buildCompleteMedians(), 'surgeon')
    const allocation = calculateTimeAllocation(intervals)

    // Should have: pre_op (5 + 10 = 15), surgical (none as interval, but closing has 40 under 'closing'), closing, post_op
    // Wait: anes_start has interval=5, phase=pre_op; incision has interval=10, phase=surgical; closing has interval=40, phase=closing; patient_out has interval=15, phase=post_op
    expect(allocation.length).toBeGreaterThan(0)

    const preOp = allocation.find((a) => a.phase_group === 'pre_op')
    expect(preOp?.minutes).toBe(5) // only anes_start interval (5m) is pre_op

    const surgical = allocation.find((a) => a.phase_group === 'surgical')
    expect(surgical?.minutes).toBe(10) // incision interval

    const closing = allocation.find((a) => a.phase_group === 'closing')
    expect(closing?.minutes).toBe(40) // closing interval

    const postOp = allocation.find((a) => a.phase_group === 'post_op')
    expect(postOp?.minutes).toBe(15) // patient_out interval
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
  it('produces proportional widths based on intervals', () => {
    const milestones = buildCompleteCaseMilestones()
    const intervals = calculateIntervals(milestones, buildCompleteMedians(), 'surgeon')

    const sections = calculateSwimlaneSections(intervals, 70) // 70 min total

    expect(sections).toHaveLength(5)
    // anes_start: 5/70 ≈ 7.14%
    expect(sections[1].width_percent).toBeCloseTo(5 / 70 * 100, 1)
    // closing: 40/70 ≈ 57.14%
    expect(sections[3].width_percent).toBeCloseTo(40 / 70 * 100, 1)
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
