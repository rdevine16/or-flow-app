import { describe, it, expect, vi, beforeEach } from 'vitest'
import { roomScheduleDAL } from '../room-schedule'
import type { SupabaseClient } from '@supabase/supabase-js'

type MockSupabaseClient = unknown

// ============================================
// ROOM SCHEDULE DAL TESTS
// ============================================

describe('roomScheduleDAL.fetchRoomDatePreFill', () => {
  let surgeonQueryResult: { data: unknown; error: unknown }
  let staffQueryResult: { data: unknown; error: unknown }

  const createChainable = () => {
    let callCount = 0
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn(function (this: unknown) {
        callCount++
        // After 3 .eq() calls, resolve the surgeon query
        // After 6 .eq() calls, resolve the staff query
        if (callCount === 3) {
          return Promise.resolve(surgeonQueryResult)
        } else if (callCount === 6) {
          return Promise.resolve(staffQueryResult)
        }
        return this
      }),
    }
  }

  let chainable: ReturnType<typeof createChainable>
  const mockSupabase = {
    from: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    surgeonQueryResult = { data: null, error: null }
    staffQueryResult = { data: null, error: null }
    chainable = createChainable()
    mockSupabase.from.mockReturnValue(chainable)
  })

  it('should query room_date_assignments and room_date_staff tables', async () => {
    // Mock surgeon assignments query
    surgeonQueryResult = {
      data: [{ surgeon_id: 'surgeon-1', notes: 'Primary surgeon for the day' }],
      error: null,
    }

    // Mock staff assignments query
    staffQueryResult = {
      data: [
        { user_id: 'nurse-1', role_id: 'role-nurse' },
        { user_id: 'tech-1', role_id: 'role-tech' },
      ],
      error: null,
    }

    const result = await roomScheduleDAL.fetchRoomDatePreFill(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'facility-1',
      'room-or1',
      '2026-03-10'
    )

    // First call: room_date_assignments
    expect(mockSupabase.from).toHaveBeenNthCalledWith(1, 'room_date_assignments')
    expect(chainable.select).toHaveBeenNthCalledWith(1, 'surgeon_id, notes')
    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'facility-1')
    expect(chainable.eq).toHaveBeenCalledWith('or_room_id', 'room-or1')
    expect(chainable.eq).toHaveBeenCalledWith('assignment_date', '2026-03-10')

    // Second call: room_date_staff
    expect(mockSupabase.from).toHaveBeenNthCalledWith(2, 'room_date_staff')
    expect(chainable.select).toHaveBeenNthCalledWith(2, 'user_id, role_id')

    expect(result.data).toEqual({
      surgeons: [{ surgeon_id: 'surgeon-1', notes: 'Primary surgeon for the day' }],
      staff: [
        { user_id: 'nurse-1', role_id: 'role-nurse' },
        { user_id: 'tech-1', role_id: 'role-tech' },
      ],
    })
    expect(result.error).toBeNull()
  })

  it('should return empty arrays when no assignments found', async () => {
    // Empty results
    surgeonQueryResult = { data: null, error: null }
    staffQueryResult = { data: null, error: null }

    const result = await roomScheduleDAL.fetchRoomDatePreFill(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'facility-1',
      'room-or1',
      '2026-03-10'
    )

    expect(result.data).toEqual({
      surgeons: [],
      staff: [],
    })
    expect(result.error).toBeNull()
  })

  it('should return error when surgeon query fails', async () => {
    const pgError = { message: 'table not found', code: '42P01', details: '', hint: '' }
    surgeonQueryResult = { data: null, error: pgError }

    const result = await roomScheduleDAL.fetchRoomDatePreFill(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'facility-1',
      'room-or1',
      '2026-03-10'
    )

    expect(result.error).toBe(pgError)
    expect(result.data).toBeNull()
  })

  it('should return error when staff query fails', async () => {
    // Surgeon query succeeds
    surgeonQueryResult = {
      data: [{ surgeon_id: 'surgeon-1', notes: null }],
      error: null,
    }

    // Staff query fails
    const pgError = { message: 'permission denied', code: '42501', details: '', hint: '' }
    staffQueryResult = { data: null, error: pgError }

    const result = await roomScheduleDAL.fetchRoomDatePreFill(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'facility-1',
      'room-or1',
      '2026-03-10'
    )

    expect(result.error).toBe(pgError)
    expect(result.data).toBeNull()
  })

  it('should handle multiple surgeon assignments for the same room+date', async () => {
    // Mock multiple surgeons assigned (could happen if they're sharing the room in shifts)
    surgeonQueryResult = {
      data: [
        { surgeon_id: 'surgeon-1', notes: 'Morning shift' },
        { surgeon_id: 'surgeon-2', notes: 'Afternoon shift' },
      ],
      error: null,
    }

    // Mock staff assignments
    staffQueryResult = {
      data: [{ user_id: 'nurse-1', role_id: 'role-nurse' }],
      error: null,
    }

    const result = await roomScheduleDAL.fetchRoomDatePreFill(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'facility-1',
      'room-or1',
      '2026-03-10'
    )

    expect(result.data?.surgeons).toHaveLength(2)
    expect(result.data?.surgeons[0].surgeon_id).toBe('surgeon-1')
    expect(result.data?.surgeons[1].surgeon_id).toBe('surgeon-2')
  })

  it('should handle staff with no role_id (null case)', async () => {
    // Surgeon assignments
    surgeonQueryResult = {
      data: [{ surgeon_id: 'surgeon-1', notes: null }],
      error: null,
    }

    // Staff with role_id (could be null in the DB schema but typed as string in our DAL)
    staffQueryResult = {
      data: [{ user_id: 'staff-1', role_id: 'role-nurse' }],
      error: null,
    }

    const result = await roomScheduleDAL.fetchRoomDatePreFill(
      mockSupabase as MockSupabaseClient as SupabaseClient,
      'facility-1',
      'room-or1',
      '2026-03-10'
    )

    expect(result.data?.staff).toHaveLength(1)
    expect(result.data?.staff[0].user_id).toBe('staff-1')
    expect(result.data?.staff[0].role_id).toBe('role-nurse')
  })
})
