/**
 * Unit tests for calculateFlipRoomTurnover
 *
 * Coverage:
 * 1. Basic flip scenario — correct patient_out(predecessor) → patient_in(flip) measurement
 * 2. First case in room — no predecessor, must be skipped
 * 3. Filter: turnover >= 180 min excluded
 * 4. Filter: turnover <= 0 excluded
 * 5. Same-day only — surgeon cases on different dates do not produce flip turnovers
 * 6. No surgeon_id — cases without surgeon are excluded from surgeon timeline
 * 7. No or_room_id — cases without room are excluded from room timeline
 * 8. Missing patient_out on predecessor — no turnover measured
 * 9. Missing patient_in on flip case — no turnover measured
 * 10. Multiple flips on same day — all measured independently
 * 11. Same-room consecutive cases — NOT counted as flips
 * 12. Empty input — returns displayValue '--', no error
 * 13. Previous period delta calculation
 * 14. Compliance counting
 * 15. calculateAnalyticsOverview includes flipRoomTurnover in its return
 * 16. Median edge cases (single value, two values, odd count, even count, outlier resilience)
 */
import { describe, it, expect } from 'vitest'
import {
  calculateFlipRoomTurnover,
  calculateAnalyticsOverview,
  type CaseWithMilestones,
} from '../analyticsV2'

// ============================================
// HELPERS
// ============================================

let caseIdCounter = 0

function makeCase(
  overrides: Partial<CaseWithMilestones> & { milestones?: Record<string, string> }
): CaseWithMilestones {
  caseIdCounter++
  const { milestones, ...rest } = overrides
  const caseMilestones = milestones
    ? Object.entries(milestones).map(([name, recorded_at]) => ({
        facility_milestone_id: `fm_${name}_${caseIdCounter}`,
        recorded_at,
        facility_milestones: { name },
      }))
    : []

  return {
    id: `case-${caseIdCounter}`,
    case_number: `C${String(caseIdCounter).padStart(3, '0')}`,
    facility_id: 'fac-1',
    scheduled_date: '2025-02-03',
    start_time: '07:30:00',
    surgeon_id: 'surg-1',
    or_room_id: 'room-1',
    status_id: 'status-completed',
    surgeon: { first_name: 'Alice', last_name: 'Chen' },
    or_rooms: { id: 'room-1', name: 'OR-1' },
    case_statuses: { name: 'completed' },
    procedure_types: null,
    case_milestones: caseMilestones,
    ...rest,
  }
}

/**
 * Build a minimal valid flip scenario:
 *
 * Room A:  caseA (surgeon surg-1), patient_out at T+0
 * Room B:  caseB_pred (unrelated surgeon), patient_out at T+20min
 * Room B:  caseB_flip (surgeon surg-1, flip from Room A), patient_in at T+40min
 *
 * Surgeon surg-1 consecutive: caseA (Room A) → caseB_flip (Room B) — that's a flip.
 * Room B timeline: [caseB_pred, caseB_flip]
 * Predecessor in Room B before caseB_flip = caseB_pred
 * Turnover = patient_out(caseB_pred T+20) → patient_in(caseB_flip T+40) = 20 min
 */
function buildBasicFlipScenario(date = '2025-02-03'): CaseWithMilestones[] {
  // Case A: surgeon surg-1 in Room A, incision 07:30, patient_out 09:00
  const caseA = makeCase({
    id: 'caseA',
    case_number: 'CA001',
    scheduled_date: date,
    start_time: '07:00:00',
    surgeon_id: 'surg-1',
    or_room_id: 'room-A',
    or_rooms: { id: 'room-A', name: 'OR-A' },
    milestones: {
      patient_in:  `${date}T07:00:00.000Z`,
      incision:    `${date}T07:30:00.000Z`,
      patient_out: `${date}T09:00:00.000Z`,
    },
  })

  // Case B_pred: different surgeon in Room B, patient_out 09:20
  const caseBPred = makeCase({
    id: 'caseBPred',
    case_number: 'CB001',
    scheduled_date: date,
    start_time: '07:05:00',
    surgeon_id: 'surg-2',
    or_room_id: 'room-B',
    or_rooms: { id: 'room-B', name: 'OR-B' },
    surgeon: { first_name: 'Bob', last_name: 'Davis' },
    milestones: {
      patient_in:  `${date}T07:05:00.000Z`,
      incision:    `${date}T07:35:00.000Z`,
      patient_out: `${date}T09:20:00.000Z`,
    },
  })

  // Case B_flip: surgeon surg-1 flips to Room B, incision 09:50, patient_in 09:40
  const caseBFlip = makeCase({
    id: 'caseBFlip',
    case_number: 'CB002',
    scheduled_date: date,
    start_time: '09:30:00',
    surgeon_id: 'surg-1',
    or_room_id: 'room-B',
    or_rooms: { id: 'room-B', name: 'OR-B' },
    milestones: {
      patient_in:  `${date}T09:40:00.000Z`,
      incision:    `${date}T09:50:00.000Z`,
      patient_out: `${date}T11:00:00.000Z`,
    },
  })

  return [caseA, caseBPred, caseBFlip]
}

// ============================================
// 1. BASIC FLIP SCENARIO
// ============================================

describe('calculateFlipRoomTurnover — basic flip', () => {
  it('measures patient_out(predecessor) → patient_in(flip case) correctly', () => {
    const cases = buildBasicFlipScenario()
    const result = calculateFlipRoomTurnover(cases)

    // caseBPred patient_out = 09:20, caseBFlip patient_in = 09:40 → 20 min
    expect(result.value).toBe(20)
    expect(result.displayValue).toBe('20 min')
  })

  it('includes a TurnoverDetail entry with correct room and case numbers', () => {
    const cases = buildBasicFlipScenario()
    const result = calculateFlipRoomTurnover(cases)

    expect(result.details).toHaveLength(1)
    const detail = result.details[0]
    expect(detail.roomName).toBe('OR-B')
    expect(detail.fromCaseNumber).toBe('CB001')
    expect(detail.toCaseNumber).toBe('CB002')
    expect(detail.turnoverMinutes).toBe(20)
  })

  it('sets subtitle using compliance data when turnovers exist', () => {
    const cases = buildBasicFlipScenario()
    const result = calculateFlipRoomTurnover(cases)

    // default threshold is 30 min; 20 < 30 → compliant
    expect(result.subtitle).toContain('30 min')
    expect(result.compliantCount).toBe(1)
    expect(result.nonCompliantCount).toBe(0)
    expect(result.complianceRate).toBe(100)
  })
})

// ============================================
// 2. FIRST CASE IN ROOM — NO PREDECESSOR
// ============================================

describe('calculateFlipRoomTurnover — first case in destination room', () => {
  it('skips the flip when the flip case is the first in the destination room (flipCaseIndex === 0)', () => {
    // Surgeon flips from Room A to Room B, but Room B has only the flip case — no predecessor
    const caseA = makeCase({
      id: 'solo-A',
      scheduled_date: '2025-02-05',
      start_time: '07:00:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-A',
      or_rooms: { id: 'room-A', name: 'OR-A' },
      milestones: {
        patient_in:  '2025-02-05T07:00:00.000Z',
        incision:    '2025-02-05T07:30:00.000Z',
        patient_out: '2025-02-05T09:00:00.000Z',
      },
    })
    const caseB = makeCase({
      id: 'solo-B',
      scheduled_date: '2025-02-05',
      start_time: '09:30:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-B',
      or_rooms: { id: 'room-B', name: 'OR-B' },
      milestones: {
        patient_in:  '2025-02-05T09:40:00.000Z',
        incision:    '2025-02-05T09:50:00.000Z',
        patient_out: '2025-02-05T11:00:00.000Z',
      },
    })

    const result = calculateFlipRoomTurnover([caseA, caseB])

    expect(result.value).toBe(0)
    expect(result.displayValue).toBe('--')
    expect(result.details).toHaveLength(0)
    expect(result.subtitle).toBe('No flip-room turnovers')
  })
})

// ============================================
// 3 & 4. THRESHOLD FILTERS
// ============================================

describe('calculateFlipRoomTurnover — out-of-range filtering', () => {
  it('excludes turnovers >= 180 minutes', () => {
    const date = '2025-02-06'
    // predecessor patient_out 08:00, flip patient_in 11:01 → 181 min → excluded
    const caseA = makeCase({
      id: 'filt-A',
      scheduled_date: date,
      start_time: '07:00:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-A',
      or_rooms: { id: 'room-A', name: 'OR-A' },
      milestones: {
        patient_in:  `${date}T07:00:00.000Z`,
        incision:    `${date}T07:30:00.000Z`,
        patient_out: `${date}T09:00:00.000Z`,
      },
    })
    const caseBPred = makeCase({
      id: 'filt-Bpred',
      scheduled_date: date,
      start_time: '07:05:00',
      surgeon_id: 'surg-2',
      or_room_id: 'room-B',
      or_rooms: { id: 'room-B', name: 'OR-B' },
      milestones: {
        patient_in:  `${date}T07:05:00.000Z`,
        incision:    `${date}T07:35:00.000Z`,
        patient_out: `${date}T08:00:00.000Z`,  // patient_out 08:00
      },
    })
    const caseBFlip = makeCase({
      id: 'filt-Bflip',
      scheduled_date: date,
      start_time: '11:00:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-B',
      or_rooms: { id: 'room-B', name: 'OR-B' },
      milestones: {
        patient_in:  `${date}T11:01:00.000Z`,  // 181 min after 08:00
        incision:    `${date}T11:15:00.000Z`,
        patient_out: `${date}T13:00:00.000Z`,
      },
    })

    const result = calculateFlipRoomTurnover([caseA, caseBPred, caseBFlip])
    expect(result.value).toBe(0)
    expect(result.displayValue).toBe('--')
    expect(result.details).toHaveLength(0)
  })

  it('excludes turnovers exactly at 180 minutes (boundary — >= 180 excluded)', () => {
    const date = '2025-02-07'
    const caseA = makeCase({
      id: 'bound-A',
      scheduled_date: date,
      start_time: '07:00:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-A',
      or_rooms: { id: 'room-A', name: 'OR-A' },
      milestones: {
        patient_in:  `${date}T07:00:00.000Z`,
        incision:    `${date}T07:30:00.000Z`,
        patient_out: `${date}T09:00:00.000Z`,
      },
    })
    const caseBPred = makeCase({
      id: 'bound-Bpred',
      scheduled_date: date,
      start_time: '07:05:00',
      surgeon_id: 'surg-2',
      or_room_id: 'room-B',
      or_rooms: { id: 'room-B', name: 'OR-B' },
      milestones: {
        patient_in:  `${date}T07:05:00.000Z`,
        incision:    `${date}T07:35:00.000Z`,
        patient_out: `${date}T08:00:00.000Z`,
      },
    })
    const caseBFlip = makeCase({
      id: 'bound-Bflip',
      scheduled_date: date,
      start_time: '11:00:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-B',
      or_rooms: { id: 'room-B', name: 'OR-B' },
      milestones: {
        patient_in:  `${date}T11:00:00.000Z`,  // exactly 180 min after 08:00
        incision:    `${date}T11:15:00.000Z`,
        patient_out: `${date}T13:00:00.000Z`,
      },
    })

    const result = calculateFlipRoomTurnover([caseA, caseBPred, caseBFlip])
    expect(result.displayValue).toBe('--')
  })

  it('excludes turnovers <= 0 (negative or zero)', () => {
    const date = '2025-02-08'
    // predecessor patient_out AFTER flip patient_in → negative → excluded
    const caseA = makeCase({
      id: 'neg-A',
      scheduled_date: date,
      start_time: '07:00:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-A',
      or_rooms: { id: 'room-A', name: 'OR-A' },
      milestones: {
        patient_in:  `${date}T07:00:00.000Z`,
        incision:    `${date}T07:30:00.000Z`,
        patient_out: `${date}T09:00:00.000Z`,
      },
    })
    const caseBPred = makeCase({
      id: 'neg-Bpred',
      scheduled_date: date,
      start_time: '07:05:00',
      surgeon_id: 'surg-2',
      or_room_id: 'room-B',
      or_rooms: { id: 'room-B', name: 'OR-B' },
      milestones: {
        patient_in:  `${date}T07:05:00.000Z`,
        incision:    `${date}T07:35:00.000Z`,
        patient_out: `${date}T10:00:00.000Z`,  // patient_out 10:00
      },
    })
    const caseBFlip = makeCase({
      id: 'neg-Bflip',
      scheduled_date: date,
      start_time: '09:30:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-B',
      or_rooms: { id: 'room-B', name: 'OR-B' },
      milestones: {
        patient_in:  `${date}T09:30:00.000Z`,  // patient_in 09:30 — 30 min BEFORE predecessor patient_out
        incision:    `${date}T09:50:00.000Z`,
        patient_out: `${date}T11:00:00.000Z`,
      },
    })

    const result = calculateFlipRoomTurnover([caseA, caseBPred, caseBFlip])
    expect(result.displayValue).toBe('--')
    expect(result.details).toHaveLength(0)
  })
})

// ============================================
// 5. SAME-DAY ONLY
// ============================================

describe('calculateFlipRoomTurnover — same-day only', () => {
  it('does not produce a flip turnover when surgeon cases are on different dates', () => {
    // Day 1: surgeon in Room A
    const caseDay1 = makeCase({
      id: 'day1-A',
      scheduled_date: '2025-02-10',
      start_time: '07:00:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-A',
      or_rooms: { id: 'room-A', name: 'OR-A' },
      milestones: {
        patient_in:  '2025-02-10T07:00:00.000Z',
        incision:    '2025-02-10T07:30:00.000Z',
        patient_out: '2025-02-10T09:00:00.000Z',
      },
    })
    // Day 2: surgeon in Room B (different date → different surgeon timeline key)
    const caseDay2 = makeCase({
      id: 'day2-B',
      scheduled_date: '2025-02-11',
      start_time: '07:00:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-B',
      or_rooms: { id: 'room-B', name: 'OR-B' },
      milestones: {
        patient_in:  '2025-02-11T07:40:00.000Z',
        incision:    '2025-02-11T07:50:00.000Z',
        patient_out: '2025-02-11T09:00:00.000Z',
      },
    })

    const result = calculateFlipRoomTurnover([caseDay1, caseDay2])
    expect(result.displayValue).toBe('--')
    expect(result.details).toHaveLength(0)
  })
})

// ============================================
// 6. NO SURGEON_ID
// ============================================

describe('calculateFlipRoomTurnover — no surgeon_id', () => {
  it('skips cases with null surgeon_id when building surgeon timeline', () => {
    // No surgeon_id on any case — surgeon timeline will be empty, no flips detected
    const caseA = makeCase({
      id: 'noSurg-A',
      scheduled_date: '2025-02-12',
      surgeon_id: null,
      or_room_id: 'room-A',
      milestones: {
        patient_in:  '2025-02-12T07:00:00.000Z',
        incision:    '2025-02-12T07:30:00.000Z',
        patient_out: '2025-02-12T09:00:00.000Z',
      },
    })
    const caseB = makeCase({
      id: 'noSurg-B',
      scheduled_date: '2025-02-12',
      surgeon_id: null,
      or_room_id: 'room-B',
      milestones: {
        patient_in:  '2025-02-12T09:30:00.000Z',
        incision:    '2025-02-12T09:50:00.000Z',
        patient_out: '2025-02-12T11:00:00.000Z',
      },
    })

    const result = calculateFlipRoomTurnover([caseA, caseB])
    expect(result.displayValue).toBe('--')
    expect(result.details).toHaveLength(0)
  })
})

// ============================================
// 7. NO OR_ROOM_ID
// ============================================

describe('calculateFlipRoomTurnover — no or_room_id', () => {
  it('skips cases with null or_room_id in room timeline and surgeon timeline flip detection', () => {
    // Surgeon has two cases but both lack room — no flip detected
    const caseA = makeCase({
      id: 'noRoom-A',
      scheduled_date: '2025-02-13',
      surgeon_id: 'surg-1',
      or_room_id: null,
      or_rooms: null,
      milestones: {
        patient_in:  '2025-02-13T07:00:00.000Z',
        incision:    '2025-02-13T07:30:00.000Z',
        patient_out: '2025-02-13T09:00:00.000Z',
      },
    })
    const caseB = makeCase({
      id: 'noRoom-B',
      scheduled_date: '2025-02-13',
      surgeon_id: 'surg-1',
      or_room_id: null,
      or_rooms: null,
      milestones: {
        patient_in:  '2025-02-13T09:30:00.000Z',
        incision:    '2025-02-13T09:50:00.000Z',
        patient_out: '2025-02-13T11:00:00.000Z',
      },
    })

    const result = calculateFlipRoomTurnover([caseA, caseB])
    expect(result.displayValue).toBe('--')
    expect(result.details).toHaveLength(0)
  })
})

// ============================================
// 8 & 9. MISSING MILESTONES
// ============================================

describe('calculateFlipRoomTurnover — missing milestones', () => {
  it('skips when predecessor has no patient_out milestone', () => {
    const date = '2025-02-14'
    const caseA = makeCase({
      id: 'miss-A',
      scheduled_date: date,
      start_time: '07:00:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-A',
      or_rooms: { id: 'room-A', name: 'OR-A' },
      milestones: {
        patient_in: `${date}T07:00:00.000Z`,
        incision:   `${date}T07:30:00.000Z`,
        // no patient_out
      },
    })
    const caseBPred = makeCase({
      id: 'miss-Bpred',
      scheduled_date: date,
      start_time: '07:05:00',
      surgeon_id: 'surg-2',
      or_room_id: 'room-B',
      or_rooms: { id: 'room-B', name: 'OR-B' },
      milestones: {
        patient_in: `${date}T07:05:00.000Z`,
        incision:   `${date}T07:35:00.000Z`,
        // no patient_out on predecessor
      },
    })
    const caseBFlip = makeCase({
      id: 'miss-Bflip',
      scheduled_date: date,
      start_time: '09:30:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-B',
      or_rooms: { id: 'room-B', name: 'OR-B' },
      milestones: {
        patient_in: `${date}T09:40:00.000Z`,
        incision:   `${date}T09:50:00.000Z`,
      },
    })

    const result = calculateFlipRoomTurnover([caseA, caseBPred, caseBFlip])
    expect(result.displayValue).toBe('--')
    expect(result.details).toHaveLength(0)
  })

  it('skips when flip case has no patient_in milestone', () => {
    const date = '2025-02-15'
    const caseA = makeCase({
      id: 'missPI-A',
      scheduled_date: date,
      start_time: '07:00:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-A',
      or_rooms: { id: 'room-A', name: 'OR-A' },
      milestones: {
        patient_in:  `${date}T07:00:00.000Z`,
        incision:    `${date}T07:30:00.000Z`,
        patient_out: `${date}T09:00:00.000Z`,
      },
    })
    const caseBPred = makeCase({
      id: 'missPI-Bpred',
      scheduled_date: date,
      start_time: '07:05:00',
      surgeon_id: 'surg-2',
      or_room_id: 'room-B',
      or_rooms: { id: 'room-B', name: 'OR-B' },
      milestones: {
        patient_in:  `${date}T07:05:00.000Z`,
        incision:    `${date}T07:35:00.000Z`,
        patient_out: `${date}T09:20:00.000Z`,
      },
    })
    const caseBFlip = makeCase({
      id: 'missPI-Bflip',
      scheduled_date: date,
      start_time: '09:30:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-B',
      or_rooms: { id: 'room-B', name: 'OR-B' },
      milestones: {
        // no patient_in on flip case
        incision:    `${date}T09:50:00.000Z`,
        patient_out: `${date}T11:00:00.000Z`,
      },
    })

    const result = calculateFlipRoomTurnover([caseA, caseBPred, caseBFlip])
    expect(result.displayValue).toBe('--')
    expect(result.details).toHaveLength(0)
  })
})

// ============================================
// 10. MULTIPLE FLIPS SAME DAY
// ============================================

describe('calculateFlipRoomTurnover — multiple flips same day', () => {
  it('measures all valid flip turnovers independently', () => {
    const date = '2025-02-16'
    // Surgeon does: Room A → Room B → Room A (two flips)
    // Flip 1: Room B predecessor patient_out at T+20min, flip patient_in at T+40min → 20 min
    // Flip 2: Room A predecessor patient_out at T+60min, flip2 patient_in at T+70min → 10 min

    const caseA1 = makeCase({
      id: 'multi-A1',
      scheduled_date: date,
      start_time: '07:00:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-A',
      or_rooms: { id: 'room-A', name: 'OR-A' },
      milestones: {
        patient_in:  `${date}T07:00:00.000Z`,
        incision:    `${date}T07:30:00.000Z`,
        patient_out: `${date}T09:00:00.000Z`,
      },
    })
    // Predecessor for first flip (into Room B)
    const caseBPred = makeCase({
      id: 'multi-Bpred',
      scheduled_date: date,
      start_time: '07:05:00',
      surgeon_id: 'surg-2',
      or_room_id: 'room-B',
      or_rooms: { id: 'room-B', name: 'OR-B' },
      surgeon: { first_name: 'Bob', last_name: 'Davis' },
      milestones: {
        patient_in:  `${date}T07:05:00.000Z`,
        incision:    `${date}T07:35:00.000Z`,
        patient_out: `${date}T09:20:00.000Z`,  // 09:20
      },
    })
    // First flip case (Room A → Room B), patient_in 09:40 → 20 min turnover
    const caseBFlip = makeCase({
      id: 'multi-Bflip',
      scheduled_date: date,
      start_time: '09:30:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-B',
      or_rooms: { id: 'room-B', name: 'OR-B' },
      milestones: {
        patient_in:  `${date}T09:40:00.000Z`,
        incision:    `${date}T09:50:00.000Z`,
        patient_out: `${date}T11:00:00.000Z`,
      },
    })
    // Predecessor for second flip (into Room A)
    const caseA2 = makeCase({
      id: 'multi-A2',
      scheduled_date: date,
      start_time: '09:05:00',
      surgeon_id: 'surg-3',
      or_room_id: 'room-A',
      or_rooms: { id: 'room-A', name: 'OR-A' },
      surgeon: { first_name: 'Carol', last_name: 'Wang' },
      milestones: {
        patient_in:  `${date}T09:05:00.000Z`,
        incision:    `${date}T09:35:00.000Z`,
        patient_out: `${date}T10:50:00.000Z`,  // 10:50
      },
    })
    // Second flip (Room B → Room A), patient_in 11:00 → 10 min turnover
    const caseAFlip2 = makeCase({
      id: 'multi-Aflip2',
      scheduled_date: date,
      start_time: '11:00:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-A',
      or_rooms: { id: 'room-A', name: 'OR-A' },
      milestones: {
        patient_in:  `${date}T11:00:00.000Z`,
        incision:    `${date}T11:15:00.000Z`,
        patient_out: `${date}T12:30:00.000Z`,
      },
    })

    const result = calculateFlipRoomTurnover([caseA1, caseBPred, caseBFlip, caseA2, caseAFlip2])
    expect(result.details).toHaveLength(2)

    const turnoverMinutes = result.details.map(d => d.turnoverMinutes).sort((a, b) => a - b)
    expect(turnoverMinutes).toEqual([10, 20])

    // Median of [10, 20] = 15
    expect(result.value).toBe(15)
  })
})

// ============================================
// 11. SAME-ROOM CONSECUTIVE — NOT A FLIP
// ============================================

describe('calculateFlipRoomTurnover — same-room consecutive not counted', () => {
  it('does not count same-room consecutive cases as flips', () => {
    const date = '2025-02-17'
    // Surgeon does two consecutive cases in the same Room A — not a flip
    const caseA1 = makeCase({
      id: 'sameRoom-A1',
      scheduled_date: date,
      start_time: '07:00:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-A',
      or_rooms: { id: 'room-A', name: 'OR-A' },
      milestones: {
        patient_in:  `${date}T07:00:00.000Z`,
        incision:    `${date}T07:30:00.000Z`,
        patient_out: `${date}T09:00:00.000Z`,
      },
    })
    const caseA2 = makeCase({
      id: 'sameRoom-A2',
      scheduled_date: date,
      start_time: '09:30:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-A',
      or_rooms: { id: 'room-A', name: 'OR-A' },
      milestones: {
        patient_in:  `${date}T09:30:00.000Z`,
        incision:    `${date}T09:50:00.000Z`,
        patient_out: `${date}T11:00:00.000Z`,
      },
    })

    const result = calculateFlipRoomTurnover([caseA1, caseA2])
    expect(result.displayValue).toBe('--')
    expect(result.details).toHaveLength(0)
  })
})

// ============================================
// 12. EMPTY INPUT
// ============================================

describe('calculateFlipRoomTurnover — empty input', () => {
  it('returns safe defaults with no data', () => {
    const result = calculateFlipRoomTurnover([])

    expect(result.value).toBe(0)
    expect(result.displayValue).toBe('--')
    expect(result.subtitle).toBe('No flip-room turnovers')
    expect(result.details).toHaveLength(0)
    expect(result.compliantCount).toBe(0)
    expect(result.nonCompliantCount).toBe(0)
    expect(result.complianceRate).toBe(0)
    expect(result.dailyData).toEqual([])
  })

  it('does not throw when called with empty array', () => {
    expect(() => calculateFlipRoomTurnover([])).not.toThrow()
  })
})

// ============================================
// 13. PREVIOUS PERIOD DELTA
// ============================================

describe('calculateFlipRoomTurnover — previous period delta', () => {
  it('computes a negative delta when current period is better (lower) than previous', () => {
    const currentCases = buildBasicFlipScenario('2025-02-03')    // 20 min turnover
    // Build a previous period scenario with a longer turnover (40 min)
    const prevDate = '2025-01-27'
    const prevCaseA = makeCase({
      id: 'prev-A',
      scheduled_date: prevDate,
      start_time: '07:00:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-A',
      or_rooms: { id: 'room-A', name: 'OR-A' },
      milestones: {
        patient_in:  `${prevDate}T07:00:00.000Z`,
        incision:    `${prevDate}T07:30:00.000Z`,
        patient_out: `${prevDate}T09:00:00.000Z`,
      },
    })
    const prevBPred = makeCase({
      id: 'prev-Bpred',
      scheduled_date: prevDate,
      start_time: '07:05:00',
      surgeon_id: 'surg-2',
      or_room_id: 'room-B',
      or_rooms: { id: 'room-B', name: 'OR-B' },
      surgeon: { first_name: 'Bob', last_name: 'Davis' },
      milestones: {
        patient_in:  `${prevDate}T07:05:00.000Z`,
        incision:    `${prevDate}T07:35:00.000Z`,
        patient_out: `${prevDate}T09:00:00.000Z`,  // patient_out 09:00
      },
    })
    const prevBFlip = makeCase({
      id: 'prev-Bflip',
      scheduled_date: prevDate,
      start_time: '09:30:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-B',
      or_rooms: { id: 'room-B', name: 'OR-B' },
      milestones: {
        patient_in:  `${prevDate}T09:40:00.000Z`,  // 40 min after 09:00
        incision:    `${prevDate}T09:50:00.000Z`,
        patient_out: `${prevDate}T11:00:00.000Z`,
      },
    })

    const result = calculateFlipRoomTurnover(
      currentCases,
      [prevCaseA, prevBPred, prevBFlip]
    )

    // current = 20 min, previous = 40 min → lower is better
    // calculateDelta computes: rawDelta = ((20-40)/40)*100 = -50, delta = Math.abs(-50) = 50
    // lowerIsBetter=true + rawDelta < 0 → deltaType = 'increase' (improvement direction)
    expect(result.delta).toBeDefined()
    expect(result.delta).toBe(50)
    expect(result.deltaType).toBe('increase') // 'increase' = improvement when lowerIsBetter
  })

  it('returns undefined delta when no previous period provided', () => {
    const cases = buildBasicFlipScenario()
    const result = calculateFlipRoomTurnover(cases, undefined)
    expect(result.delta).toBeUndefined()
  })

  it('returns undefined delta when previous period is empty', () => {
    const cases = buildBasicFlipScenario()
    const result = calculateFlipRoomTurnover(cases, [])
    expect(result.delta).toBeUndefined()
  })
})

// ============================================
// 14. COMPLIANCE COUNTING
// ============================================

describe('calculateFlipRoomTurnover — compliance counting', () => {
  it('counts compliant vs non-compliant against the configured threshold', () => {
    // Two flips: 20 min (compliant at 25 threshold) and 35 min (non-compliant)
    const date = '2025-02-18'

    // Flip 1: 20 min turnover
    const caseA1 = makeCase({
      id: 'comp-A1',
      scheduled_date: date,
      start_time: '07:00:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-A',
      or_rooms: { id: 'room-A', name: 'OR-A' },
      milestones: {
        patient_in:  `${date}T07:00:00.000Z`,
        incision:    `${date}T07:30:00.000Z`,
        patient_out: `${date}T09:00:00.000Z`,
      },
    })
    const caseBPred1 = makeCase({
      id: 'comp-Bpred1',
      scheduled_date: date,
      start_time: '07:05:00',
      surgeon_id: 'surg-2',
      or_room_id: 'room-B',
      or_rooms: { id: 'room-B', name: 'OR-B' },
      surgeon: { first_name: 'Bob', last_name: 'Davis' },
      milestones: {
        patient_in:  `${date}T07:05:00.000Z`,
        incision:    `${date}T07:35:00.000Z`,
        patient_out: `${date}T09:20:00.000Z`,  // 09:20
      },
    })
    const caseBFlip1 = makeCase({
      id: 'comp-Bflip1',
      scheduled_date: date,
      start_time: '09:30:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-B',
      or_rooms: { id: 'room-B', name: 'OR-B' },
      milestones: {
        patient_in:  `${date}T09:40:00.000Z`,  // 20 min after 09:20
        incision:    `${date}T09:50:00.000Z`,
        patient_out: `${date}T11:00:00.000Z`,
      },
    })

    // Flip 2: 35 min turnover (surgeon returns to Room A from Room B)
    const caseAPred2 = makeCase({
      id: 'comp-Apred2',
      scheduled_date: date,
      start_time: '09:05:00',
      surgeon_id: 'surg-3',
      or_room_id: 'room-A',
      or_rooms: { id: 'room-A', name: 'OR-A' },
      surgeon: { first_name: 'Carol', last_name: 'Wang' },
      milestones: {
        patient_in:  `${date}T09:05:00.000Z`,
        incision:    `${date}T09:35:00.000Z`,
        patient_out: `${date}T10:25:00.000Z`,  // 10:25
      },
    })
    const caseAFlip2 = makeCase({
      id: 'comp-Aflip2',
      scheduled_date: date,
      start_time: '11:00:00',
      surgeon_id: 'surg-1',
      or_room_id: 'room-A',
      or_rooms: { id: 'room-A', name: 'OR-A' },
      milestones: {
        patient_in:  `${date}T11:00:00.000Z`,  // 35 min after 10:25
        incision:    `${date}T11:15:00.000Z`,
        patient_out: `${date}T12:30:00.000Z`,
      },
    })

    const result = calculateFlipRoomTurnover(
      [caseA1, caseBPred1, caseBFlip1, caseAPred2, caseAFlip2],
      undefined,
      { turnoverThresholdMinutes: 25, turnoverComplianceTarget: 80 }
    )

    expect(result.details).toHaveLength(2)
    expect(result.compliantCount).toBe(1)    // 20 min <= 25 threshold
    expect(result.nonCompliantCount).toBe(1) // 35 min > 25 threshold
    expect(result.complianceRate).toBe(50)
    expect(result.targetMet).toBe(false)     // 50% < 80% target
  })

  it('uses custom config threshold and compliance target', () => {
    const cases = buildBasicFlipScenario() // 20 min turnover
    const result = calculateFlipRoomTurnover(cases, undefined, {
      turnoverThresholdMinutes: 15,  // 20 > 15 → non-compliant
      turnoverComplianceTarget: 90,
    })

    expect(result.compliantCount).toBe(0)
    expect(result.nonCompliantCount).toBe(1)
    expect(result.complianceRate).toBe(0)
    expect(result.targetMet).toBe(false)
    expect(result.subtitle).toContain('15 min') // uses custom threshold in subtitle
  })
})

// ============================================
// 15. calculateAnalyticsOverview INCLUDES flipRoomTurnover
// ============================================

describe('calculateAnalyticsOverview — includes flipRoomTurnover', () => {
  it('returns a flipRoomTurnover field in the overview object', () => {
    const cases = buildBasicFlipScenario()
    const overview = calculateAnalyticsOverview(cases)

    expect(overview).toHaveProperty('flipRoomTurnover')
    expect(overview.flipRoomTurnover).toBeDefined()
    expect(typeof overview.flipRoomTurnover.value).toBe('number')
    expect(typeof overview.flipRoomTurnover.displayValue).toBe('string')
    expect(Array.isArray(overview.flipRoomTurnover.details)).toBe(true)
  })

  it('flipRoomTurnover is populated when flip cases exist in the input', () => {
    const cases = buildBasicFlipScenario()
    const overview = calculateAnalyticsOverview(cases)

    // The basic flip scenario produces a 20-min turnover
    expect(overview.flipRoomTurnover.value).toBe(20)
    expect(overview.flipRoomTurnover.displayValue).toBe('20 min')
  })

  it('flipRoomTurnover shows no-data state when no flips exist', () => {
    // Single case — no surgeon timeline transitions
    const singleCase = makeCase({
      id: 'over-solo',
      scheduled_date: '2025-02-20',
      surgeon_id: 'surg-1',
      or_room_id: 'room-A',
      milestones: {
        patient_in:  '2025-02-20T07:00:00.000Z',
        incision:    '2025-02-20T07:30:00.000Z',
        patient_out: '2025-02-20T09:00:00.000Z',
      },
    })
    const overview = calculateAnalyticsOverview([singleCase])

    expect(overview.flipRoomTurnover.displayValue).toBe('--')
    expect(overview.flipRoomTurnover.subtitle).toBe('No flip-room turnovers')
  })

  it('other turnover metrics (sameRoomTurnover) are unaffected by the new field', () => {
    const cases = buildBasicFlipScenario()
    const overview = calculateAnalyticsOverview(cases)

    // sameRoomTurnover should still exist and be a valid KPI result
    expect(overview).toHaveProperty('sameRoomTurnover')
    expect(overview.sameRoomTurnover).toBeDefined()
    expect(typeof overview.sameRoomTurnover.displayValue).toBe('string')
  })
})

// ============================================
// 16. MEDIAN EDGE CASES (ORbit domain pattern)
// ============================================

describe('calculateFlipRoomTurnover — median edge cases', () => {
  /**
   * Build N identical flip scenarios across N different dates, each producing
   * a specified turnover value. Used to set up median calculations.
   *
   * Returns an array of cases where each date produces one flip turnover.
   */
  function buildFlipScenariosWithValues(turnovers: number[]): CaseWithMilestones[] {
    const allCases: CaseWithMilestones[] = []
    turnovers.forEach((t, i) => {
      const date = `2025-03-${String(i + 1).padStart(2, '0')}`
      // Predecessor patient_out at 09:00, flip patient_in at 09:00 + t minutes
      const predOut = new Date(`${date}T09:00:00.000Z`)
      const flipIn = new Date(predOut.getTime() + t * 60 * 1000)
      const flipInISO = flipIn.toISOString()

      const cA = makeCase({
        id: `med-A-${i}`,
        scheduled_date: date,
        start_time: '07:00:00',
        surgeon_id: 'surg-1',
        or_room_id: 'room-A',
        or_rooms: { id: 'room-A', name: 'OR-A' },
        milestones: {
          patient_in:  `${date}T07:00:00.000Z`,
          incision:    `${date}T07:30:00.000Z`,
          patient_out: `${date}T09:00:00.000Z`,
        },
      })
      const cBPred = makeCase({
        id: `med-Bpred-${i}`,
        scheduled_date: date,
        start_time: '07:05:00',
        surgeon_id: 'surg-2',
        or_room_id: 'room-B',
        or_rooms: { id: 'room-B', name: 'OR-B' },
        surgeon: { first_name: 'Bob', last_name: 'Davis' },
        milestones: {
          patient_in:  `${date}T07:05:00.000Z`,
          incision:    `${date}T07:35:00.000Z`,
          patient_out: `${date}T09:00:00.000Z`,  // 09:00
        },
      })
      const cBFlip = makeCase({
        id: `med-Bflip-${i}`,
        scheduled_date: date,
        start_time: '09:10:00',
        surgeon_id: 'surg-1',
        or_room_id: 'room-B',
        or_rooms: { id: 'room-B', name: 'OR-B' },
        milestones: {
          patient_in:  flipInISO,
          incision:    flipInISO,
          patient_out: `${date}T11:00:00.000Z`,
        },
      })

      allCases.push(cA, cBPred, cBFlip)
    })
    return allCases
  }

  it('single value: median equals that value', () => {
    const cases = buildFlipScenariosWithValues([25])
    const result = calculateFlipRoomTurnover(cases)
    expect(result.value).toBe(25)
  })

  it('two values: median equals average of both', () => {
    const cases = buildFlipScenariosWithValues([20, 40])
    const result = calculateFlipRoomTurnover(cases)
    // median([20, 40]) = 30
    expect(result.value).toBe(30)
  })

  it('odd count (3 values): median equals middle value', () => {
    const cases = buildFlipScenariosWithValues([10, 25, 40])
    const result = calculateFlipRoomTurnover(cases)
    // sorted: [10, 25, 40] → median = 25
    expect(result.value).toBe(25)
  })

  it('even count (4 values): median equals average of two middle values', () => {
    const cases = buildFlipScenariosWithValues([10, 20, 30, 40])
    const result = calculateFlipRoomTurnover(cases)
    // sorted: [10, 20, 30, 40] → median = (20+30)/2 = 25
    expect(result.value).toBe(25)
  })

  it('all identical values: median equals that value', () => {
    const cases = buildFlipScenariosWithValues([15, 15, 15])
    const result = calculateFlipRoomTurnover(cases)
    expect(result.value).toBe(15)
  })

  it('outlier resilience: median not skewed by extreme outlier', () => {
    // One extreme outlier (170 min — just under the 180 cutoff) with 4 normal values
    const cases = buildFlipScenariosWithValues([20, 22, 25, 28, 170])
    const result = calculateFlipRoomTurnover(cases)
    // sorted: [20, 22, 25, 28, 170] → median = 25 (not pulled toward 170)
    expect(result.value).toBe(25)
  })
})
