// types/__tests__/room-scheduling.test.ts
import { describe, it, expect } from 'vitest'
import {
  roomDateKey,
  buildAssignmentMap,
  type RoomDateAssignment,
  type RoomDateStaff,
} from '../room-scheduling'

describe('roomDateKey', () => {
  it('builds correct key from roomId and date', () => {
    expect(roomDateKey('room-123', '2026-03-10')).toBe('room-123:2026-03-10')
  })

  it('handles different room IDs with same date', () => {
    const key1 = roomDateKey('room-A', '2026-03-10')
    const key2 = roomDateKey('room-B', '2026-03-10')
    expect(key1).not.toBe(key2)
    expect(key1).toBe('room-A:2026-03-10')
    expect(key2).toBe('room-B:2026-03-10')
  })

  it('handles same room ID with different dates', () => {
    const key1 = roomDateKey('room-123', '2026-03-10')
    const key2 = roomDateKey('room-123', '2026-03-11')
    expect(key1).not.toBe(key2)
    expect(key1).toBe('room-123:2026-03-10')
    expect(key2).toBe('room-123:2026-03-11')
  })
})

describe('buildAssignmentMap', () => {
  it('returns empty map when given empty arrays', () => {
    const map = buildAssignmentMap([], [])
    expect(map).toEqual({})
  })

  it('builds map from surgeon assignments only', () => {
    const assignments: RoomDateAssignment[] = [
      {
        id: 'assign-1',
        facility_id: 'fac-1',
        or_room_id: 'room-A',
        assignment_date: '2026-03-10',
        surgeon_id: 'surgeon-1',
        notes: null,
        created_by: null,
        created_at: '2026-03-09T12:00:00Z',
        updated_at: '2026-03-09T12:00:00Z',
        surgeon: {
          id: 'surgeon-1',
          first_name: 'Jane',
          last_name: 'Smith',
        },
      },
    ]

    const map = buildAssignmentMap(assignments, [])
    expect(map['room-A:2026-03-10']).toBeDefined()
    expect(map['room-A:2026-03-10'].surgeons).toHaveLength(1)
    expect(map['room-A:2026-03-10'].staff).toHaveLength(0)
    expect(map['room-A:2026-03-10'].surgeons[0].surgeon?.first_name).toBe('Jane')
  })

  it('builds map from staff assignments only', () => {
    const staffAssignments: RoomDateStaff[] = [
      {
        id: 'staff-1',
        room_date_assignment_id: null,
        facility_id: 'fac-1',
        or_room_id: 'room-B',
        assignment_date: '2026-03-11',
        user_id: 'user-1',
        role_id: 'role-nurse',
        created_at: '2026-03-09T12:00:00Z',
        user: {
          id: 'user-1',
          first_name: 'Alice',
          last_name: 'Jones',
        },
        role: {
          id: 'role-nurse',
          name: 'Nurse',
        },
      },
    ]

    const map = buildAssignmentMap([], staffAssignments)
    expect(map['room-B:2026-03-11']).toBeDefined()
    expect(map['room-B:2026-03-11'].surgeons).toHaveLength(0)
    expect(map['room-B:2026-03-11'].staff).toHaveLength(1)
    expect(map['room-B:2026-03-11'].staff[0].user?.first_name).toBe('Alice')
  })

  it('merges surgeon and staff assignments for same room-date cell', () => {
    const assignments: RoomDateAssignment[] = [
      {
        id: 'assign-1',
        facility_id: 'fac-1',
        or_room_id: 'room-C',
        assignment_date: '2026-03-12',
        surgeon_id: 'surgeon-1',
        notes: null,
        created_by: null,
        created_at: '2026-03-09T12:00:00Z',
        updated_at: '2026-03-09T12:00:00Z',
      },
    ]

    const staffAssignments: RoomDateStaff[] = [
      {
        id: 'staff-1',
        room_date_assignment_id: 'assign-1',
        facility_id: 'fac-1',
        or_room_id: 'room-C',
        assignment_date: '2026-03-12',
        user_id: 'user-1',
        role_id: 'role-nurse',
        created_at: '2026-03-09T12:00:00Z',
      },
    ]

    const map = buildAssignmentMap(assignments, staffAssignments)
    expect(map['room-C:2026-03-12']).toBeDefined()
    expect(map['room-C:2026-03-12'].surgeons).toHaveLength(1)
    expect(map['room-C:2026-03-12'].staff).toHaveLength(1)
  })

  it('handles multiple surgeons assigned to same room-date', () => {
    const assignments: RoomDateAssignment[] = [
      {
        id: 'assign-1',
        facility_id: 'fac-1',
        or_room_id: 'room-D',
        assignment_date: '2026-03-13',
        surgeon_id: 'surgeon-1',
        notes: null,
        created_by: null,
        created_at: '2026-03-09T12:00:00Z',
        updated_at: '2026-03-09T12:00:00Z',
      },
      {
        id: 'assign-2',
        facility_id: 'fac-1',
        or_room_id: 'room-D',
        assignment_date: '2026-03-13',
        surgeon_id: 'surgeon-2',
        notes: null,
        created_by: null,
        created_at: '2026-03-09T12:30:00Z',
        updated_at: '2026-03-09T12:30:00Z',
      },
    ]

    const map = buildAssignmentMap(assignments, [])
    expect(map['room-D:2026-03-13'].surgeons).toHaveLength(2)
  })

  it('handles multiple staff members assigned to same room-date', () => {
    const staffAssignments: RoomDateStaff[] = [
      {
        id: 'staff-1',
        room_date_assignment_id: null,
        facility_id: 'fac-1',
        or_room_id: 'room-E',
        assignment_date: '2026-03-14',
        user_id: 'user-1',
        role_id: 'role-nurse',
        created_at: '2026-03-09T12:00:00Z',
      },
      {
        id: 'staff-2',
        room_date_assignment_id: null,
        facility_id: 'fac-1',
        or_room_id: 'room-E',
        assignment_date: '2026-03-14',
        user_id: 'user-2',
        role_id: 'role-tech',
        created_at: '2026-03-09T12:15:00Z',
      },
    ]

    const map = buildAssignmentMap([], staffAssignments)
    expect(map['room-E:2026-03-14'].staff).toHaveLength(2)
  })

  it('creates separate cells for different room-date combinations', () => {
    const assignments: RoomDateAssignment[] = [
      {
        id: 'assign-1',
        facility_id: 'fac-1',
        or_room_id: 'room-A',
        assignment_date: '2026-03-10',
        surgeon_id: 'surgeon-1',
        notes: null,
        created_by: null,
        created_at: '2026-03-09T12:00:00Z',
        updated_at: '2026-03-09T12:00:00Z',
      },
      {
        id: 'assign-2',
        facility_id: 'fac-1',
        or_room_id: 'room-A',
        assignment_date: '2026-03-11',
        surgeon_id: 'surgeon-2',
        notes: null,
        created_by: null,
        created_at: '2026-03-09T12:00:00Z',
        updated_at: '2026-03-09T12:00:00Z',
      },
      {
        id: 'assign-3',
        facility_id: 'fac-1',
        or_room_id: 'room-B',
        assignment_date: '2026-03-10',
        surgeon_id: 'surgeon-3',
        notes: null,
        created_by: null,
        created_at: '2026-03-09T12:00:00Z',
        updated_at: '2026-03-09T12:00:00Z',
      },
    ]

    const map = buildAssignmentMap(assignments, [])
    expect(Object.keys(map)).toHaveLength(3)
    expect(map['room-A:2026-03-10']).toBeDefined()
    expect(map['room-A:2026-03-11']).toBeDefined()
    expect(map['room-B:2026-03-10']).toBeDefined()
  })
})
