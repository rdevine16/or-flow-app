/**
 * Phase 1 tests: Sparkline data, status utilities, FCOTS detail, CaseVolumeResult
 */
import { describe, it, expect } from 'vitest'
import {
  getKPIStatus,
  calculateFCOTS,
  calculateCaseVolume,
  calculateNonOperativeTime,
  calculateTurnoverTime,
  calculateCancellationRate,
  calculateCumulativeTardiness,
  calculateORUtilization,
  type CaseWithMilestones,
} from '../analyticsV2'

// ============================================
// HELPERS — Build minimal test cases
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
// getKPIStatus
// ============================================

describe('getKPIStatus', () => {
  it('returns good when value meets target', () => {
    expect(getKPIStatus(85, 85)).toBe('good')
    expect(getKPIStatus(90, 85)).toBe('good')
  })

  it('returns warn when value is between 70% and 100% of target', () => {
    expect(getKPIStatus(63, 85)).toBe('warn') // 63/85 ≈ 0.74
    expect(getKPIStatus(60, 85)).toBe('warn') // 60/85 ≈ 0.71
  })

  it('returns bad when value is below 70% of target', () => {
    expect(getKPIStatus(50, 85)).toBe('bad') // 50/85 ≈ 0.59
    expect(getKPIStatus(0, 85)).toBe('bad')
  })

  it('handles inverse metrics (lower is better)', () => {
    // For turnover: 25 min vs 30 min target → good (target/value = 30/25 = 1.2)
    expect(getKPIStatus(25, 30, true)).toBe('good')
    // 40 min vs 30 min → warn (30/40 = 0.75)
    expect(getKPIStatus(40, 30, true)).toBe('warn')
    // 60 min vs 30 min → bad (30/60 = 0.5)
    expect(getKPIStatus(60, 30, true)).toBe('bad')
  })

  it('handles zero values gracefully', () => {
    // 0/0.01 = 0, which is < 0.7 → bad
    expect(getKPIStatus(0, 0)).toBe('bad')
    expect(getKPIStatus(0, 85)).toBe('bad')
  })

  it('returns good when value equals target exactly', () => {
    expect(getKPIStatus(75, 75)).toBe('good')
  })
})

// ============================================
// DailyTrackerData.numericValue
// ============================================

describe('DailyTrackerData numericValue', () => {
  it('FCOTS dailyData includes numericValue', () => {
    const cases = [
      makeCase({
        id: 'c1',
        scheduled_date: '2025-02-03',
        start_time: '07:30:00',
        or_room_id: 'room-1',
        milestones: { patient_in: '2025-02-03T07:31:00Z' },
      }),
      makeCase({
        id: 'c2',
        scheduled_date: '2025-02-03',
        start_time: '07:30:00',
        or_room_id: 'room-2',
        milestones: { patient_in: '2025-02-03T07:50:00Z' },
      }),
    ]

    const result = calculateFCOTS(cases)
    expect(result.dailyData).toBeDefined()
    expect(result.dailyData!.length).toBeGreaterThan(0)
    result.dailyData!.forEach(d => {
      expect(typeof d.numericValue).toBe('number')
      expect(d.numericValue).toBeGreaterThanOrEqual(0)
      expect(d.numericValue).toBeLessThanOrEqual(100)
    })
  })

  it('turnover dailyData includes numericValue', () => {
    const cases = [
      makeCase({
        id: 'c1',
        case_number: 'C001',
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
        start_time: '09:00:00',
        or_room_id: 'room-1',
        milestones: {
          patient_in: '2025-02-03T09:00:00Z',
          patient_out: '2025-02-03T10:00:00Z',
        },
      }),
    ]

    const result = calculateTurnoverTime(cases)
    expect(result.dailyData).toBeDefined()
    result.dailyData!.forEach(d => {
      expect(typeof d.numericValue).toBe('number')
    })
  })

  it('cancellation dailyData includes numericValue', () => {
    const cases = [
      makeCase({ scheduled_date: '2025-02-03' }),
      makeCase({
        id: 'c2',
        scheduled_date: '2025-02-03',
        case_statuses: { name: 'cancelled' },
        cancelled_at: '2025-02-03T10:00:00Z',
      }),
    ]

    const result = calculateCancellationRate(cases)
    expect(result.dailyData).toBeDefined()
    result.dailyData!.forEach(d => {
      expect(typeof d.numericValue).toBe('number')
    })
  })

  it('cumulative tardiness dailyData includes numericValue', () => {
    const cases = [
      makeCase({
        scheduled_date: '2025-02-03',
        start_time: '07:30:00',
        milestones: { patient_in: '2025-02-03T07:45:00Z' }, // 15 min late
      }),
    ]

    const result = calculateCumulativeTardiness(cases)
    expect(result.dailyData).toBeDefined()
    result.dailyData!.forEach(d => {
      expect(typeof d.numericValue).toBe('number')
      expect(d.numericValue).toBeGreaterThan(0)
    })
  })

  it('OR utilization dailyData includes numericValue', () => {
    const cases = [
      makeCase({
        scheduled_date: '2025-02-03',
        or_room_id: 'room-1',
        milestones: {
          patient_in: '2025-02-03T07:30:00Z',
          patient_out: '2025-02-03T09:30:00Z',
        },
      }),
    ]

    const result = calculateORUtilization(cases, 10)
    expect(result.dailyData).toBeDefined()
    result.dailyData!.forEach(d => {
      expect(typeof d.numericValue).toBe('number')
    })
  })

  it('non-operative time dailyData includes numericValue', () => {
    const cases = [
      makeCase({
        scheduled_date: '2025-02-03',
        milestones: {
          patient_in: '2025-02-03T07:30:00Z',
          incision: '2025-02-03T07:50:00Z',
          patient_out: '2025-02-03T09:00:00Z',
        },
      }),
    ]

    const result = calculateNonOperativeTime(cases)
    expect(result.dailyData).toBeDefined()
    expect(result.dailyData!.length).toBe(1)
    result.dailyData!.forEach(d => {
      expect(typeof d.numericValue).toBe('number')
      expect(d.numericValue).toBe(20) // 20 min pre-op
    })
  })
})

// ============================================
// CaseVolumeResult.weeklyVolume
// ============================================

describe('CaseVolumeResult weeklyVolume', () => {
  it('returns sorted weeklyVolume array', () => {
    const cases = [
      makeCase({ scheduled_date: '2025-02-03' }), // Week of Feb 2
      makeCase({ id: 'c2', scheduled_date: '2025-02-04' }),
      makeCase({ id: 'c3', scheduled_date: '2025-02-10' }), // Week of Feb 9
    ]

    const result = calculateCaseVolume(cases)
    expect(result.weeklyVolume).toBeDefined()
    expect(result.weeklyVolume.length).toBeGreaterThan(0)
    // Should be chronologically sorted
    for (let i = 1; i < result.weeklyVolume.length; i++) {
      expect(result.weeklyVolume[i].week >= result.weeklyVolume[i - 1].week).toBe(true)
    }
  })

  it('correctly counts cases per week', () => {
    const cases = [
      makeCase({ id: 'c1', scheduled_date: '2025-02-03' }),
      makeCase({ id: 'c2', scheduled_date: '2025-02-04' }),
      makeCase({ id: 'c3', scheduled_date: '2025-02-05' }),
    ]

    const result = calculateCaseVolume(cases)
    // All 3 cases are in the same week (Feb 2 week start)
    expect(result.weeklyVolume.length).toBe(1)
    expect(result.weeklyVolume[0].count).toBe(3)
  })

  it('returns empty weeklyVolume for no cases', () => {
    const result = calculateCaseVolume([])
    expect(result.weeklyVolume).toEqual([])
  })
})

// ============================================
// FCOTSResult.firstCaseDetails
// ============================================

describe('FCOTSResult firstCaseDetails', () => {
  it('returns per-case detail for each first case', () => {
    // Use local-time-compatible timestamps to avoid timezone issues
    // parseScheduledDateTime creates local time, so milestones must also be local-interpretable
    const scheduledLocal = new Date(2025, 1, 3, 7, 30, 0) // Feb 3 2025 07:30 local
    const onTimeLocal = new Date(scheduledLocal.getTime() + 1 * 60000) // +1 min
    const lateLocal = new Date(scheduledLocal.getTime() + 20 * 60000) // +20 min

    const cases = [
      makeCase({
        id: 'c1',
        case_number: 'C001',
        scheduled_date: '2025-02-03',
        start_time: '07:30:00',
        or_room_id: 'room-1',
        milestones: { patient_in: onTimeLocal.toISOString() },
      }),
      makeCase({
        id: 'c2',
        case_number: 'C002',
        scheduled_date: '2025-02-03',
        start_time: '07:30:00',
        or_room_id: 'room-2',
        milestones: { patient_in: lateLocal.toISOString() },
      }),
    ]

    const result = calculateFCOTS(cases)
    expect(result.firstCaseDetails).toBeDefined()
    expect(result.firstCaseDetails.length).toBe(2)

    const detail1 = result.firstCaseDetails.find(d => d.caseNumber === 'C001')!
    expect(detail1.roomName).toBe('OR-1')
    expect(detail1.surgeonName).toBe('Dr. Martinez')
    expect(detail1.isOnTime).toBe(true)
    expect(detail1.delayMinutes).toBeLessThanOrEqual(2)

    const detail2 = result.firstCaseDetails.find(d => d.caseNumber === 'C002')!
    expect(detail2.isOnTime).toBe(false)
    expect(detail2.delayMinutes).toBe(20)
  })

  it('returns empty firstCaseDetails when no cases have milestones', () => {
    const cases = [
      makeCase({
        id: 'c1',
        scheduled_date: '2025-02-03',
        start_time: '07:30:00',
        or_room_id: 'room-1',
        milestones: {}, // No patient_in
      }),
    ]

    const result = calculateFCOTS(cases)
    expect(result.firstCaseDetails).toEqual([])
  })

  it('firstCaseDetails are sorted by date', () => {
    const cases = [
      makeCase({
        id: 'c1',
        scheduled_date: '2025-02-05',
        start_time: '07:30:00',
        or_room_id: 'room-1',
        milestones: { patient_in: '2025-02-05T07:31:00Z' },
      }),
      makeCase({
        id: 'c2',
        scheduled_date: '2025-02-03',
        start_time: '07:30:00',
        or_room_id: 'room-1',
        milestones: { patient_in: '2025-02-03T07:40:00Z' },
      }),
    ]

    const result = calculateFCOTS(cases)
    expect(result.firstCaseDetails.length).toBe(2)
    expect(result.firstCaseDetails[0].scheduledDate).toBe('2025-02-03')
    expect(result.firstCaseDetails[1].scheduledDate).toBe('2025-02-05')
  })
})

// ============================================
// Non-operative time dailyData
// ============================================

describe('calculateNonOperativeTime dailyData', () => {
  it('groups by day and calculates daily average', () => {
    const cases = [
      makeCase({
        id: 'c1',
        scheduled_date: '2025-02-03',
        milestones: {
          patient_in: '2025-02-03T07:30:00Z',
          incision: '2025-02-03T07:50:00Z', // 20 min pre-op
          patient_out: '2025-02-03T09:00:00Z',
        },
      }),
      makeCase({
        id: 'c2',
        scheduled_date: '2025-02-03',
        milestones: {
          patient_in: '2025-02-03T10:00:00Z',
          incision: '2025-02-03T10:10:00Z', // 10 min pre-op
          patient_out: '2025-02-03T11:00:00Z',
        },
      }),
    ]

    const result = calculateNonOperativeTime(cases)
    expect(result.dailyData).toBeDefined()
    expect(result.dailyData!.length).toBe(1)
    // Average of 20 and 10 = 15
    expect(result.dailyData![0].numericValue).toBe(15)
  })

  it('returns empty dailyData for no valid cases', () => {
    const result = calculateNonOperativeTime([])
    expect(result.dailyData).toBeDefined()
    expect(result.dailyData!.length).toBe(0)
  })
})
