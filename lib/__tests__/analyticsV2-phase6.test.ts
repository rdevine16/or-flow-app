/**
 * Phase 6 tests: TurnoverDetail and CancellationDetail data population
 *
 * Verifies:
 * 1. calculateTurnoverTime returns per-transition detail array
 * 2. TurnoverDetail has correct fields: date, roomName, case numbers, surgeon names, minutes, compliance
 * 3. calculateCancellationRate returns per-case cancellation detail array
 * 4. CancellationDetail has correct fields: caseId, caseNumber, date, roomName, surgeonName, scheduledStart, type
 * 5. Same-day vs prior-day cancellation types are correctly classified
 * 6. Compliance counts match detail array counts
 */
import { describe, it, expect } from 'vitest'
import {
  calculateTurnoverTime,
  calculateCancellationRate,
  ANALYTICS_CONFIG_DEFAULTS,
  type CaseWithMilestones,
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

// ============================================
// calculateTurnoverTime — detail data
// ============================================

describe('calculateTurnoverTime detail data', () => {
  it('returns per-transition TurnoverDetail array', () => {
    const cases = [
      makeCase({
        id: 'c1',
        case_number: 'C001',
        scheduled_date: '2025-02-03',
        start_time: '07:30:00',
        or_room_id: 'room-1',
        or_rooms: { id: 'room-1', name: 'OR-1' },
        surgeon: { first_name: 'John', last_name: 'Martinez' },
        milestones: {
          patient_in: '2025-02-03T07:30:00',
          patient_out: '2025-02-03T09:00:00',
        },
      }),
      makeCase({
        id: 'c2',
        case_number: 'C002',
        scheduled_date: '2025-02-03',
        start_time: '09:25:00',
        or_room_id: 'room-1',
        or_rooms: { id: 'room-1', name: 'OR-1' },
        surgeon: { first_name: 'Sarah', last_name: 'Williams' },
        milestones: {
          patient_in: '2025-02-03T09:25:00',
          patient_out: '2025-02-03T11:00:00',
        },
      }),
    ]

    const result = calculateTurnoverTime(cases)

    expect(result.details).toHaveLength(1)
    expect(result.details[0]).toMatchObject({
      date: '2025-02-03',
      roomName: 'OR-1',
      fromCaseNumber: 'C001',
      toCaseNumber: 'C002',
      fromSurgeonName: 'John Martinez',
      toSurgeonName: 'Sarah Williams',
      turnoverMinutes: 25,
      isCompliant: true, // 25 < 30 default threshold
    })
  })

  it('marks non-compliant turnovers correctly', () => {
    const cases = [
      makeCase({
        id: 'c1',
        case_number: 'C001',
        scheduled_date: '2025-02-03',
        start_time: '07:30:00',
        or_room_id: 'room-1',
        or_rooms: { id: 'room-1', name: 'OR-1' },
        milestones: {
          patient_in: '2025-02-03T07:30:00',
          patient_out: '2025-02-03T09:00:00',
        },
      }),
      makeCase({
        id: 'c2',
        case_number: 'C002',
        scheduled_date: '2025-02-03',
        start_time: '09:45:00',
        or_room_id: 'room-1',
        or_rooms: { id: 'room-1', name: 'OR-1' },
        milestones: {
          patient_in: '2025-02-03T09:45:00',
          patient_out: '2025-02-03T11:30:00',
        },
      }),
    ]

    const result = calculateTurnoverTime(cases, undefined, {
      turnoverThresholdMinutes: 30,
    })

    expect(result.details).toHaveLength(1)
    expect(result.details[0].turnoverMinutes).toBe(45)
    expect(result.details[0].isCompliant).toBe(false)
    expect(result.nonCompliantCount).toBe(1)
    expect(result.compliantCount).toBe(0)
    expect(result.complianceRate).toBe(0)
  })

  it('returns multiple turnover details across rooms', () => {
    const cases = [
      // OR-1 pair
      makeCase({
        id: 'c1',
        case_number: 'C001',
        scheduled_date: '2025-02-03',
        start_time: '07:30:00',
        or_room_id: 'room-1',
        or_rooms: { id: 'room-1', name: 'OR-1' },
        surgeon: { first_name: 'John', last_name: 'Martinez' },
        milestones: {
          patient_in: '2025-02-03T07:30:00',
          patient_out: '2025-02-03T09:00:00',
        },
      }),
      makeCase({
        id: 'c2',
        case_number: 'C002',
        scheduled_date: '2025-02-03',
        start_time: '09:20:00',
        or_room_id: 'room-1',
        or_rooms: { id: 'room-1', name: 'OR-1' },
        surgeon: { first_name: 'John', last_name: 'Martinez' },
        milestones: {
          patient_in: '2025-02-03T09:20:00',
          patient_out: '2025-02-03T11:00:00',
        },
      }),
      // OR-2 pair
      makeCase({
        id: 'c3',
        case_number: 'C003',
        scheduled_date: '2025-02-03',
        start_time: '08:00:00',
        or_room_id: 'room-2',
        or_rooms: { id: 'room-2', name: 'OR-2' },
        surgeon: { first_name: 'Sarah', last_name: 'Williams' },
        milestones: {
          patient_in: '2025-02-03T08:00:00',
          patient_out: '2025-02-03T10:00:00',
        },
      }),
      makeCase({
        id: 'c4',
        case_number: 'C004',
        scheduled_date: '2025-02-03',
        start_time: '10:40:00',
        or_room_id: 'room-2',
        or_rooms: { id: 'room-2', name: 'OR-2' },
        surgeon: { first_name: 'Sarah', last_name: 'Williams' },
        milestones: {
          patient_in: '2025-02-03T10:40:00',
          patient_out: '2025-02-03T12:30:00',
        },
      }),
    ]

    const result = calculateTurnoverTime(cases, undefined, {
      turnoverThresholdMinutes: 30,
    })

    expect(result.details).toHaveLength(2)
    // Sorted by date then room name
    expect(result.details[0].roomName).toBe('OR-1')
    expect(result.details[0].turnoverMinutes).toBe(20) // 9:00 → 9:20
    expect(result.details[0].isCompliant).toBe(true)
    expect(result.details[1].roomName).toBe('OR-2')
    expect(result.details[1].turnoverMinutes).toBe(40) // 10:00 → 10:40
    expect(result.details[1].isCompliant).toBe(false)

    expect(result.compliantCount).toBe(1)
    expect(result.nonCompliantCount).toBe(1)
    expect(result.complianceRate).toBe(50)
  })

  it('returns empty details when no transitions exist', () => {
    const cases = [
      makeCase({
        id: 'c1',
        scheduled_date: '2025-02-03',
        or_room_id: 'room-1',
        milestones: {
          patient_in: '2025-02-03T07:30:00',
          patient_out: '2025-02-03T09:00:00',
        },
      }),
    ]

    const result = calculateTurnoverTime(cases)
    expect(result.details).toHaveLength(0)
    expect(result.compliantCount).toBe(0)
    expect(result.nonCompliantCount).toBe(0)
    expect(result.complianceRate).toBe(0)
  })

  it('compliance counts match the totals in detail array', () => {
    const cases = [
      makeCase({
        id: 'c1',
        case_number: 'C001',
        scheduled_date: '2025-02-03',
        start_time: '07:30:00',
        or_room_id: 'room-1',
        or_rooms: { id: 'room-1', name: 'OR-1' },
        milestones: {
          patient_in: '2025-02-03T07:30:00',
          patient_out: '2025-02-03T09:00:00',
        },
      }),
      makeCase({
        id: 'c2',
        case_number: 'C002',
        scheduled_date: '2025-02-03',
        start_time: '09:20:00',
        or_room_id: 'room-1',
        or_rooms: { id: 'room-1', name: 'OR-1' },
        milestones: {
          patient_in: '2025-02-03T09:20:00',
          patient_out: '2025-02-03T11:00:00',
        },
      }),
      makeCase({
        id: 'c3',
        case_number: 'C003',
        scheduled_date: '2025-02-03',
        start_time: '11:45:00',
        or_room_id: 'room-1',
        or_rooms: { id: 'room-1', name: 'OR-1' },
        milestones: {
          patient_in: '2025-02-03T11:45:00',
          patient_out: '2025-02-03T13:00:00',
        },
      }),
    ]

    const result = calculateTurnoverTime(cases, undefined, {
      turnoverThresholdMinutes: 30,
    })

    // c1→c2: 20 min (compliant), c2→c3: 45 min (non-compliant)
    expect(result.details).toHaveLength(2)
    const compliantInDetails = result.details.filter(d => d.isCompliant).length
    const nonCompliantInDetails = result.details.filter(d => !d.isCompliant).length
    expect(compliantInDetails).toBe(result.compliantCount)
    expect(nonCompliantInDetails).toBe(result.nonCompliantCount)
  })
})

// ============================================
// calculateCancellationRate — detail data
// ============================================

describe('calculateCancellationRate detail data', () => {
  it('returns per-case CancellationDetail array', () => {
    const cases = [
      makeCase({
        id: 'c1',
        case_number: 'C001',
        scheduled_date: '2025-02-03',
        start_time: '07:30:00',
        or_room_id: 'room-1',
        or_rooms: { id: 'room-1', name: 'OR-1' },
        surgeon: { first_name: 'John', last_name: 'Martinez' },
        case_statuses: { name: 'completed' },
      }),
      makeCase({
        id: 'c2',
        case_number: 'C002',
        scheduled_date: '2025-02-03',
        start_time: '10:00:00',
        or_room_id: 'room-2',
        or_rooms: { id: 'room-2', name: 'OR-2' },
        surgeon: { first_name: 'Sarah', last_name: 'Williams' },
        case_statuses: { name: 'cancelled' },
        cancelled_at: '2025-02-03T06:00:00', // Same-day cancellation
      }),
    ]

    const result = calculateCancellationRate(cases)

    expect(result.details).toHaveLength(1) // Only cancelled cases
    expect(result.details[0]).toMatchObject({
      caseId: 'c2',
      caseNumber: 'C002',
      date: '2025-02-03',
      roomName: 'OR-2',
      surgeonName: 'Sarah Williams',
      scheduledStart: '10:00:00',
      cancellationType: 'same_day',
    })
  })

  it('classifies same-day vs prior-day cancellations', () => {
    const cases = [
      // Same-day cancellation
      makeCase({
        id: 'c1',
        case_number: 'C001',
        scheduled_date: '2025-02-03',
        start_time: '07:30:00',
        or_room_id: 'room-1',
        or_rooms: { id: 'room-1', name: 'OR-1' },
        surgeon: { first_name: 'John', last_name: 'Martinez' },
        case_statuses: { name: 'cancelled' },
        cancelled_at: '2025-02-03T06:30:00',
      }),
      // Prior-day cancellation
      makeCase({
        id: 'c2',
        case_number: 'C002',
        scheduled_date: '2025-02-05',
        start_time: '09:00:00',
        or_room_id: 'room-2',
        or_rooms: { id: 'room-2', name: 'OR-2' },
        surgeon: { first_name: 'Sarah', last_name: 'Williams' },
        case_statuses: { name: 'cancelled' },
        cancelled_at: '2025-02-04T15:00:00',
      }),
    ]

    const result = calculateCancellationRate(cases)

    expect(result.details).toHaveLength(2)
    const sameDayDetail = result.details.find(d => d.caseId === 'c1')
    const priorDayDetail = result.details.find(d => d.caseId === 'c2')

    expect(sameDayDetail?.cancellationType).toBe('same_day')
    expect(priorDayDetail?.cancellationType).toBe('prior_day')
  })

  it('returns empty details when no cancellations', () => {
    const cases = [
      makeCase({
        id: 'c1',
        case_statuses: { name: 'completed' },
      }),
      makeCase({
        id: 'c2',
        case_statuses: { name: 'completed' },
      }),
    ]

    const result = calculateCancellationRate(cases)
    expect(result.details).toHaveLength(0)
    expect(result.sameDayCount).toBe(0)
    expect(result.totalCancelledCount).toBe(0)
  })

  it('detail count matches aggregate counts', () => {
    const cases = [
      makeCase({ id: 'c1', case_statuses: { name: 'completed' } }),
      makeCase({
        id: 'c2',
        case_number: 'C002',
        scheduled_date: '2025-02-03',
        case_statuses: { name: 'cancelled' },
        cancelled_at: '2025-02-03T06:00:00', // same-day
      }),
      makeCase({
        id: 'c3',
        case_number: 'C003',
        scheduled_date: '2025-02-04',
        case_statuses: { name: 'cancelled' },
        cancelled_at: '2025-02-03T20:00:00', // prior-day
      }),
      makeCase({
        id: 'c4',
        case_number: 'C004',
        scheduled_date: '2025-02-05',
        case_statuses: { name: 'cancelled' },
        cancelled_at: '2025-02-05T07:00:00', // same-day
      }),
    ]

    const result = calculateCancellationRate(cases)

    expect(result.details).toHaveLength(3)
    expect(result.totalCancelledCount).toBe(3)
    expect(result.sameDayCount).toBe(2)

    const sameDayInDetails = result.details.filter(d => d.cancellationType === 'same_day').length
    expect(sameDayInDetails).toBe(result.sameDayCount)
  })

  it('handles cancellation without cancelled_at (fallback)', () => {
    const cases = [
      makeCase({
        id: 'c1',
        case_number: 'C001',
        scheduled_date: '2025-02-03',
        case_statuses: { name: 'cancelled' },
        // No cancelled_at — fallback: treat as same_day
      }),
    ]

    const result = calculateCancellationRate(cases)

    expect(result.details).toHaveLength(1)
    // Without cancelled_at, isSameDayCancellation returns true (fallback),
    // and the type is classified as 'same_day'
    expect(result.details[0].cancellationType).toBe('same_day')
  })

  it('details are sorted by date', () => {
    const cases = [
      makeCase({
        id: 'c1',
        case_number: 'C001',
        scheduled_date: '2025-02-05',
        case_statuses: { name: 'cancelled' },
        cancelled_at: '2025-02-05T06:00:00',
      }),
      makeCase({
        id: 'c2',
        case_number: 'C002',
        scheduled_date: '2025-02-03',
        case_statuses: { name: 'cancelled' },
        cancelled_at: '2025-02-03T06:00:00',
      }),
      makeCase({
        id: 'c3',
        case_number: 'C003',
        scheduled_date: '2025-02-04',
        case_statuses: { name: 'cancelled' },
        cancelled_at: '2025-02-04T06:00:00',
      }),
    ]

    const result = calculateCancellationRate(cases)

    expect(result.details[0].date).toBe('2025-02-03')
    expect(result.details[1].date).toBe('2025-02-04')
    expect(result.details[2].date).toBe('2025-02-05')
  })
})
