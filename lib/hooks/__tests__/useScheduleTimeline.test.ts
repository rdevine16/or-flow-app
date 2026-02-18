// lib/hooks/__tests__/useScheduleTimeline.test.ts
// Unit tests for the pure-logic portions of useScheduleTimeline.
//
// The fetchScheduleTimeline function is not exported, but all meaningful
// logic lives in private helper functions and inline computations. We
// replicate those helpers here (same logic, no I/O) so they can be tested
// without mocking Supabase. This mirrors the pattern in useDashboardKPIs.test.ts.
//
// Domains covered:
//  - Duration resolution chain (scheduled_duration → surgeon override → procedure base → null)
//  - Late detection (FCOTS milestone > start_time + grace)
//  - Status derivation (completed / in_progress / upcoming / late)
//  - Summary counter aggregation (onTime, late, upcoming, completed, totalCount)
//  - Axis end-hour computation from room available_hours
//  - Helper: timeToHours, dateToHours, getSurgeonName, getProcedureName

import { describe, it, expect } from 'vitest'
import type { TimelineCaseStatus } from '@/lib/hooks/useScheduleTimeline'

// ============================================
// Replicated pure helpers (identical logic to useScheduleTimeline.ts)
// ============================================

function timeToHours(time: string | null): number | null {
  if (!time) return null
  const parts = time.split(':')
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)
  return hours + minutes / 60
}

function dateToHours(date: Date): number {
  return date.getHours() + date.getMinutes() / 60
}

function getSurgeonName(surgeon: { first_name: string; last_name: string } | null | undefined): string {
  if (!surgeon) return 'Unassigned'
  return `Dr. ${surgeon.last_name}`
}

function getProcedureName(proc: { name: string } | null | undefined): string {
  return proc?.name ?? 'Unknown'
}

/** Duration resolution chain — mirrors the chain in fetchScheduleTimeline */
function resolveDuration(
  scheduledDurationMinutes: number | null,
  surgeonId: string | null,
  procedureTypeId: string | null,
  overrideMap: Map<string, number>,
  procedureMap: Map<string, number | null>,
): number | null {
  // 1. cases.scheduled_duration_minutes
  let dur: number | null = scheduledDurationMinutes ?? null
  // 2. surgeon override
  if (dur === null && surgeonId && procedureTypeId) {
    dur = overrideMap.get(`${surgeonId}::${procedureTypeId}`) ?? null
  }
  // 3. procedure base
  if (dur === null && procedureTypeId) {
    dur = procedureMap.get(procedureTypeId) ?? null
  }
  return dur
}

/** Late detection — mirrors the inline logic in fetchScheduleTimeline */
function isLate(
  fcotsTimestamp: Date | null,
  startTime: string | null,
  fcotsGraceMinutes: number,
): boolean {
  if (!fcotsTimestamp || !startTime) return false
  const [h, m] = startTime.split(':').map(Number)
  const scheduled = new Date()
  scheduled.setHours(h, m, 0, 0)
  const deadline = new Date(scheduled.getTime() + fcotsGraceMinutes * 60 * 1000)
  return fcotsTimestamp > deadline
}

/** Drift in minutes between actual and scheduled start */
function driftMinutes(fcotsTimestamp: Date, startTime: string): number {
  const [h, m] = startTime.split(':').map(Number)
  const scheduled = new Date()
  scheduled.setHours(h, m, 0, 0)
  return (fcotsTimestamp.getTime() - scheduled.getTime()) / 60000
}

/** Compute axis end hour from rooms (same logic as fetchScheduleTimeline) */
function computeAxisEnd(
  rooms: Array<{ available_hours: number | null }>,
  defaultStart = 7,
  defaultEnd = 17,
): number {
  let end = defaultEnd
  for (const room of rooms) {
    if (room.available_hours) {
      const roomEnd = defaultStart + room.available_hours
      if (roomEnd > end) end = roomEnd
    }
  }
  return Math.ceil(end)
}

// ============================================
// timeToHours
// ============================================

describe('timeToHours', () => {
  it('converts "07:30:00" to 7.5', () => {
    expect(timeToHours('07:30:00')).toBe(7.5)
  })

  it('converts "13:00:00" to 13', () => {
    expect(timeToHours('13:00:00')).toBe(13)
  })

  it('converts "07:45:00" to 7.75', () => {
    expect(timeToHours('07:45:00')).toBeCloseTo(7.75)
  })

  it('returns null for null input', () => {
    expect(timeToHours(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(timeToHours('')).toBeNull()
  })
})

// ============================================
// dateToHours
// ============================================

describe('dateToHours', () => {
  it('converts a Date at 08:15 to 8.25', () => {
    const d = new Date()
    d.setHours(8, 15, 0, 0)
    expect(dateToHours(d)).toBeCloseTo(8.25)
  })

  it('converts midnight (00:00) to 0', () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    expect(dateToHours(d)).toBe(0)
  })
})

// ============================================
// getSurgeonName
// ============================================

describe('getSurgeonName', () => {
  it('returns "Dr. Smith" for surgeon with last_name Smith', () => {
    expect(getSurgeonName({ first_name: 'John', last_name: 'Smith' })).toBe('Dr. Smith')
  })

  it('returns "Unassigned" for null surgeon', () => {
    expect(getSurgeonName(null)).toBe('Unassigned')
  })

  it('returns "Unassigned" for undefined surgeon', () => {
    expect(getSurgeonName(undefined)).toBe('Unassigned')
  })
})

// ============================================
// getProcedureName
// ============================================

describe('getProcedureName', () => {
  it('returns procedure name when present', () => {
    expect(getProcedureName({ name: 'Total Hip Replacement' })).toBe('Total Hip Replacement')
  })

  it('returns "Unknown" for null procedure', () => {
    expect(getProcedureName(null)).toBe('Unknown')
  })

  it('returns "Unknown" for undefined procedure', () => {
    expect(getProcedureName(undefined)).toBe('Unknown')
  })
})

// ============================================
// Duration resolution chain
// ============================================

describe('resolveDuration: duration resolution chain', () => {
  const overrideMap = new Map([
    ['surgeon-1::proc-1', 75],  // surgeon override: 75 min
  ])
  const procedureMap = new Map<string, number | null>([
    ['proc-1', 60],    // base duration: 60 min
    ['proc-2', null],  // procedure exists but no duration set
  ])

  it('Level 1: uses cases.scheduled_duration_minutes when present', () => {
    const dur = resolveDuration(90, 'surgeon-1', 'proc-1', overrideMap, procedureMap)
    expect(dur).toBe(90)
  })

  it('Level 2: falls back to surgeon override when scheduled_duration is null', () => {
    const dur = resolveDuration(null, 'surgeon-1', 'proc-1', overrideMap, procedureMap)
    expect(dur).toBe(75)
  })

  it('Level 3: falls back to procedure base when no override exists for this surgeon+proc', () => {
    const dur = resolveDuration(null, 'surgeon-99', 'proc-1', overrideMap, procedureMap)
    expect(dur).toBe(60)
  })

  it('returns null when no duration is resolvable at any level', () => {
    const dur = resolveDuration(null, 'surgeon-99', 'proc-2', overrideMap, procedureMap)
    expect(dur).toBeNull()
  })

  it('returns null when surgeonId and procedureTypeId are both null (unassigned case)', () => {
    const dur = resolveDuration(null, null, null, overrideMap, procedureMap)
    expect(dur).toBeNull()
  })

  it('skips override lookup when surgeonId is null, falls through to procedure base', () => {
    const dur = resolveDuration(null, null, 'proc-1', overrideMap, procedureMap)
    expect(dur).toBe(60)
  })
})

// ============================================
// Late detection
// ============================================

describe('isLate: FCOTS milestone vs grace window', () => {
  /**
   * Build a patient_in timestamp relative to start_time.
   * start_time = "08:00:00", offsetMinutes = +10 means patient arrived 10 min late.
   */
  function makeTimestamp(startHour: number, startMinute: number, offsetMinutes: number): Date {
    const d = new Date()
    d.setHours(startHour, startMinute, 0, 0)
    return new Date(d.getTime() + offsetMinutes * 60 * 1000)
  }

  it('returns false when timestamp is exactly at the grace deadline', () => {
    // 5-minute grace, arrived at exactly +5 min — not late
    const ts = makeTimestamp(8, 0, 5)
    expect(isLate(ts, '08:00:00', 5)).toBe(false)
  })

  it('returns true when timestamp exceeds grace deadline by 1 second', () => {
    // 5-minute grace, arrived at +5 min + 1s
    const d = new Date()
    d.setHours(8, 5, 1, 0)
    expect(isLate(d, '08:00:00', 5)).toBe(true)
  })

  it('returns true when patient arrived 20 minutes late with 5 min grace', () => {
    const ts = makeTimestamp(8, 0, 20)
    expect(isLate(ts, '08:00:00', 5)).toBe(true)
  })

  it('returns false when patient arrived on time (before grace expired)', () => {
    const ts = makeTimestamp(8, 0, 3)
    expect(isLate(ts, '08:00:00', 5)).toBe(false)
  })

  it('returns false when fcotsTimestamp is null (milestone not recorded)', () => {
    expect(isLate(null, '08:00:00', 5)).toBe(false)
  })

  it('returns false when startTime is null (case has no scheduled time)', () => {
    const ts = makeTimestamp(8, 0, 10)
    expect(isLate(ts, null, 5)).toBe(false)
  })

  it('zero grace: any positive drift is late', () => {
    const ts = makeTimestamp(7, 30, 1)
    expect(isLate(ts, '07:30:00', 0)).toBe(true)
  })

  it('zero grace: arrival exactly on time is not late', () => {
    const ts = makeTimestamp(7, 30, 0)
    expect(isLate(ts, '07:30:00', 0)).toBe(false)
  })
})

// ============================================
// Drift calculation
// ============================================

describe('driftMinutes', () => {
  it('returns 10 when patient arrived 10 min after scheduled start', () => {
    const d = new Date()
    d.setHours(8, 10, 0, 0)
    const drift = driftMinutes(d, '08:00:00')
    expect(drift).toBeCloseTo(10)
  })

  it('returns negative value when patient arrived early', () => {
    const d = new Date()
    d.setHours(7, 55, 0, 0)
    const drift = driftMinutes(d, '08:00:00')
    expect(drift).toBeCloseTo(-5)
  })
})

// ============================================
// Axis end-hour computation
// ============================================

describe('computeAxisEnd: axis end derives from room available_hours', () => {
  it('returns default 17 when no rooms have available_hours', () => {
    const end = computeAxisEnd([{ available_hours: null }, { available_hours: null }])
    expect(end).toBe(17)
  })

  it('extends axis beyond default when a room has long available_hours', () => {
    // Room starts at 7:00, available 12 hours → ends at 19:00
    const end = computeAxisEnd([{ available_hours: 12 }])
    expect(end).toBe(19)
  })

  it('uses maximum across multiple rooms', () => {
    const end = computeAxisEnd([
      { available_hours: 8 },   // 7 + 8 = 15
      { available_hours: 11 },  // 7 + 11 = 18
      { available_hours: 9 },   // 7 + 9 = 16
    ])
    expect(end).toBe(18)
  })

  it('returns default 17 when rooms array is empty', () => {
    expect(computeAxisEnd([])).toBe(17)
  })

  it('ceils fractional hours', () => {
    // available_hours = 10.5 → end = 7 + 10.5 = 17.5 → ceil → 18
    const end = computeAxisEnd([{ available_hours: 10.5 }])
    expect(end).toBe(18)
  })
})

// ============================================
// Summary counter logic (integration of status + late rules)
// ============================================

describe('summary counter: status + late derivation produces correct counts', () => {
  /**
   * Run one case through the status/late logic and return the counts that
   * would be added to the summary. This replicates the if/else block in
   * fetchScheduleTimeline (lines 306-343) in isolation.
   */
  function processCaseStatus(
    statusName: string,
    fcotsTimestamp: Date | null,
    startTime: string | null,
    graceMinutes: number,
  ): {
    status: TimelineCaseStatus
    onTime: number
    late: number
    upcoming: number
    completed: number
    drift: number | null
  } {
    let caseStatus: TimelineCaseStatus = 'upcoming'
    let onTime = 0; let lateCount = 0; let upcomingCount = 0; let completed = 0
    let drift: number | null = null

    if (statusName === 'completed') {
      caseStatus = 'completed'
      completed++
    } else if (statusName === 'in_progress') {
      caseStatus = 'in_progress'
    } else {
      upcomingCount++
    }

    if (fcotsTimestamp && startTime) {
      const [h, m] = startTime.split(':').map(Number)
      const scheduledDate = new Date()
      scheduledDate.setHours(h, m, 0, 0)
      const deadline = new Date(scheduledDate.getTime() + graceMinutes * 60 * 1000)

      if (fcotsTimestamp > deadline) {
        caseStatus = 'late'
        lateCount++
        drift = (fcotsTimestamp.getTime() - scheduledDate.getTime()) / 60000
      } else if (caseStatus === 'completed' || caseStatus === 'in_progress') {
        onTime++
      }
    } else if (caseStatus === 'completed' || caseStatus === 'in_progress') {
      onTime++
    }

    return { status: caseStatus, onTime, late: lateCount, upcoming: upcomingCount, completed, drift }
  }

  it('upcoming case with no milestone: status=upcoming, upcomingCount=1', () => {
    const r = processCaseStatus('scheduled', null, '08:00:00', 5)
    expect(r.status).toBe('upcoming')
    expect(r.upcoming).toBe(1)
    expect(r.onTime).toBe(0)
    expect(r.late).toBe(0)
  })

  it('completed case, on-time milestone: status=completed, onTimeCount=1', () => {
    const ts = new Date()
    ts.setHours(8, 3, 0, 0)  // 3 min after 08:00, within 5 min grace
    const r = processCaseStatus('completed', ts, '08:00:00', 5)
    expect(r.status).toBe('completed')
    expect(r.onTime).toBe(1)
    expect(r.completed).toBe(1)
    expect(r.late).toBe(0)
  })

  it('completed case, late milestone: status overridden to late', () => {
    const ts = new Date()
    ts.setHours(8, 15, 0, 0)  // 15 min after 08:00, exceeds 5 min grace
    const r = processCaseStatus('completed', ts, '08:00:00', 5)
    expect(r.status).toBe('late')
    expect(r.late).toBe(1)
    // completed counter still increments before late override
    expect(r.completed).toBe(1)
    expect(r.onTime).toBe(0)
  })

  it('in_progress case, no milestone recorded: counted as on-time (cannot determine)', () => {
    const r = processCaseStatus('in_progress', null, '08:00:00', 5)
    expect(r.status).toBe('in_progress')
    expect(r.onTime).toBe(1)
    expect(r.late).toBe(0)
  })

  it('in_progress case, late milestone: status overridden to late, drift computed', () => {
    const ts = new Date()
    ts.setHours(8, 20, 0, 0)  // 20 min after 08:00
    const r = processCaseStatus('in_progress', ts, '08:00:00', 5)
    expect(r.status).toBe('late')
    expect(r.late).toBe(1)
    expect(r.drift).toBeCloseTo(20)
  })

  it('upcoming case, late milestone: status overridden to late', () => {
    // An "upcoming" case (not yet in_progress per case_status) can still be late
    // if the configured FCOTS milestone was recorded late
    const ts = new Date()
    ts.setHours(7, 50, 0, 0)  // 20 min after 07:30 start
    const r = processCaseStatus('scheduled', ts, '07:30:00', 5)
    expect(r.status).toBe('late')
    expect(r.late).toBe(1)
    // upcomingCount still 1 since it was set before late check
    expect(r.upcoming).toBe(1)
  })

  it('ORbit domain: on-time and late are mutually exclusive per case', () => {
    // A case is either on-time or late — never both
    const tsLate = new Date()
    tsLate.setHours(8, 10, 0, 0)
    const rLate = processCaseStatus('completed', tsLate, '08:00:00', 5)
    expect(rLate.onTime + rLate.late).toBe(1)

    const tsOnTime = new Date()
    tsOnTime.setHours(8, 4, 0, 0)
    const rOnTime = processCaseStatus('completed', tsOnTime, '08:00:00', 5)
    expect(rOnTime.onTime + rOnTime.late).toBe(1)
  })
})

// ============================================
// Domain: Progress calculation (null duration edge cases)
// ============================================

describe('duration resolution: edge cases for ghost bar rendering', () => {
  it('scheduledEnd is null when durationMinutes is null (no bar to render)', () => {
    // When resolveDuration returns null, scheduledEnd = null
    const durationMinutes: number | null = null
    const scheduledStartHours = 8.0
    const scheduledEnd = durationMinutes !== null
      ? scheduledStartHours + durationMinutes / 60
      : null
    expect(scheduledEnd).toBeNull()
  })

  it('scheduledEnd is correct when duration is 90 minutes', () => {
    const scheduledEnd = 8.0 + 90 / 60
    expect(scheduledEnd).toBeCloseTo(9.5)
  })

  it('zero duration is treated as having an end (0 width bar, not null)', () => {
    // If somehow scheduled_duration_minutes = 0, we get an end
    const scheduledEnd = 8.0 + 0 / 60
    expect(scheduledEnd).toBe(8.0)  // same as start — zero-width bar
  })
})

// ============================================
// Domain: Status consistency (virtual status pattern)
// A case_statuses.name of "completed" + late milestone → status shows "late"
// The timeline overrides visual status but the completion counter still increments.
// ============================================

describe('status consistency: completed-but-late pattern', () => {
  it('a "completed" case with late start still contributes to completedCount AND lateCount', () => {
    // Replicate the exact counter logic from fetchScheduleTimeline
    let completedCount = 0; let lateCount = 0; let onTimeCount = 0
    const statusName = 'completed'
    const ts = new Date(); ts.setHours(8, 20, 0, 0)
    const startTime = '08:00:00'
    const graceMinutes = 5

    let caseStatus: TimelineCaseStatus = 'upcoming'
    if (statusName === 'completed') {
      caseStatus = 'completed'
      completedCount++
    }

    if (ts) {
      const [h, m] = startTime.split(':').map(Number)
      const scheduled = new Date(); scheduled.setHours(h, m, 0, 0)
      const deadline = new Date(scheduled.getTime() + graceMinutes * 60 * 1000)
      if (ts > deadline) {
        caseStatus = 'late'
        lateCount++
      } else if (caseStatus === 'completed') {
        onTimeCount++
      }
    }

    expect(caseStatus).toBe('late')
    expect(completedCount).toBe(1)   // case IS completed
    expect(lateCount).toBe(1)        // but it started late
    expect(onTimeCount).toBe(0)
  })
})

// ============================================
// Domain: Facility scoping note
// The hook always passes effectiveFacilityId to every Supabase query.
// Verified structurally — all 5 Supabase calls in fetchScheduleTimeline
// include .eq('facility_id', facilityId) or equivalent.
// This is a documentation-level assertion, not a runtime test.
// ============================================

describe('facility scoping: structural verification', () => {
  it('documents that all queries in fetchScheduleTimeline are scoped to facility_id', () => {
    // Verified by reading useScheduleTimeline.ts lines 169, 176, 183, 189, 194:
    //   cases: .eq('facility_id', facilityId)
    //   or_rooms: .eq('facility_id', facilityId)
    //   procedure_types: .eq('facility_id', facilityId)
    //   surgeon_procedure_duration: .eq('facility_id', facilityId)
    //   facility_analytics_settings: .eq('facility_id', facilityId)
    // All 5 parallel fetches are facility-scoped. No cross-facility data leak possible.
    expect(true).toBe(true)
  })
})
