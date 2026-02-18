/**
 * Tests for the flag detection engine (lib/flag-detection.ts)
 *
 * Phase 1 of the Surgeon Day Analysis Redesign.
 * Covers: late start, long turnover, extended phase/subphase, fast case,
 * edge cases (missing milestones, single-case day), and computeProcedureMedians.
 */
import { describe, it, expect } from 'vitest'
import type { CaseWithMilestones, PhaseDefInput } from '../analyticsV2'
import {
  detectCaseFlags,
  computeProcedureMedians,
  aggregateDayFlags,
  DEFAULT_FLAG_THRESHOLDS,
  type CaseFlag,
  type FlagThresholds,
  type ProcedureMedians,
} from '../flag-detection'

// ============================================
// TEST HELPERS
// ============================================

/** Phase definitions for testing: Pre-Op (parent) → Anesthesia (sub), Surgical (parent), Post-Op (parent) */
const TEST_PHASES: PhaseDefInput[] = [
  {
    id: 'phase-preop',
    name: 'pre_op',
    display_name: 'Pre-Op',
    display_order: 1,
    color_key: 'blue',
    parent_phase_id: null,
    start_milestone_id: 'fm-patient-in',
    end_milestone_id: 'fm-incision',
  },
  {
    id: 'phase-anes',
    name: 'anesthesia',
    display_name: 'Anesthesia',
    display_order: 2,
    color_key: 'purple',
    parent_phase_id: 'phase-preop',
    start_milestone_id: 'fm-anes-start',
    end_milestone_id: 'fm-anes-end',
  },
  {
    id: 'phase-surgical',
    name: 'surgical',
    display_name: 'Surgical',
    display_order: 3,
    color_key: 'green',
    parent_phase_id: null,
    start_milestone_id: 'fm-incision',
    end_milestone_id: 'fm-closing',
  },
  {
    id: 'phase-postop',
    name: 'post_op',
    display_name: 'Post-Op',
    display_order: 4,
    color_key: 'orange',
    parent_phase_id: null,
    start_milestone_id: 'fm-closing',
    end_milestone_id: 'fm-patient-out',
  },
]

/** Build a minimal CaseWithMilestones for testing */
function makeCase(overrides: {
  id?: string
  caseNumber?: string
  scheduledDate?: string
  startTime?: string | null
  roomId?: string | null
  procedureId?: string | null
  procedureName?: string
  milestoneTimestamps?: Record<string, string>
}): CaseWithMilestones {
  const {
    id = 'case-1',
    caseNumber = 'C001',
    scheduledDate = '2025-03-15',
    startTime = '07:30:00',
    roomId = 'room-1',
    procedureId = 'proc-1',
    procedureName = 'Total Knee Replacement',
    milestoneTimestamps = {},
  } = overrides

  // Build case_milestones from milestoneTimestamps
  // Keys are facility_milestone_ids (e.g. 'fm-patient-in'), values are ISO timestamps
  const caseMilestones = Object.entries(milestoneTimestamps).map(
    ([facilityMilestoneId, recordedAt]) => {
      // Also set facility_milestones.name for getMilestoneMap compatibility
      const nameMap: Record<string, string> = {
        'fm-patient-in': 'patient_in',
        'fm-anes-start': 'anes_start',
        'fm-anes-end': 'anes_end',
        'fm-incision': 'incision',
        'fm-closing': 'closing',
        'fm-closing-complete': 'closing_complete',
        'fm-patient-out': 'patient_out',
      }
      return {
        facility_milestone_id: facilityMilestoneId,
        recorded_at: recordedAt,
        facility_milestones: { name: nameMap[facilityMilestoneId] || facilityMilestoneId },
      }
    },
  )

  return {
    id,
    case_number: caseNumber,
    facility_id: 'fac-1',
    scheduled_date: scheduledDate,
    start_time: startTime,
    surgeon_id: 'surg-1',
    or_room_id: roomId,
    status_id: 'status-1',
    procedure_types: procedureId ? { id: procedureId, name: procedureName } : null,
    case_milestones: caseMilestones,
  }
}

/** Create a standard case with all milestones set to specific times on 2025-03-15 */
function makeStandardCase(overrides?: Parameters<typeof makeCase>[0]): CaseWithMilestones {
  return makeCase({
    milestoneTimestamps: {
      'fm-patient-in': '2025-03-15T07:30:00Z',
      'fm-anes-start': '2025-03-15T07:35:00Z',
      'fm-anes-end': '2025-03-15T07:50:00Z',
      'fm-incision': '2025-03-15T08:00:00Z',
      'fm-closing': '2025-03-15T09:00:00Z',
      'fm-closing-complete': '2025-03-15T09:05:00Z',
      'fm-patient-out': '2025-03-15T09:15:00Z',
    },
    ...overrides,
  })
}

/** Empty medians map — no historical data */
const EMPTY_MEDIANS: ProcedureMedians = new Map()

// ============================================
// detectCaseFlags — Late Start
// ============================================

describe('detectCaseFlags — Late Start', () => {
  it('detects late start > threshold as warning', () => {
    // Scheduled 07:30, patient_in at 07:45 = +15m
    const c = makeCase({
      startTime: '07:30:00',
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T07:45:00',
        'fm-patient-out': '2025-03-15T09:00:00',
      },
    })

    const flags = detectCaseFlags(c, 0, [c], EMPTY_MEDIANS, TEST_PHASES)
    const lateFlags = flags.filter(f => f.type === 'late_start')

    expect(lateFlags).toHaveLength(1)
    expect(lateFlags[0].severity).toBe('warning')
    expect(lateFlags[0].detail).toContain('+15m')
  })

  it('detects late start 1-10m as info', () => {
    // Scheduled 07:30, patient_in at 07:35 = +5m
    const c = makeCase({
      startTime: '07:30:00',
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T07:35:00',
        'fm-patient-out': '2025-03-15T09:00:00',
      },
    })

    const flags = detectCaseFlags(c, 0, [c], EMPTY_MEDIANS, TEST_PHASES)
    const lateFlags = flags.filter(f => f.type === 'late_start')

    expect(lateFlags).toHaveLength(1)
    expect(lateFlags[0].severity).toBe('info')
  })

  it('does not flag on-time start', () => {
    // Scheduled 07:30, patient_in at 07:30
    const c = makeCase({
      startTime: '07:30:00',
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T07:30:00',
        'fm-patient-out': '2025-03-15T09:00:00',
      },
    })

    const flags = detectCaseFlags(c, 0, [c], EMPTY_MEDIANS, TEST_PHASES)
    expect(flags.filter(f => f.type === 'late_start')).toHaveLength(0)
  })

  it('only checks first case (caseIndex === 0)', () => {
    // Late by 20m but caseIndex = 1 → no late start flag
    const c = makeCase({
      startTime: '07:30:00',
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T07:50:00',
        'fm-patient-out': '2025-03-15T09:00:00',
      },
    })

    const flags = detectCaseFlags(c, 1, [c], EMPTY_MEDIANS, TEST_PHASES)
    expect(flags.filter(f => f.type === 'late_start')).toHaveLength(0)
  })

  it('handles missing start_time gracefully', () => {
    const c = makeCase({
      startTime: null,
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T07:50:00',
        'fm-patient-out': '2025-03-15T09:00:00',
      },
    })

    const flags = detectCaseFlags(c, 0, [c], EMPTY_MEDIANS, TEST_PHASES)
    expect(flags.filter(f => f.type === 'late_start')).toHaveLength(0)
  })
})

// ============================================
// detectCaseFlags — Long Turnover
// ============================================

describe('detectCaseFlags — Long Turnover', () => {
  it('detects long turnover between consecutive same-room cases', () => {
    const case1 = makeCase({
      id: 'case-1',
      caseNumber: 'C001',
      roomId: 'room-1',
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T07:30:00Z',
        'fm-patient-out': '2025-03-15T09:00:00Z',
      },
    })
    const case2 = makeCase({
      id: 'case-2',
      caseNumber: 'C002',
      roomId: 'room-1',
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T09:45:00Z', // 45m after case1 patient_out
        'fm-patient-out': '2025-03-15T11:00:00Z',
      },
    })

    const allCases = [case1, case2]
    const flags = detectCaseFlags(case2, 1, allCases, EMPTY_MEDIANS, TEST_PHASES)
    const turnoverFlags = flags.filter(f => f.type === 'long_turnover')

    expect(turnoverFlags).toHaveLength(1)
    expect(turnoverFlags[0].severity).toBe('warning')
    expect(turnoverFlags[0].detail).toContain('45m')
  })

  it('does not flag normal turnover', () => {
    const case1 = makeCase({
      id: 'case-1',
      roomId: 'room-1',
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T07:30:00Z',
        'fm-patient-out': '2025-03-15T09:00:00Z',
      },
    })
    const case2 = makeCase({
      id: 'case-2',
      roomId: 'room-1',
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T09:20:00Z', // 20m turnover (under threshold)
        'fm-patient-out': '2025-03-15T11:00:00Z',
      },
    })

    const flags = detectCaseFlags(case2, 1, [case1, case2], EMPTY_MEDIANS, TEST_PHASES)
    expect(flags.filter(f => f.type === 'long_turnover')).toHaveLength(0)
  })

  it('does not flag turnover for cases in different rooms', () => {
    const case1 = makeCase({
      id: 'case-1',
      roomId: 'room-1',
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T07:30:00Z',
        'fm-patient-out': '2025-03-15T09:00:00Z',
      },
    })
    const case2 = makeCase({
      id: 'case-2',
      roomId: 'room-2', // Different room
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T09:45:00Z',
        'fm-patient-out': '2025-03-15T11:00:00Z',
      },
    })

    const flags = detectCaseFlags(case2, 1, [case1, case2], EMPTY_MEDIANS, TEST_PHASES)
    expect(flags.filter(f => f.type === 'long_turnover')).toHaveLength(0)
  })

  it('single-case day returns no turnover flags', () => {
    const c = makeStandardCase()
    const flags = detectCaseFlags(c, 0, [c], EMPTY_MEDIANS, TEST_PHASES)
    expect(flags.filter(f => f.type === 'long_turnover')).toHaveLength(0)
  })
})

// ============================================
// detectCaseFlags — Extended Phase
// ============================================

describe('detectCaseFlags — Extended Phase', () => {
  it('flags parent phase > 40% over median', () => {
    // Surgical phase: incision→closing = 90m (5400s)
    // Median for proc-1:phase-surgical = 60m (3600s) → 50% over → flag
    const medians: ProcedureMedians = new Map([['proc-1:phase-surgical', 3600]])

    const c = makeCase({
      procedureId: 'proc-1',
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T07:30:00Z',
        'fm-incision': '2025-03-15T08:00:00Z',
        'fm-closing': '2025-03-15T09:30:00Z', // 90m surgical
        'fm-patient-out': '2025-03-15T10:00:00Z',
      },
    })

    const flags = detectCaseFlags(c, 0, [c], medians, TEST_PHASES)
    const extFlags = flags.filter(f => f.type === 'extended_phase')

    expect(extFlags).toHaveLength(1)
    expect(extFlags[0].severity).toBe('caution')
    expect(extFlags[0].label).toBe('Extended Surgical')
    expect(extFlags[0].detail).toContain('90m vs 60m med')
  })

  it('does not flag phase within 40% of median', () => {
    // Surgical phase: 70m (4200s), median 60m (3600s) → 16.7% over → no flag
    const medians: ProcedureMedians = new Map([['proc-1:phase-surgical', 3600]])

    const c = makeCase({
      procedureId: 'proc-1',
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T07:30:00Z',
        'fm-incision': '2025-03-15T08:00:00Z',
        'fm-closing': '2025-03-15T09:10:00Z', // 70m surgical
        'fm-patient-out': '2025-03-15T09:30:00Z',
      },
    })

    const flags = detectCaseFlags(c, 0, [c], medians, TEST_PHASES)
    expect(flags.filter(f => f.type === 'extended_phase')).toHaveLength(0)
  })
})

// ============================================
// detectCaseFlags — Extended Sub-phase
// ============================================

describe('detectCaseFlags — Extended Sub-phase', () => {
  it('flags sub-phase > 30% over median', () => {
    // Anesthesia sub-phase: anes_start→anes_end = 25m (1500s)
    // Median = 15m (900s) → 67% over → flag
    const medians: ProcedureMedians = new Map([['proc-1:phase-anes', 900]])

    const c = makeCase({
      procedureId: 'proc-1',
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T07:30:00Z',
        'fm-anes-start': '2025-03-15T07:35:00Z',
        'fm-anes-end': '2025-03-15T08:00:00Z', // 25m anesthesia
        'fm-incision': '2025-03-15T08:00:00Z',
        'fm-closing': '2025-03-15T09:00:00Z',
        'fm-patient-out': '2025-03-15T09:15:00Z',
      },
    })

    const flags = detectCaseFlags(c, 0, [c], medians, TEST_PHASES)
    const subFlags = flags.filter(f => f.type === 'extended_subphase')

    expect(subFlags).toHaveLength(1)
    expect(subFlags[0].severity).toBe('caution')
    expect(subFlags[0].label).toBe('Extended Anesthesia')
  })

  it('does not flag sub-phase within 30% of median', () => {
    // Anesthesia: 18m (1080s), median 15m (900s) → 20% over → no flag (threshold 30%)
    const medians: ProcedureMedians = new Map([['proc-1:phase-anes', 900]])

    const c = makeCase({
      procedureId: 'proc-1',
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T07:30:00Z',
        'fm-anes-start': '2025-03-15T07:35:00Z',
        'fm-anes-end': '2025-03-15T07:53:00Z', // 18m
        'fm-incision': '2025-03-15T08:00:00Z',
        'fm-closing': '2025-03-15T09:00:00Z',
        'fm-patient-out': '2025-03-15T09:15:00Z',
      },
    })

    const flags = detectCaseFlags(c, 0, [c], medians, TEST_PHASES)
    expect(flags.filter(f => f.type === 'extended_subphase')).toHaveLength(0)
  })
})

// ============================================
// detectCaseFlags — Fast Case
// ============================================

describe('detectCaseFlags — Fast Case', () => {
  it('flags case > 15% under median total OR time', () => {
    // Total OR time: patient_in→patient_out = 80m (4800s)
    // Median = 105m (6300s) → 24% under → flag
    const medians: ProcedureMedians = new Map([['proc-1:total', 6300]])

    const c = makeCase({
      procedureId: 'proc-1',
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T07:30:00Z',
        'fm-incision': '2025-03-15T08:00:00Z',
        'fm-closing': '2025-03-15T08:40:00Z',
        'fm-patient-out': '2025-03-15T08:50:00Z', // 80m total
      },
    })

    const flags = detectCaseFlags(c, 0, [c], medians, TEST_PHASES)
    const fastFlags = flags.filter(f => f.type === 'fast_case')

    expect(fastFlags).toHaveLength(1)
    expect(fastFlags[0].severity).toBe('positive')
    expect(fastFlags[0].icon).toBe('⚡')
  })

  it('does not flag case within 15% of median', () => {
    // Total OR time: 95m (5700s), median 105m (6300s) → 9.5% under → no flag
    const medians: ProcedureMedians = new Map([['proc-1:total', 6300]])

    const c = makeCase({
      procedureId: 'proc-1',
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T07:30:00Z',
        'fm-incision': '2025-03-15T08:00:00Z',
        'fm-closing': '2025-03-15T08:50:00Z',
        'fm-patient-out': '2025-03-15T09:05:00Z', // 95m total
      },
    })

    const flags = detectCaseFlags(c, 0, [c], medians, TEST_PHASES)
    expect(flags.filter(f => f.type === 'fast_case')).toHaveLength(0)
  })
})

// ============================================
// detectCaseFlags — No Flags
// ============================================

describe('detectCaseFlags — No flags case', () => {
  it('returns empty array when everything is normal', () => {
    // On-time start, normal phase durations, normal total time
    const medians: ProcedureMedians = new Map([
      ['proc-1:phase-preop', 1800],   // 30m median pre-op
      ['proc-1:phase-surgical', 3600], // 60m median surgical
      ['proc-1:phase-postop', 900],    // 15m median post-op
      ['proc-1:total', 6300],          // 105m median total
    ])

    const c = makeCase({
      startTime: '07:30:00',
      procedureId: 'proc-1',
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T07:30:00Z', // On time
        'fm-incision': '2025-03-15T08:00:00Z',   // 30m pre-op (matches median)
        'fm-closing': '2025-03-15T09:00:00Z',    // 60m surgical (matches median)
        'fm-patient-out': '2025-03-15T09:15:00Z', // 105m total (matches median)
      },
    })

    const flags = detectCaseFlags(c, 0, [c], medians, TEST_PHASES)
    expect(flags).toHaveLength(0)
  })
})

// ============================================
// detectCaseFlags — Edge Cases
// ============================================

describe('detectCaseFlags — Edge Cases', () => {
  it('case with missing milestones returns no phase-extension flags', () => {
    // Only patient_in and patient_out, no incision/closing
    const medians: ProcedureMedians = new Map([
      ['proc-1:phase-surgical', 3600],
      ['proc-1:total', 6300],
    ])

    const c = makeCase({
      startTime: '07:30:00',
      procedureId: 'proc-1',
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T07:30:00Z',
        'fm-patient-out': '2025-03-15T09:00:00Z',
      },
    })

    const flags = detectCaseFlags(c, 0, [c], medians, TEST_PHASES)
    // Should not have any extended_phase flags since surgical milestones are missing
    expect(flags.filter(f => f.type === 'extended_phase')).toHaveLength(0)
    expect(flags.filter(f => f.type === 'extended_subphase')).toHaveLength(0)
  })

  it('case with no procedure returns no phase or fast flags', () => {
    const medians: ProcedureMedians = new Map([['proc-1:total', 3600]])

    const c = makeCase({
      procedureId: null,
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T07:30:00Z',
        'fm-patient-out': '2025-03-15T08:00:00Z',
      },
    })

    const flags = detectCaseFlags(c, 0, [c], medians, TEST_PHASES)
    expect(flags.filter(f => f.type === 'extended_phase')).toHaveLength(0)
    expect(flags.filter(f => f.type === 'fast_case')).toHaveLength(0)
  })

  it('custom thresholds override defaults', () => {
    // Use very strict threshold: 5m late start
    const strict: FlagThresholds = {
      ...DEFAULT_FLAG_THRESHOLDS,
      lateStartMinutes: 5,
    }

    const c = makeCase({
      startTime: '07:30:00',
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T07:37:00', // +7m
        'fm-patient-out': '2025-03-15T09:00:00',
      },
    })

    // With default (10m), this would be info
    const defaultFlags = detectCaseFlags(c, 0, [c], EMPTY_MEDIANS, TEST_PHASES)
    expect(defaultFlags.filter(f => f.type === 'late_start')[0].severity).toBe('info')

    // With strict (5m), this should be warning
    const strictFlags = detectCaseFlags(c, 0, [c], EMPTY_MEDIANS, TEST_PHASES, strict)
    expect(strictFlags.filter(f => f.type === 'late_start')[0].severity).toBe('warning')
  })
})

// ============================================
// computeProcedureMedians
// ============================================

describe('computeProcedureMedians', () => {
  it('computes correct medians for a small cohort', () => {
    // 3 cases with surgical phase durations: 3600s, 4200s, 3000s → median = 3600
    const cases: CaseWithMilestones[] = [
      makeCase({
        id: 'c1',
        procedureId: 'proc-1',
        milestoneTimestamps: {
          'fm-patient-in': '2025-03-15T07:30:00Z',
          'fm-incision': '2025-03-15T08:00:00Z',
          'fm-closing': '2025-03-15T09:00:00Z', // 60m
          'fm-patient-out': '2025-03-15T09:30:00Z', // 120m total
        },
      }),
      makeCase({
        id: 'c2',
        procedureId: 'proc-1',
        milestoneTimestamps: {
          'fm-patient-in': '2025-03-15T07:30:00Z',
          'fm-incision': '2025-03-15T08:00:00Z',
          'fm-closing': '2025-03-15T09:10:00Z', // 70m
          'fm-patient-out': '2025-03-15T09:40:00Z', // 130m total
        },
      }),
      makeCase({
        id: 'c3',
        procedureId: 'proc-1',
        milestoneTimestamps: {
          'fm-patient-in': '2025-03-15T07:30:00Z',
          'fm-incision': '2025-03-15T08:00:00Z',
          'fm-closing': '2025-03-15T08:50:00Z', // 50m
          'fm-patient-out': '2025-03-15T09:10:00Z', // 100m total
        },
      }),
    ]

    const medians = computeProcedureMedians(cases, TEST_PHASES)

    // Surgical phase: 3600, 4200, 3000 → sorted: 3000, 3600, 4200 → median = 3600
    expect(medians.get('proc-1:phase-surgical')).toBe(3600)

    // Total OR time: 7200, 7800, 6000 → sorted: 6000, 7200, 7800 → median = 7200
    expect(medians.get('proc-1:total')).toBe(7200)
  })

  it('handles even number of values (average of middle two)', () => {
    // 4 cases with surgical: 3000, 3600, 4200, 4800 → median = (3600+4200)/2 = 3900
    const cases: CaseWithMilestones[] = [
      makeCase({
        id: 'c1', procedureId: 'proc-1',
        milestoneTimestamps: {
          'fm-patient-in': '2025-03-15T07:00:00Z',
          'fm-incision': '2025-03-15T07:30:00Z',
          'fm-closing': '2025-03-15T08:20:00Z', // 50m = 3000s
          'fm-patient-out': '2025-03-15T08:30:00Z',
        },
      }),
      makeCase({
        id: 'c2', procedureId: 'proc-1',
        milestoneTimestamps: {
          'fm-patient-in': '2025-03-15T07:00:00Z',
          'fm-incision': '2025-03-15T07:30:00Z',
          'fm-closing': '2025-03-15T08:30:00Z', // 60m = 3600s
          'fm-patient-out': '2025-03-15T08:45:00Z',
        },
      }),
      makeCase({
        id: 'c3', procedureId: 'proc-1',
        milestoneTimestamps: {
          'fm-patient-in': '2025-03-15T07:00:00Z',
          'fm-incision': '2025-03-15T07:30:00Z',
          'fm-closing': '2025-03-15T08:40:00Z', // 70m = 4200s
          'fm-patient-out': '2025-03-15T08:55:00Z',
        },
      }),
      makeCase({
        id: 'c4', procedureId: 'proc-1',
        milestoneTimestamps: {
          'fm-patient-in': '2025-03-15T07:00:00Z',
          'fm-incision': '2025-03-15T07:30:00Z',
          'fm-closing': '2025-03-15T08:50:00Z', // 80m = 4800s
          'fm-patient-out': '2025-03-15T09:15:00Z',
        },
      }),
    ]

    const medians = computeProcedureMedians(cases, TEST_PHASES)
    expect(medians.get('proc-1:phase-surgical')).toBe(3900)
  })

  it('computes separate medians per procedure type', () => {
    const cases: CaseWithMilestones[] = [
      makeCase({
        id: 'c1', procedureId: 'proc-knee',
        milestoneTimestamps: {
          'fm-patient-in': '2025-03-15T07:00:00Z',
          'fm-incision': '2025-03-15T07:30:00Z',
          'fm-closing': '2025-03-15T08:30:00Z', // 60m
          'fm-patient-out': '2025-03-15T09:00:00Z',
        },
      }),
      makeCase({
        id: 'c2', procedureId: 'proc-hip',
        milestoneTimestamps: {
          'fm-patient-in': '2025-03-15T07:00:00Z',
          'fm-incision': '2025-03-15T07:30:00Z',
          'fm-closing': '2025-03-15T09:00:00Z', // 90m
          'fm-patient-out': '2025-03-15T09:30:00Z',
        },
      }),
    ]

    const medians = computeProcedureMedians(cases, TEST_PHASES)
    expect(medians.get('proc-knee:phase-surgical')).toBe(3600) // 60m
    expect(medians.get('proc-hip:phase-surgical')).toBe(5400)  // 90m
  })

  it('skips cases with missing milestones for that phase', () => {
    const cases: CaseWithMilestones[] = [
      makeCase({
        id: 'c1', procedureId: 'proc-1',
        milestoneTimestamps: {
          'fm-patient-in': '2025-03-15T07:00:00Z',
          'fm-incision': '2025-03-15T07:30:00Z',
          'fm-closing': '2025-03-15T08:30:00Z',
          'fm-patient-out': '2025-03-15T09:00:00Z',
        },
      }),
      makeCase({
        id: 'c2', procedureId: 'proc-1',
        milestoneTimestamps: {
          // Missing incision and closing — surgical phase will be null
          'fm-patient-in': '2025-03-15T07:00:00Z',
          'fm-patient-out': '2025-03-15T09:00:00Z',
        },
      }),
    ]

    const medians = computeProcedureMedians(cases, TEST_PHASES)
    // Only 1 case has surgical data, so median is that single value
    expect(medians.get('proc-1:phase-surgical')).toBe(3600)
  })
})

// ============================================
// aggregateDayFlags
// ============================================

describe('aggregateDayFlags', () => {
  it('flattens case flags into a list with case numbers', () => {
    const case1 = makeCase({ id: 'c1', caseNumber: 'C001' })
    const case2 = makeCase({ id: 'c2', caseNumber: 'C002' })

    const caseFlagsMap: Record<string, CaseFlag[]> = {
      c1: [
        { type: 'late_start', severity: 'warning', label: 'Late Start', detail: '+15m', icon: '🕐' },
      ],
      c2: [
        { type: 'fast_case', severity: 'positive', label: 'Fast Case', detail: '-20%', icon: '⚡' },
        { type: 'long_turnover', severity: 'warning', label: 'Long Turnover', detail: '45m', icon: '⏳' },
      ],
    }

    const result = aggregateDayFlags([case1, case2], caseFlagsMap)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ caseNumber: 'C001', flag: caseFlagsMap.c1[0] })
    expect(result[1]).toEqual({ caseNumber: 'C002', flag: caseFlagsMap.c2[0] })
    expect(result[2]).toEqual({ caseNumber: 'C002', flag: caseFlagsMap.c2[1] })
  })

  it('returns empty array when no flags', () => {
    const cases = [makeCase({ id: 'c1' })]
    const result = aggregateDayFlags(cases, {})
    expect(result).toHaveLength(0)
  })
})

// ============================================
// Integration: detectCaseFlags + computeProcedureMedians
// ============================================

describe('Integration: full flag detection workflow', () => {
  it('computes medians from historical data and detects flags in day cases', () => {
    // Historical: 10 cases with 60m surgical time each → median 3600s
    const historicalCases = Array.from({ length: 10 }, (_, i) =>
      makeCase({
        id: `hist-${i}`,
        procedureId: 'proc-1',
        milestoneTimestamps: {
          'fm-patient-in': '2025-03-10T07:00:00Z',
          'fm-incision': '2025-03-10T07:30:00Z',
          'fm-closing': '2025-03-10T08:30:00Z', // 60m surgical
          'fm-patient-out': '2025-03-10T09:00:00Z', // 120m total
        },
      }),
    )

    const medians = computeProcedureMedians(historicalCases, TEST_PHASES)

    // Day case: surgical time = 90m (50% over 60m median → flags at 40% threshold)
    const dayCase = makeCase({
      id: 'day-1',
      startTime: '07:30:00',
      procedureId: 'proc-1',
      milestoneTimestamps: {
        'fm-patient-in': '2025-03-15T07:30:00Z',
        'fm-incision': '2025-03-15T08:00:00Z',
        'fm-closing': '2025-03-15T09:30:00Z', // 90m surgical
        'fm-patient-out': '2025-03-15T10:00:00Z',
      },
    })

    const flags = detectCaseFlags(dayCase, 0, [dayCase], medians, TEST_PHASES)

    // Should have extended surgical phase flag
    const extFlags = flags.filter(f => f.type === 'extended_phase')
    expect(extFlags).toHaveLength(1)
    expect(extFlags[0].label).toBe('Extended Surgical')
  })
})
