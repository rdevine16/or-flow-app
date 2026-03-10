// hooks/__tests__/useRoomDateAssignments.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useRoomDateAssignments } from '../useRoomDateAssignments'
import type { SupabaseClient } from '@supabase/supabase-js'

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}))

// Mock audit logger
vi.mock('@/lib/audit-logger', () => ({
  roomScheduleAudit: {
    surgeonAssigned: vi.fn(),
    surgeonRemoved: vi.fn(),
    staffAssigned: vi.fn(),
    staffRemoved: vi.fn(),
    dayCloned: vi.fn(),
    weekCloned: vi.fn(),
  },
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  })),
}))

let mockSupabaseClient: Partial<SupabaseClient>
let mockFrom: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockFrom = vi.fn()
  mockSupabaseClient = {
    from: mockFrom,
  } as Partial<SupabaseClient>
})

describe('useRoomDateAssignments', () => {
  describe('initialization', () => {
    it('returns expected interface shape', () => {
      const { result } = renderHook(() =>
        useRoomDateAssignments({ facilityId: 'fac-1' })
      )

      expect(result.current).toHaveProperty('loading')
      expect(result.current).toHaveProperty('error')
      expect(result.current).toHaveProperty('assignments')
      expect(result.current).toHaveProperty('staffAssignments')
      expect(result.current).toHaveProperty('fetchWeek')
      expect(result.current).toHaveProperty('assignSurgeon')
      expect(result.current).toHaveProperty('removeSurgeon')
      expect(result.current).toHaveProperty('assignStaff')
      expect(result.current).toHaveProperty('removeStaff')
      expect(result.current).toHaveProperty('cloneDay')
      expect(result.current).toHaveProperty('cloneWeek')
    })

    it('initializes with empty assignments and no error', () => {
      const { result } = renderHook(() =>
        useRoomDateAssignments({ facilityId: 'fac-1' })
      )

      expect(result.current.assignments).toEqual([])
      expect(result.current.staffAssignments).toEqual([])
      expect(result.current.error).toBeNull()
      expect(result.current.loading).toBe(false)
    })

    it('accepts null facilityId', () => {
      const { result } = renderHook(() =>
        useRoomDateAssignments({ facilityId: null })
      )

      expect(result.current).toBeDefined()
      expect(result.current.assignments).toEqual([])
    })
  })

  describe('fetchWeek', () => {
    it('does not fetch if facilityId is null', async () => {
      const { result } = renderHook(() =>
        useRoomDateAssignments({ facilityId: null })
      )

      await result.current.fetchWeek('2026-03-10', '2026-03-16')

      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('queries room_date_assignments and room_date_staff tables', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockGte = vi.fn().mockReturnThis()
      const mockLte = vi.fn().mockReturnThis()
      const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null })

      mockFrom.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        gte: mockGte,
        lte: mockLte,
        order: mockOrder,
      })

      const { result } = renderHook(() =>
        useRoomDateAssignments({ facilityId: 'fac-1' })
      )

      await result.current.fetchWeek('2026-03-10', '2026-03-16')

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Should call .from() twice: once for assignments, once for staff
      expect(mockFrom).toHaveBeenCalledWith('room_date_assignments')
      expect(mockFrom).toHaveBeenCalledWith('room_date_staff')
    })

    it('filters by facility_id and date range', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockGte = vi.fn().mockReturnThis()
      const mockLte = vi.fn().mockReturnThis()
      const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null })

      mockFrom.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        gte: mockGte,
        lte: mockLte,
        order: mockOrder,
      })

      const { result } = renderHook(() =>
        useRoomDateAssignments({ facilityId: 'fac-123' })
      )

      await result.current.fetchWeek('2026-03-10', '2026-03-16')

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(mockEq).toHaveBeenCalledWith('facility_id', 'fac-123')
      expect(mockGte).toHaveBeenCalledWith('assignment_date', '2026-03-10')
      expect(mockLte).toHaveBeenCalledWith('assignment_date', '2026-03-16')
    })

    it('sets loading state during fetch', async () => {
      let resolveFetch: ((value: { data: []; error: null }) => void) | undefined
      const fetchPromise = new Promise<{ data: []; error: null }>((resolve) => {
        resolveFetch = resolve
      })

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockGte = vi.fn().mockReturnThis()
      const mockLte = vi.fn().mockReturnThis()
      const mockOrder = vi.fn().mockReturnValue(fetchPromise)

      mockFrom.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        gte: mockGte,
        lte: mockLte,
        order: mockOrder,
      })

      const { result } = renderHook(() =>
        useRoomDateAssignments({ facilityId: 'fac-1' })
      )

      expect(result.current.loading).toBe(false)

      const fetchPromiseResult = result.current.fetchWeek('2026-03-10', '2026-03-16')

      await waitFor(() => {
        expect(result.current.loading).toBe(true)
      })

      resolveFetch?.({ data: [], error: null })
      await fetchPromiseResult

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })
  })

  describe('assignSurgeon', () => {
    it('returns null if facilityId is null', async () => {
      const { result } = renderHook(() =>
        useRoomDateAssignments({ facilityId: null })
      )

      const assignment = await result.current.assignSurgeon({
        or_room_id: 'room-1',
        assignment_date: '2026-03-10',
        surgeon_id: 'surgeon-1',
      })

      expect(assignment).toBeNull()
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('inserts assignment with facility_id scoping', async () => {
      const mockInsert = vi.fn().mockReturnThis()
      const mockSelect = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'new-assign-1',
            facility_id: 'fac-1',
            or_room_id: 'room-1',
            assignment_date: '2026-03-10',
            surgeon_id: 'surgeon-1',
          },
        ],
        error: null,
      })

      mockFrom.mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
      })

      const { result } = renderHook(() =>
        useRoomDateAssignments({ facilityId: 'fac-1' })
      )

      await result.current.assignSurgeon({
        or_room_id: 'room-1',
        assignment_date: '2026-03-10',
        surgeon_id: 'surgeon-1',
        notes: 'Test notes',
      })

      expect(mockFrom).toHaveBeenCalledWith('room_date_assignments')
      expect(mockInsert).toHaveBeenCalledWith({
        facility_id: 'fac-1',
        or_room_id: 'room-1',
        assignment_date: '2026-03-10',
        surgeon_id: 'surgeon-1',
        notes: 'Test notes',
      })
    })
  })

  describe('assignStaff', () => {
    it('returns null if facilityId is null', async () => {
      const { result } = renderHook(() =>
        useRoomDateAssignments({ facilityId: null })
      )

      const staff = await result.current.assignStaff({
        or_room_id: 'room-1',
        assignment_date: '2026-03-10',
        user_id: 'user-1',
        role_id: 'role-nurse',
      })

      expect(staff).toBeNull()
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('inserts staff assignment with facility_id scoping', async () => {
      const mockInsert = vi.fn().mockReturnThis()
      const mockSelect = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'new-staff-1',
            facility_id: 'fac-1',
            or_room_id: 'room-1',
            assignment_date: '2026-03-10',
            user_id: 'user-1',
            role_id: 'role-nurse',
          },
        ],
        error: null,
      })

      mockFrom.mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
      })

      const { result } = renderHook(() =>
        useRoomDateAssignments({ facilityId: 'fac-1' })
      )

      await result.current.assignStaff({
        or_room_id: 'room-1',
        assignment_date: '2026-03-10',
        user_id: 'user-1',
        role_id: 'role-nurse',
      })

      expect(mockFrom).toHaveBeenCalledWith('room_date_staff')
      expect(mockInsert).toHaveBeenCalledWith({
        facility_id: 'fac-1',
        or_room_id: 'room-1',
        assignment_date: '2026-03-10',
        user_id: 'user-1',
        role_id: 'role-nurse',
        room_date_assignment_id: null,
      })
    })
  })

  describe('CRUD operations guard against null facilityId', () => {
    it('removeSurgeon returns false when facilityId is null', async () => {
      const { result } = renderHook(() =>
        useRoomDateAssignments({ facilityId: null })
      )

      const success = await result.current.removeSurgeon('assign-1')
      expect(success).toBe(false)
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('removeStaff returns false when facilityId is null', async () => {
      const { result } = renderHook(() =>
        useRoomDateAssignments({ facilityId: null })
      )

      const success = await result.current.removeStaff('staff-1')
      expect(success).toBe(false)
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('cloneDay returns false when facilityId is null', async () => {
      const { result } = renderHook(() =>
        useRoomDateAssignments({ facilityId: null })
      )

      const success = await result.current.cloneDay('2026-03-10', '2026-03-11')
      expect(success).toBe(false)
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('cloneWeek returns false when facilityId is null', async () => {
      const { result } = renderHook(() =>
        useRoomDateAssignments({ facilityId: null })
      )

      const success = await result.current.cloneWeek('2026-03-10', '2026-03-17')
      expect(success).toBe(false)
      expect(mockFrom).not.toHaveBeenCalled()
    })
  })
})
