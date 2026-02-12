import { describe, it, expect } from 'vitest'
import {
  findNextCase,
  getCurrentMilestoneStatus,
  type SurgeonDayCase,
  type FlipRoomMilestoneData,
} from '../flip-room'

// ============================================
// HELPERS
// ============================================

function buildCase(overrides: Partial<SurgeonDayCase> & { id: string }): SurgeonDayCase {
  return {
    case_number: `CASE-${overrides.id}`,
    or_room_id: 'room-1',
    room_name: 'OR 1',
    start_time: '08:00',
    status_name: 'in_progress',
    procedure_name: 'Total Hip Arthroplasty',
    called_back_at: null,
    ...overrides,
  }
}

function buildMilestone(overrides: Partial<FlipRoomMilestoneData> & { facility_milestone_id: string }): FlipRoomMilestoneData {
  return {
    recorded_at: null,
    display_name: 'Milestone',
    display_order: 0,
    name: 'milestone',
    ...overrides,
  }
}

// ============================================
// UNIT TESTS: findNextCase
// ============================================

describe('findNextCase — unit', () => {
  it('should return null when no cases provided', () => {
    const result = findNextCase([], 'case-1', 'room-1')
    expect(result.flipCase).toBeNull()
    expect(result.nextSameRoomCase).toBeNull()
  })

  it('should return null when only the current case exists (no next)', () => {
    const cases = [buildCase({ id: 'case-1', or_room_id: 'room-1' })]
    const result = findNextCase(cases, 'case-1', 'room-1')
    expect(result.flipCase).toBeNull()
    expect(result.nextSameRoomCase).toBeNull()
  })

  it('should return flipCase when next case is in a different room', () => {
    const cases = [
      buildCase({ id: 'case-1', or_room_id: 'room-1', start_time: '08:00' }),
      buildCase({ id: 'case-2', or_room_id: 'room-2', start_time: '10:00', room_name: 'OR 2' }),
    ]
    const result = findNextCase(cases, 'case-1', 'room-1')
    expect(result.flipCase).not.toBeNull()
    expect(result.flipCase!.id).toBe('case-2')
    expect(result.flipCase!.room_name).toBe('OR 2')
    expect(result.nextSameRoomCase).toBeNull()
  })

  it('should return nextSameRoomCase when next case is in the same room', () => {
    const cases = [
      buildCase({ id: 'case-1', or_room_id: 'room-1', start_time: '08:00' }),
      buildCase({ id: 'case-2', or_room_id: 'room-1', start_time: '10:00' }),
    ]
    const result = findNextCase(cases, 'case-1', 'room-1')
    expect(result.flipCase).toBeNull()
    expect(result.nextSameRoomCase).not.toBeNull()
    expect(result.nextSameRoomCase!.id).toBe('case-2')
  })

  it('should skip cancelled cases when looking for next', () => {
    const cases = [
      buildCase({ id: 'case-1', or_room_id: 'room-1', start_time: '08:00' }),
      buildCase({ id: 'case-2', or_room_id: 'room-2', start_time: '09:00', status_name: 'cancelled' }),
      buildCase({ id: 'case-3', or_room_id: 'room-2', start_time: '10:00' }),
    ]
    const result = findNextCase(cases, 'case-1', 'room-1')
    expect(result.flipCase).not.toBeNull()
    expect(result.flipCase!.id).toBe('case-3')
  })

  it('should skip completed cases when looking for next', () => {
    const cases = [
      buildCase({ id: 'case-1', or_room_id: 'room-1', start_time: '08:00' }),
      buildCase({ id: 'case-2', or_room_id: 'room-2', start_time: '09:00', status_name: 'completed' }),
      buildCase({ id: 'case-3', or_room_id: 'room-2', start_time: '10:00', status_name: 'scheduled' }),
    ]
    const result = findNextCase(cases, 'case-1', 'room-1')
    expect(result.flipCase!.id).toBe('case-3')
  })

  it('should return null when current case is not found in the list', () => {
    const cases = [
      buildCase({ id: 'case-1', or_room_id: 'room-1', start_time: '08:00' }),
      buildCase({ id: 'case-2', or_room_id: 'room-2', start_time: '10:00' }),
    ]
    const result = findNextCase(cases, 'case-999', 'room-1')
    expect(result.flipCase).toBeNull()
    expect(result.nextSameRoomCase).toBeNull()
  })

  it('should sort cases by start_time regardless of input order', () => {
    const cases = [
      buildCase({ id: 'case-3', or_room_id: 'room-2', start_time: '12:00' }),
      buildCase({ id: 'case-1', or_room_id: 'room-1', start_time: '08:00' }),
      buildCase({ id: 'case-2', or_room_id: 'room-2', start_time: '10:00' }),
    ]
    const result = findNextCase(cases, 'case-1', 'room-1')
    expect(result.flipCase!.id).toBe('case-2')
  })

  it('should sort cases without start_time to end', () => {
    const cases = [
      buildCase({ id: 'case-1', or_room_id: 'room-1', start_time: '08:00' }),
      buildCase({ id: 'case-2', or_room_id: 'room-2', start_time: null }),
      buildCase({ id: 'case-3', or_room_id: 'room-2', start_time: '10:00' }),
    ]
    const result = findNextCase(cases, 'case-1', 'room-1')
    // case-3 (10:00) comes before case-2 (null)
    expect(result.flipCase!.id).toBe('case-3')
  })

  it('should return null when current case has no room', () => {
    const cases = [
      buildCase({ id: 'case-1', or_room_id: null, start_time: '08:00' }),
      buildCase({ id: 'case-2', or_room_id: 'room-2', start_time: '10:00' }),
    ]
    const result = findNextCase(cases, 'case-1', null)
    expect(result.flipCase).toBeNull()
    expect(result.nextSameRoomCase).toBeNull()
  })

  it('should return null when next case has no room', () => {
    const cases = [
      buildCase({ id: 'case-1', or_room_id: 'room-1', start_time: '08:00' }),
      buildCase({ id: 'case-2', or_room_id: null, start_time: '10:00' }),
    ]
    const result = findNextCase(cases, 'case-1', 'room-1')
    expect(result.flipCase).toBeNull()
    expect(result.nextSameRoomCase).toBeNull()
  })

  it('should handle scheduled status as a valid next case', () => {
    const cases = [
      buildCase({ id: 'case-1', or_room_id: 'room-1', start_time: '08:00', status_name: 'in_progress' }),
      buildCase({ id: 'case-2', or_room_id: 'room-2', start_time: '10:00', status_name: 'scheduled' }),
    ]
    const result = findNextCase(cases, 'case-1', 'room-1')
    expect(result.flipCase!.id).toBe('case-2')
  })

  it('should handle on_hold status as a valid next case', () => {
    const cases = [
      buildCase({ id: 'case-1', or_room_id: 'room-1', start_time: '08:00' }),
      buildCase({ id: 'case-2', or_room_id: 'room-2', start_time: '10:00', status_name: 'on_hold' }),
    ]
    const result = findNextCase(cases, 'case-1', 'room-1')
    expect(result.flipCase!.id).toBe('case-2')
  })

  it('should not mutate the input array', () => {
    const cases = [
      buildCase({ id: 'case-2', or_room_id: 'room-2', start_time: '10:00' }),
      buildCase({ id: 'case-1', or_room_id: 'room-1', start_time: '08:00' }),
    ]
    const originalOrder = cases.map(c => c.id)
    findNextCase(cases, 'case-1', 'room-1')
    expect(cases.map(c => c.id)).toEqual(originalOrder)
  })

  it('should return null when current case is the last non-cancelled case', () => {
    const cases = [
      buildCase({ id: 'case-1', or_room_id: 'room-1', start_time: '08:00' }),
      buildCase({ id: 'case-2', or_room_id: 'room-2', start_time: '10:00', status_name: 'cancelled' }),
    ]
    const result = findNextCase(cases, 'case-1', 'room-1')
    expect(result.flipCase).toBeNull()
    expect(result.nextSameRoomCase).toBeNull()
  })

  it('should preserve called_back_at on the returned flip case', () => {
    const cases = [
      buildCase({ id: 'case-1', or_room_id: 'room-1', start_time: '08:00' }),
      buildCase({ id: 'case-2', or_room_id: 'room-2', start_time: '10:00', called_back_at: '2025-01-15T09:30:00Z' }),
    ]
    const result = findNextCase(cases, 'case-1', 'room-1')
    expect(result.flipCase!.called_back_at).toBe('2025-01-15T09:30:00Z')
  })
})

// ============================================
// UNIT TESTS: getCurrentMilestoneStatus
// ============================================

describe('getCurrentMilestoneStatus — unit', () => {
  const NOW = new Date('2025-01-15T10:00:00Z').getTime()

  it('should return null when no milestones are recorded', () => {
    const milestones = [
      buildMilestone({ facility_milestone_id: 'fm-1', recorded_at: null }),
      buildMilestone({ facility_milestone_id: 'fm-2', recorded_at: null }),
    ]
    expect(getCurrentMilestoneStatus(milestones, NOW)).toBeNull()
  })

  it('should return null when milestones array is empty', () => {
    expect(getCurrentMilestoneStatus([], NOW)).toBeNull()
  })

  it('should return the only recorded milestone', () => {
    const milestones = [
      buildMilestone({
        facility_milestone_id: 'fm-1',
        recorded_at: '2025-01-15T09:30:00Z',
        display_name: 'Patient In',
        display_order: 0,
        name: 'patient_in',
      }),
    ]
    const result = getCurrentMilestoneStatus(milestones, NOW)
    expect(result).not.toBeNull()
    expect(result!.milestoneDisplayName).toBe('Patient In')
    expect(result!.milestoneName).toBe('patient_in')
    expect(result!.recordedAt).toBe('2025-01-15T09:30:00Z')
    expect(result!.elapsedMs).toBe(30 * 60 * 1000) // 30 minutes
  })

  it('should return the highest display_order recorded milestone', () => {
    const milestones = [
      buildMilestone({
        facility_milestone_id: 'fm-1',
        recorded_at: '2025-01-15T08:00:00Z',
        display_name: 'Patient In',
        display_order: 0,
        name: 'patient_in',
      }),
      buildMilestone({
        facility_milestone_id: 'fm-2',
        recorded_at: '2025-01-15T09:00:00Z',
        display_name: 'Incision',
        display_order: 5,
        name: 'incision',
      }),
      buildMilestone({
        facility_milestone_id: 'fm-3',
        recorded_at: null,
        display_name: 'Closing',
        display_order: 6,
        name: 'closing',
      }),
    ]
    const result = getCurrentMilestoneStatus(milestones, NOW)
    expect(result!.milestoneDisplayName).toBe('Incision')
    expect(result!.elapsedMs).toBe(60 * 60 * 1000) // 1 hour
  })

  it('should ignore unrecorded milestones', () => {
    const milestones = [
      buildMilestone({
        facility_milestone_id: 'fm-1',
        recorded_at: '2025-01-15T09:30:00Z',
        display_name: 'Patient In',
        display_order: 0,
        name: 'patient_in',
      }),
      buildMilestone({
        facility_milestone_id: 'fm-2',
        recorded_at: null,
        display_name: 'Incision',
        display_order: 5,
        name: 'incision',
      }),
    ]
    const result = getCurrentMilestoneStatus(milestones, NOW)
    expect(result!.milestoneDisplayName).toBe('Patient In')
  })

  it('should calculate correct elapsed time', () => {
    const fiveMinutesAgo = new Date(NOW - 5 * 60 * 1000).toISOString()
    const milestones = [
      buildMilestone({
        facility_milestone_id: 'fm-1',
        recorded_at: fiveMinutesAgo,
        display_name: 'Closing',
        display_order: 6,
        name: 'closing',
      }),
    ]
    const result = getCurrentMilestoneStatus(milestones, NOW)
    expect(result!.elapsedMs).toBe(5 * 60 * 1000)
  })
})

// ============================================
// INTEGRATION TESTS
// ============================================

describe('findNextCase — integration with multiple rooms', () => {
  it('should handle surgeon with 3 rooms — find flip room from middle case', () => {
    const cases = [
      buildCase({ id: 'case-1', or_room_id: 'room-1', start_time: '07:00', room_name: 'OR 1' }),
      buildCase({ id: 'case-2', or_room_id: 'room-2', start_time: '09:00', room_name: 'OR 2' }),
      buildCase({ id: 'case-3', or_room_id: 'room-3', start_time: '11:00', room_name: 'OR 3' }),
    ]
    // Viewing case-2, next case is case-3 in room-3 (flip room)
    const result = findNextCase(cases, 'case-2', 'room-2')
    expect(result.flipCase!.id).toBe('case-3')
    expect(result.flipCase!.room_name).toBe('OR 3')
  })

  it('should handle mix of same-room and flip-room in sequence', () => {
    const cases = [
      buildCase({ id: 'case-1', or_room_id: 'room-1', start_time: '07:00' }),
      buildCase({ id: 'case-2', or_room_id: 'room-1', start_time: '09:00' }),
      buildCase({ id: 'case-3', or_room_id: 'room-2', start_time: '11:00' }),
    ]
    // From case-1: next is case-2 (same room)
    const result1 = findNextCase(cases, 'case-1', 'room-1')
    expect(result1.nextSameRoomCase!.id).toBe('case-2')
    expect(result1.flipCase).toBeNull()

    // From case-2: next is case-3 (flip room)
    const result2 = findNextCase(cases, 'case-2', 'room-1')
    expect(result2.flipCase!.id).toBe('case-3')
    expect(result2.nextSameRoomCase).toBeNull()
  })

  it('should skip multiple cancelled/completed to find next valid case', () => {
    const cases = [
      buildCase({ id: 'case-1', or_room_id: 'room-1', start_time: '07:00' }),
      buildCase({ id: 'case-2', or_room_id: 'room-2', start_time: '08:00', status_name: 'completed' }),
      buildCase({ id: 'case-3', or_room_id: 'room-2', start_time: '09:00', status_name: 'cancelled' }),
      buildCase({ id: 'case-4', or_room_id: 'room-2', start_time: '10:00', status_name: 'scheduled' }),
    ]
    const result = findNextCase(cases, 'case-1', 'room-1')
    expect(result.flipCase!.id).toBe('case-4')
  })

  it('should include procedure and callback data on flip case', () => {
    const cases = [
      buildCase({ id: 'case-1', or_room_id: 'room-1', start_time: '08:00' }),
      buildCase({
        id: 'case-2',
        or_room_id: 'room-2',
        start_time: '10:00',
        procedure_name: 'Total Knee Arthroplasty',
        called_back_at: '2025-01-15T09:45:00Z',
        room_name: 'OR 2',
      }),
    ]
    const result = findNextCase(cases, 'case-1', 'room-1')
    expect(result.flipCase!.procedure_name).toBe('Total Knee Arthroplasty')
    expect(result.flipCase!.called_back_at).toBe('2025-01-15T09:45:00Z')
    expect(result.flipCase!.room_name).toBe('OR 2')
  })
})

describe('getCurrentMilestoneStatus — integration', () => {
  it('should return correct status for a full milestone set', () => {
    const now = new Date('2025-01-15T10:00:00Z').getTime()
    const milestones: FlipRoomMilestoneData[] = [
      { facility_milestone_id: 'fm-1', recorded_at: '2025-01-15T08:00:00Z', display_name: 'Patient In', display_order: 0, name: 'patient_in' },
      { facility_milestone_id: 'fm-2', recorded_at: '2025-01-15T08:30:00Z', display_name: 'Anesthesia Start', display_order: 1, name: 'anesthesia_start' },
      { facility_milestone_id: 'fm-3', recorded_at: '2025-01-15T09:00:00Z', display_name: 'Incision', display_order: 5, name: 'incision' },
      { facility_milestone_id: 'fm-4', recorded_at: null, display_name: 'Closing', display_order: 6, name: 'closing' },
      { facility_milestone_id: 'fm-5', recorded_at: null, display_name: 'Patient Out', display_order: 8, name: 'patient_out' },
    ]
    const result = getCurrentMilestoneStatus(milestones, now)
    expect(result!.milestoneDisplayName).toBe('Incision')
    expect(result!.milestoneName).toBe('incision')
    // 10:00 - 09:00 = 1 hour
    expect(result!.elapsedMs).toBe(60 * 60 * 1000)
  })
})

// ============================================
// WORKFLOW TESTS
// ============================================

describe('flip room — workflow', () => {
  it('should handle full surgeon day: 3 cases across 2 rooms', () => {
    const cases = [
      buildCase({ id: 'case-1', or_room_id: 'room-1', start_time: '07:00', room_name: 'OR 1', status_name: 'in_progress' }),
      buildCase({ id: 'case-2', or_room_id: 'room-2', start_time: '09:00', room_name: 'OR 2', status_name: 'scheduled' }),
      buildCase({ id: 'case-3', or_room_id: 'room-1', start_time: '11:00', room_name: 'OR 1', status_name: 'scheduled' }),
    ]

    // During case 1: flip room is case 2 in OR 2
    const r1 = findNextCase(cases, 'case-1', 'room-1')
    expect(r1.flipCase!.id).toBe('case-2')
    expect(r1.flipCase!.room_name).toBe('OR 2')

    // During case 2: next is case 3 back in OR 1 (flip room again)
    const r2 = findNextCase(cases, 'case-2', 'room-2')
    expect(r2.flipCase!.id).toBe('case-3')
    expect(r2.flipCase!.room_name).toBe('OR 1')

    // During case 3: no next case
    const r3 = findNextCase(cases, 'case-3', 'room-1')
    expect(r3.flipCase).toBeNull()
    expect(r3.nextSameRoomCase).toBeNull()
  })

  it('should handle case completion mid-day: completed case skipped', () => {
    // Initially case-2 is scheduled
    const casesInitial = [
      buildCase({ id: 'case-1', or_room_id: 'room-1', start_time: '07:00', status_name: 'in_progress' }),
      buildCase({ id: 'case-2', or_room_id: 'room-2', start_time: '09:00', status_name: 'scheduled' }),
      buildCase({ id: 'case-3', or_room_id: 'room-2', start_time: '11:00', status_name: 'scheduled' }),
    ]
    const r1 = findNextCase(casesInitial, 'case-1', 'room-1')
    expect(r1.flipCase!.id).toBe('case-2')

    // case-2 completes, now case-3 is next
    const casesAfter = [
      buildCase({ id: 'case-1', or_room_id: 'room-1', start_time: '07:00', status_name: 'in_progress' }),
      buildCase({ id: 'case-2', or_room_id: 'room-2', start_time: '09:00', status_name: 'completed' }),
      buildCase({ id: 'case-3', or_room_id: 'room-2', start_time: '11:00', status_name: 'scheduled' }),
    ]
    const r2 = findNextCase(casesAfter, 'case-1', 'room-1')
    expect(r2.flipCase!.id).toBe('case-3')
  })

  it('should track milestone progression in flip room', () => {
    const baseTime = new Date('2025-01-15T08:00:00Z').getTime()

    // Step 1: Case just started — patient in recorded
    const milestones1: FlipRoomMilestoneData[] = [
      { facility_milestone_id: 'fm-1', recorded_at: '2025-01-15T08:00:00Z', display_name: 'Patient In', display_order: 0, name: 'patient_in' },
    ]
    const s1 = getCurrentMilestoneStatus(milestones1, baseTime + 15 * 60 * 1000)
    expect(s1!.milestoneDisplayName).toBe('Patient In')
    expect(s1!.elapsedMs).toBe(15 * 60 * 1000)

    // Step 2: Incision recorded
    const milestones2: FlipRoomMilestoneData[] = [
      ...milestones1,
      { facility_milestone_id: 'fm-5', recorded_at: '2025-01-15T08:30:00Z', display_name: 'Incision', display_order: 5, name: 'incision' },
    ]
    const s2 = getCurrentMilestoneStatus(milestones2, baseTime + 45 * 60 * 1000)
    expect(s2!.milestoneDisplayName).toBe('Incision')
    expect(s2!.elapsedMs).toBe(15 * 60 * 1000) // 45min - 30min

    // Step 3: Closing recorded
    const milestones3: FlipRoomMilestoneData[] = [
      ...milestones2,
      { facility_milestone_id: 'fm-6', recorded_at: '2025-01-15T09:30:00Z', display_name: 'Closing', display_order: 6, name: 'closing' },
    ]
    const s3 = getCurrentMilestoneStatus(milestones3, baseTime + 100 * 60 * 1000)
    expect(s3!.milestoneDisplayName).toBe('Closing')
  })
})
