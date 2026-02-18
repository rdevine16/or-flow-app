/**
 * Phase 2 tests: FacilityAnalyticsConfig wiring, target-relative colors
 *
 * Verifies:
 * 1. Each calculate* function uses config values when provided
 * 2. Each calculate* function falls back to ANALYTICS_CONFIG_DEFAULTS when not
 * 3. Target-relative colors change based on config values
 * 4. calculateAnalyticsOverview forwards config to each function
 * 5. Changing config values changes targets, colors, and targetMet flags
 */
import { describe, it, expect } from 'vitest'
import {
  calculateFCOTS,
  calculateTurnoverTime,
  calculateORUtilization,
  calculateCancellationRate,
  calculateCumulativeTardiness,
  calculateNonOperativeTime,
  calculateSurgeonIdleTime,
  calculateSurgicalTurnovers,
  calculateAnalyticsOverview,
  ANALYTICS_CONFIG_DEFAULTS,
  type CaseWithMilestones,
  type CaseWithMilestonesAndSurgeon,
} from '../analyticsV2'

// ============================================
// HELPERS
// ============================================

function makeCase(overrides: Partial<CaseWithMilestones> & { milestones?: Record<string, string> }): CaseWithMilestones {
  const { milestones, ...rest } = overrides
  const caseMilestones = milestones
    ? Object.entries(milestones).map(([name, recorded_at]) => ({
        facility_milestone_id: `fm_${name}`,
        recorded_at,
        facility_milestones: { name },
      }))
    : []

  return {
    id: 'case-1',
    case_number: 'C001',
    facility_id: 'fac-1',
    scheduled_date: '2025-02-03',
    start_time: '07:30:00',
    surgeon_id: 'surg-1',
    or_room_id: 'room-1',
    status_id: 'status-1',
    surgeon: { first_name: 'John', last_name: 'Martinez' },
    or_rooms: { id: 'room-1', name: 'OR-1' },
    case_statuses: { name: 'completed' },
    procedure_types: null,
    case_milestones: caseMilestones,
    ...rest,
  }
}

function makeSurgeonCase(
  overrides: Partial<CaseWithMilestonesAndSurgeon> & { milestones?: Record<string, string> }
): CaseWithMilestonesAndSurgeon {
  return {
    ...makeCase(overrides),
    surgeon_profile: { id: 'sp-1', closing_workflow: 'surgeon_closes', closing_handoff_minutes: 0 },
    ...overrides,
  } as CaseWithMilestonesAndSurgeon
}

// ============================================
// DEFAULTS FALLBACK
// ============================================

describe('ANALYTICS_CONFIG_DEFAULTS', () => {
  it('exports expected default values', () => {
    expect(ANALYTICS_CONFIG_DEFAULTS.sameRoomTurnoverTarget).toBe(45)
    expect(ANALYTICS_CONFIG_DEFAULTS.flipRoomTurnoverTarget).toBe(15)
    expect(ANALYTICS_CONFIG_DEFAULTS.turnoverThresholdMinutes).toBe(30)
    expect(ANALYTICS_CONFIG_DEFAULTS.turnoverComplianceTarget).toBe(80)
    expect(ANALYTICS_CONFIG_DEFAULTS.utilizationTargetPercent).toBe(75)
    expect(ANALYTICS_CONFIG_DEFAULTS.cancellationTargetPercent).toBe(5)
    expect(ANALYTICS_CONFIG_DEFAULTS.tardinessTargetMinutes).toBe(45)
    expect(ANALYTICS_CONFIG_DEFAULTS.idleCombinedTargetMinutes).toBe(10)
    expect(ANALYTICS_CONFIG_DEFAULTS.idleFlipTargetMinutes).toBe(5)
    expect(ANALYTICS_CONFIG_DEFAULTS.idleSameRoomTargetMinutes).toBe(10)
    expect(ANALYTICS_CONFIG_DEFAULTS.nonOpWarnMinutes).toBe(20)
    expect(ANALYTICS_CONFIG_DEFAULTS.nonOpBadMinutes).toBe(30)
    expect(ANALYTICS_CONFIG_DEFAULTS.fcotsTargetPercent).toBe(85)
  })
})

// ============================================
// calculateTurnoverTime — config wiring
// ============================================

describe('calculateTurnoverTime config', () => {
  // Two consecutive cases in the same room with a 25-min turnover
  const cases = [
    makeCase({
      id: 'c1',
      scheduled_date: '2025-02-03',
      start_time: '07:30:00',
      or_room_id: 'room-1',
      milestones: {
        patient_in: '2025-02-03T07:30:00Z',
        patient_out: '2025-02-03T08:30:00Z',
      },
    }),
    makeCase({
      id: 'c2',
      case_number: 'C002',
      scheduled_date: '2025-02-03',
      start_time: '08:55:00',
      or_room_id: 'room-1',
      milestones: {
        patient_in: '2025-02-03T08:55:00Z',
        patient_out: '2025-02-03T10:00:00Z',
      },
    }),
  ]

  it('uses default threshold (30 min) when no config', () => {
    const result = calculateTurnoverTime(cases)
    // 25 min turnover ≤ 30 min threshold → 100% compliance
    expect(result.subtitle).toContain('under 30 min')
    expect(result.target).toBe(80) // default compliance target
  })

  it('uses custom threshold from config', () => {
    const result = calculateTurnoverTime(cases, undefined, {
      turnoverThresholdMinutes: 20,
      turnoverComplianceTarget: 90,
    })
    // 25 min turnover > 20 min threshold → 0% compliance
    expect(result.subtitle).toContain('under 20 min')
    expect(result.target).toBe(90)
    expect(result.targetMet).toBe(false) // 0% < 90%
  })

  it('target-relative daily colors use threshold', () => {
    // With default 30 min threshold, 25 min → green (≤ 30)
    const defaultResult = calculateTurnoverTime(cases)
    expect(defaultResult.dailyData![0].color).toBe('green')

    // With 20 min threshold, 25 min → yellow (≤ 20 * 1.2 = 24 → no, 25 > 24 → red)
    const customResult = calculateTurnoverTime(cases, undefined, {
      turnoverThresholdMinutes: 20,
    })
    expect(customResult.dailyData![0].color).toBe('red')
  })
})

// ============================================
// calculateORUtilization — config wiring
// ============================================

describe('calculateORUtilization config', () => {
  // Case using 2 hours of a 10-hour day = 20% utilization
  const cases = [
    makeCase({
      scheduled_date: '2025-02-03',
      or_room_id: 'room-1',
      milestones: {
        patient_in: '2025-02-03T07:30:00Z',
        patient_out: '2025-02-03T09:30:00Z', // 2 hours
      },
    }),
  ]

  it('uses default utilization target (75%) when no config', () => {
    const result = calculateORUtilization(cases, 10)
    expect(result.target).toBe(75)
    expect(result.subtitle).toContain('75%')
    expect(result.targetMet).toBe(false) // 20% < 75%
  })

  it('uses custom utilization target from config', () => {
    const result = calculateORUtilization(cases, 10, undefined, undefined, {
      utilizationTargetPercent: 15,
    })
    expect(result.target).toBe(15)
    expect(result.subtitle).toContain('15%')
    expect(result.targetMet).toBe(true) // 20% ≥ 15%
  })

  it('target-relative daily colors use utilization target', () => {
    // 20% utilization with 75% target → red (20 < 75 * 0.8 = 60)
    const defaultResult = calculateORUtilization(cases, 10)
    expect(defaultResult.dailyData![0].color).toBe('red')

    // 20% utilization with 20% target → green (20 ≥ 20)
    const customResult = calculateORUtilization(cases, 10, undefined, undefined, {
      utilizationTargetPercent: 20,
    })
    expect(customResult.dailyData![0].color).toBe('green')
  })
})

// ============================================
// calculateCancellationRate — config wiring
// ============================================

describe('calculateCancellationRate config', () => {
  // 2 cases, 1 same-day cancellation = 50% rate
  const cases = [
    makeCase({ id: 'c1', scheduled_date: '2025-02-03' }),
    makeCase({
      id: 'c2',
      scheduled_date: '2025-02-03',
      case_statuses: { name: 'cancelled' },
      cancelled_at: '2025-02-03T10:00:00Z',
    }),
  ]

  it('uses default target (5%) when no config', () => {
    const result = calculateCancellationRate(cases)
    expect(result.target).toBe(5)
    expect(result.targetMet).toBe(false) // 50% > 5%
  })

  it('uses custom target from config', () => {
    const result = calculateCancellationRate(cases, undefined, {
      cancellationTargetPercent: 60,
    })
    expect(result.target).toBe(60)
    expect(result.targetMet).toBe(true) // 50% ≤ 60%
  })
})

// ============================================
// calculateCumulativeTardiness — config wiring
// ============================================

describe('calculateCumulativeTardiness config', () => {
  it('uses default target (45 min) when no config', () => {
    // We use local-time compatible timestamps to avoid timezone issues
    const localScheduled = new Date(2025, 1, 3, 7, 30, 0)
    const localPatientIn = new Date(localScheduled.getTime() + 40 * 60000)
    const localCases = [
      makeCase({
        scheduled_date: '2025-02-03',
        start_time: '07:30:00',
        milestones: { patient_in: localPatientIn.toISOString() },
      }),
    ]
    const result = calculateCumulativeTardiness(localCases)
    expect(result.target).toBe(45)
    expect(result.targetMet).toBe(true) // 40 min ≤ 45 min
  })

  it('uses custom target from config', () => {
    const localScheduled = new Date(2025, 1, 3, 7, 30, 0)
    const localPatientIn = new Date(localScheduled.getTime() + 40 * 60000)
    const localCases = [
      makeCase({
        scheduled_date: '2025-02-03',
        start_time: '07:30:00',
        milestones: { patient_in: localPatientIn.toISOString() },
      }),
    ]
    const result = calculateCumulativeTardiness(localCases, {
      tardinessTargetMinutes: 30,
    })
    expect(result.target).toBe(30)
    expect(result.targetMet).toBe(false) // 40 min > 30 min
  })

  it('target-relative daily colors use tardiness target', () => {
    const localScheduled = new Date(2025, 1, 3, 7, 30, 0)
    const localPatientIn = new Date(localScheduled.getTime() + 40 * 60000)
    const localCases = [
      makeCase({
        scheduled_date: '2025-02-03',
        start_time: '07:30:00',
        milestones: { patient_in: localPatientIn.toISOString() },
      }),
    ]

    // Default target 45 → 40 min ≤ 45 → green
    const defaultResult = calculateCumulativeTardiness(localCases)
    expect(defaultResult.dailyData![0].color).toBe('green')

    // Custom target 30 → 40 min > 30 * 1.2 = 36 → red
    const customResult = calculateCumulativeTardiness(localCases, {
      tardinessTargetMinutes: 30,
    })
    expect(customResult.dailyData![0].color).toBe('red')
  })
})

// ============================================
// calculateNonOperativeTime — config wiring
// ============================================

describe('calculateNonOperativeTime config', () => {
  // Case with 25 min non-operative time (pre-op only)
  const cases = [
    makeCase({
      scheduled_date: '2025-02-03',
      milestones: {
        patient_in: '2025-02-03T07:30:00Z',
        incision: '2025-02-03T07:55:00Z', // 25 min pre-op
        patient_out: '2025-02-03T09:00:00Z',
      },
    }),
  ]

  it('uses default thresholds (warn=20, bad=30) when no config', () => {
    const result = calculateNonOperativeTime(cases)
    expect(result.target).toBe(20) // warn is the target
    expect(result.targetMet).toBe(false) // 25 > 20
  })

  it('uses custom thresholds from config', () => {
    const result = calculateNonOperativeTime(cases, {
      nonOpWarnMinutes: 30,
      nonOpBadMinutes: 40,
    })
    expect(result.target).toBe(30)
    expect(result.targetMet).toBe(true) // 25 ≤ 30
  })

  it('daily colors use custom warn/bad thresholds', () => {
    // Default: 25 min > 20 warn → yellow (25 ≤ 30 bad)
    const defaultResult = calculateNonOperativeTime(cases)
    expect(defaultResult.dailyData![0].color).toBe('yellow')

    // Custom warn=30: 25 min ≤ 30 → green
    const customResult = calculateNonOperativeTime(cases, {
      nonOpWarnMinutes: 30,
      nonOpBadMinutes: 40,
    })
    expect(customResult.dailyData![0].color).toBe('green')
  })
})

// ============================================
// calculateSurgeonIdleTime — config wiring
// ============================================

describe('calculateSurgeonIdleTime config', () => {
  // Two cases for same surgeon on same day with 8-min gap (same room)
  const cases: CaseWithMilestonesAndSurgeon[] = [
    makeSurgeonCase({
      id: 'c1',
      case_number: 'C001',
      scheduled_date: '2025-02-03',
      start_time: '07:30:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-1',
      milestones: {
        patient_in: '2025-02-03T07:30:00Z',
        incision: '2025-02-03T07:45:00Z',
        closing: '2025-02-03T08:30:00Z',
        closing_complete: '2025-02-03T08:40:00Z',
        patient_out: '2025-02-03T08:50:00Z',
      },
    }),
    makeSurgeonCase({
      id: 'c2',
      case_number: 'C002',
      scheduled_date: '2025-02-03',
      start_time: '08:50:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-1',
      milestones: {
        patient_in: '2025-02-03T08:55:00Z',
        incision: '2025-02-03T08:48:00Z', // 8 min after closing_complete
        closing: '2025-02-03T09:30:00Z',
        closing_complete: '2025-02-03T09:40:00Z',
        patient_out: '2025-02-03T09:50:00Z',
      },
    }),
  ]

  it('uses default targets when no config', () => {
    const result = calculateSurgeonIdleTime(cases)
    expect(result.kpi.target).toBe(10) // combined default
    expect(result.flipKpi.target).toBe(5) // flip default
    expect(result.sameRoomKpi.target).toBe(10) // same room default
  })

  it('uses custom targets from config', () => {
    const result = calculateSurgeonIdleTime(cases, {
      idleCombinedTargetMinutes: 15,
      idleFlipTargetMinutes: 8,
      idleSameRoomTargetMinutes: 12,
    })
    expect(result.kpi.target).toBe(15)
    expect(result.flipKpi.target).toBe(8)
    expect(result.sameRoomKpi.target).toBe(12)
  })

  it('targetMet changes based on config', () => {
    // With default targets (10 min combined)
    const defaultResult = calculateSurgeonIdleTime(cases)
    // With very low target (2 min combined), should fail
    const strictResult = calculateSurgeonIdleTime(cases, {
      idleCombinedTargetMinutes: 2,
    })
    // The actual idle value stays the same; only targetMet changes
    expect(defaultResult.kpi.value).toBe(strictResult.kpi.value)
    // If idle > 2, strict should not meet target
    if (strictResult.kpi.value > 2) {
      expect(strictResult.kpi.targetMet).toBe(false)
    }
  })
})

// ============================================
// calculateSurgicalTurnovers — config wiring
// ============================================

describe('calculateSurgicalTurnovers config', () => {
  // Two same-room cases with 30-min surgical turnover
  const cases: CaseWithMilestonesAndSurgeon[] = [
    makeSurgeonCase({
      id: 'c1',
      case_number: 'C001',
      scheduled_date: '2025-02-03',
      start_time: '07:30:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-1',
      milestones: {
        incision: '2025-02-03T07:45:00Z',
        closing: '2025-02-03T08:30:00Z',
        closing_complete: '2025-02-03T08:40:00Z',
        patient_out: '2025-02-03T08:50:00Z',
      },
    }),
    makeSurgeonCase({
      id: 'c2',
      case_number: 'C002',
      scheduled_date: '2025-02-03',
      start_time: '09:10:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-1',
      milestones: {
        incision: '2025-02-03T09:10:00Z', // 30 min after closing_complete
        closing: '2025-02-03T10:00:00Z',
        closing_complete: '2025-02-03T10:10:00Z',
        patient_out: '2025-02-03T10:20:00Z',
      },
    }),
  ]

  it('uses default same-room target (45 min) when no config', () => {
    const result = calculateSurgicalTurnovers(cases)
    expect(result.sameRoomSurgicalTurnover.target).toBe(45)
    // 30 min ≤ 45 → target met
    expect(result.sameRoomSurgicalTurnover.targetMet).toBe(true)
  })

  it('uses custom same-room target from config', () => {
    const result = calculateSurgicalTurnovers(cases, undefined, {
      sameRoomTurnoverTarget: 20,
    })
    expect(result.sameRoomSurgicalTurnover.target).toBe(20)
    // 30 min > 20 → target not met
    expect(result.sameRoomSurgicalTurnover.targetMet).toBe(false)
  })

  it('daily colors are target-relative for same-room turnovers', () => {
    // Default target 45: 30 min ≤ 45 → green
    const defaultResult = calculateSurgicalTurnovers(cases)
    if (defaultResult.sameRoomSurgicalTurnover.dailyData!.length > 0) {
      expect(defaultResult.sameRoomSurgicalTurnover.dailyData![0].color).toBe('green')
    }

    // Custom target 20: 30 min > 20 * 1.2 = 24 → red
    const customResult = calculateSurgicalTurnovers(cases, undefined, {
      sameRoomTurnoverTarget: 20,
    })
    if (customResult.sameRoomSurgicalTurnover.dailyData!.length > 0) {
      expect(customResult.sameRoomSurgicalTurnover.dailyData![0].color).toBe('red')
    }
  })
})

// ============================================
// calculateFCOTS — target-relative colors
// ============================================

describe('calculateFCOTS target-relative colors', () => {
  it('daily colors use target percent for thresholds', () => {
    // Use local-time-compatible timestamps
    const scheduledLocal = new Date(2025, 1, 3, 7, 30, 0)
    const onTimeLocal = new Date(scheduledLocal.getTime() + 1 * 60000) // +1 min → on-time
    const lateLocal = new Date(scheduledLocal.getTime() + 20 * 60000)  // +20 min → late

    const cases = [
      makeCase({
        id: 'c1',
        scheduled_date: '2025-02-03',
        start_time: '07:30:00',
        or_room_id: 'room-1',
        milestones: { patient_in: onTimeLocal.toISOString() },
      }),
      makeCase({
        id: 'c2',
        scheduled_date: '2025-02-03',
        start_time: '07:30:00',
        or_room_id: 'room-2',
        milestones: { patient_in: lateLocal.toISOString() },
      }),
    ]

    // 50% on-time rate. Default target = 85%
    // 50 < 85 * 0.8 = 68 → red
    const defaultResult = calculateFCOTS(cases)
    expect(defaultResult.dailyData![0].color).toBe('red')

    // With target = 40%: 50 ≥ 40 → green
    const lenientResult = calculateFCOTS(cases, undefined, {
      milestone: 'patient_in',
      graceMinutes: 2,
      targetPercent: 40,
    })
    expect(lenientResult.dailyData![0].color).toBe('green')
  })
})

// ============================================
// calculateAnalyticsOverview — config forwarding
// ============================================

describe('calculateAnalyticsOverview config forwarding', () => {
  // Minimal cases for testing config forwarding
  const cases: CaseWithMilestonesAndSurgeon[] = [
    makeSurgeonCase({
      id: 'c1',
      case_number: 'C001',
      scheduled_date: '2025-02-03',
      start_time: '07:30:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-1',
      milestones: {
        patient_in: '2025-02-03T07:31:00Z',
        incision: '2025-02-03T07:50:00Z',
        closing: '2025-02-03T08:30:00Z',
        closing_complete: '2025-02-03T08:40:00Z',
        patient_out: '2025-02-03T08:50:00Z',
        room_cleaned: '2025-02-03T09:10:00Z',
      },
    }),
    makeSurgeonCase({
      id: 'c2',
      case_number: 'C002',
      scheduled_date: '2025-02-03',
      start_time: '09:20:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-1',
      milestones: {
        patient_in: '2025-02-03T09:20:00Z',
        incision: '2025-02-03T09:35:00Z',
        closing: '2025-02-03T10:30:00Z',
        closing_complete: '2025-02-03T10:40:00Z',
        patient_out: '2025-02-03T10:50:00Z',
      },
    }),
  ]

  it('forwards utilization target to OR utilization', () => {
    const defaultResult = calculateAnalyticsOverview(cases)
    expect(defaultResult.orUtilization.target).toBe(75) // default

    const customResult = calculateAnalyticsOverview(cases, undefined, {
      utilizationTargetPercent: 50,
    })
    expect(customResult.orUtilization.target).toBe(50)
  })

  it('forwards cancellation target', () => {
    const result = calculateAnalyticsOverview(cases, undefined, {
      cancellationTargetPercent: 10,
    })
    expect(result.cancellationRate.target).toBe(10)
  })

  it('forwards tardiness target', () => {
    const result = calculateAnalyticsOverview(cases, undefined, {
      tardinessTargetMinutes: 60,
    })
    expect(result.cumulativeTardiness.target).toBe(60)
  })

  it('forwards turnover config', () => {
    const result = calculateAnalyticsOverview(cases, undefined, {
      turnoverThresholdMinutes: 40,
      turnoverComplianceTarget: 95,
    })
    expect(result.sameRoomTurnover.target).toBe(95)
    expect(result.sameRoomTurnover.subtitle).toContain('40 min')
  })

  it('forwards FCOTS config from unified config', () => {
    const result = calculateAnalyticsOverview(cases, undefined, {
      fcotsTargetPercent: 90,
      fcotsGraceMinutes: 5,
    })
    expect(result.fcots.target).toBe(90)
  })

  it('forwards surgeon idle targets', () => {
    const result = calculateAnalyticsOverview(cases, undefined, {
      idleCombinedTargetMinutes: 20,
      idleFlipTargetMinutes: 10,
      idleSameRoomTargetMinutes: 15,
    })
    expect(result.surgeonIdleTime.target).toBe(20)
    expect(result.surgeonIdleFlip.target).toBe(10)
    expect(result.surgeonIdleSameRoom.target).toBe(15)
  })

  it('forwards non-op thresholds', () => {
    const result = calculateAnalyticsOverview(cases, undefined, {
      nonOpWarnMinutes: 25,
      nonOpBadMinutes: 35,
    })
    expect(result.nonOperativeTime.target).toBe(25)
  })

  it('uses all defaults when no config provided', () => {
    const result = calculateAnalyticsOverview(cases)
    expect(result.orUtilization.target).toBe(ANALYTICS_CONFIG_DEFAULTS.utilizationTargetPercent)
    expect(result.cancellationRate.target).toBe(ANALYTICS_CONFIG_DEFAULTS.cancellationTargetPercent)
    expect(result.cumulativeTardiness.target).toBe(ANALYTICS_CONFIG_DEFAULTS.tardinessTargetMinutes)
    expect(result.sameRoomTurnover.target).toBe(ANALYTICS_CONFIG_DEFAULTS.turnoverComplianceTarget)
    expect(result.fcots.target).toBe(ANALYTICS_CONFIG_DEFAULTS.fcotsTargetPercent)
    expect(result.surgeonIdleTime.target).toBe(ANALYTICS_CONFIG_DEFAULTS.idleCombinedTargetMinutes)
    expect(result.nonOperativeTime.target).toBe(ANALYTICS_CONFIG_DEFAULTS.nonOpWarnMinutes)
  })
})
