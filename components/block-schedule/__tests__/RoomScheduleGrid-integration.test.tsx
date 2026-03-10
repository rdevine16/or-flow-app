// components/block-schedule/__tests__/RoomScheduleGrid-integration.test.tsx
// Integration test: RoomScheduleGrid → PageClient → data fetching
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoomScheduleGrid } from '../RoomScheduleGrid'

// Mock hooks with more realistic data
vi.mock('@/hooks/useLookups', () => ({
  useRooms: vi.fn(),
}))

vi.mock('@/hooks/useRoomDateAssignments', () => ({
  useRoomDateAssignments: vi.fn(),
}))

import { useRooms } from '@/hooks/useLookups'
import { useRoomDateAssignments } from '@/hooks/useRoomDateAssignments'

describe('RoomScheduleGrid — Integration', () => {
  const mockFetchWeek = vi.fn()
  const mockOnWeekChange = vi.fn()
  const sundayMarch9 = new Date(2026, 2, 9)

  beforeEach(() => {
    vi.clearAllMocks()

    // Realistic room data
    vi.mocked(useRooms).mockReturnValue({
      data: [
        { id: 'room-1', name: 'OR 1', facility_id: 'fac-1' },
        { id: 'room-2', name: 'OR 2', facility_id: 'fac-1' },
        { id: 'room-3', name: 'OR 3', facility_id: 'fac-1' },
      ],
      loading: false,
    })

    // Realistic assignment data
    vi.mocked(useRoomDateAssignments).mockReturnValue({
      assignments: [
        {
          id: 'asgn-1',
          facility_id: 'fac-1',
          or_room_id: 'room-1',
          assignment_date: '2026-03-10', // Monday
          surgeon_id: 'surg-1',
          notes: null,
          created_by: null,
          created_at: '2026-03-01T00:00:00Z',
          updated_at: '2026-03-01T00:00:00Z',
          surgeon: {
            id: 'surg-1',
            last_name: 'Smith',
            first_name: 'John',
          },
        },
        {
          id: 'asgn-2',
          facility_id: 'fac-1',
          or_room_id: 'room-1',
          assignment_date: '2026-03-11', // Tuesday
          surgeon_id: 'surg-2',
          notes: null,
          created_by: null,
          created_at: '2026-03-01T00:00:00Z',
          updated_at: '2026-03-01T00:00:00Z',
          surgeon: {
            id: 'surg-2',
            last_name: 'Johnson',
            first_name: 'Sarah',
          },
        },
        {
          id: 'asgn-3',
          facility_id: 'fac-1',
          or_room_id: 'room-2',
          assignment_date: '2026-03-10', // Monday
          surgeon_id: 'surg-1',
          notes: null,
          created_by: null,
          created_at: '2026-03-01T00:00:00Z',
          updated_at: '2026-03-01T00:00:00Z',
          surgeon: {
            id: 'surg-1',
            last_name: 'Smith',
            first_name: 'John',
          },
        },
      ],
      staffAssignments: [
        {
          id: 'staff-1',
          room_date_assignment_id: null,
          facility_id: 'fac-1',
          or_room_id: 'room-1',
          assignment_date: '2026-03-10',
          user_id: 'user-1',
          role_id: 'role-1',
          created_at: '2026-03-01T00:00:00Z',
          user: {
            id: 'user-1',
            first_name: 'Jane',
            last_name: 'Doe',
          },
          role: {
            id: 'role-1',
            name: 'RN',
          },
        },
        {
          id: 'staff-2',
          room_date_assignment_id: null,
          facility_id: 'fac-1',
          or_room_id: 'room-1',
          assignment_date: '2026-03-10',
          user_id: 'user-2',
          role_id: 'role-2',
          created_at: '2026-03-01T00:00:00Z',
          user: {
            id: 'user-2',
            first_name: 'Bob',
            last_name: 'Wilson',
          },
          role: {
            id: 'role-2',
            name: 'ST',
          },
        },
      ],
      loading: false,
      error: null,
      fetchWeek: mockFetchWeek,
      assignSurgeon: vi.fn(),
      removeSurgeon: vi.fn(),
      assignStaff: vi.fn(),
      removeStaff: vi.fn(),
      cloneDay: vi.fn(),
      cloneWeek: vi.fn(),
    })
  })

  describe('data integration', () => {
    it('displays assignments in correct cells', () => {
      render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      // OR 1, Monday (Mar 10): Dr. Smith + 2 staff
      expect(screen.getByText(/J\. Doe/)).toBeDefined()
      expect(screen.getByText(/B\. Wilson/)).toBeDefined()

      // OR 1, Tuesday (Mar 11): Dr. Johnson
      expect(screen.getByText('Dr. Johnson')).toBeDefined()

      // OR 2, Monday (Mar 10): Dr. Smith (appears twice total)
      const smithCells = screen.getAllByText('Dr. Smith')
      expect(smithCells.length).toBe(2) // Appears in OR 1 Mon + OR 2 Mon
    })

    it('renders empty cells for days with no assignments', () => {
      render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      // 3 rooms x 7 days = 21 cells
      // 3 cells have data (OR1 Mon, OR1 Tue, OR2 Mon)
      // 18 cells should be empty
      const emptyCells = screen.getAllByText('—')
      expect(emptyCells.length).toBe(18)
    })

    it('fetches week data on mount', async () => {
      render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      await waitFor(() => {
        expect(mockFetchWeek).toHaveBeenCalledOnce()
        expect(mockFetchWeek).toHaveBeenCalledWith('2026-03-09', '2026-03-15')
      })
    })

    it('refetches when week changes', async () => {
      const { rerender } = render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      await waitFor(() => {
        expect(mockFetchWeek).toHaveBeenCalledWith('2026-03-09', '2026-03-15')
      })

      mockFetchWeek.mockClear()

      const sundayMarch16 = new Date(2026, 2, 16)
      rerender(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch16}
          onWeekChange={mockOnWeekChange}
        />
      )

      await waitFor(() => {
        expect(mockFetchWeek).toHaveBeenCalledWith('2026-03-16', '2026-03-22')
      })
    })
  })

  describe('workflow: navigate weeks and view assignments', () => {
    it('user navigates to next week', async () => {
      const user = userEvent.setup()
      render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      const nextButton = screen.getByRole('button', { name: /Next week/i })
      await user.click(nextButton)

      expect(mockOnWeekChange).toHaveBeenCalledOnce()
      const calledDate = mockOnWeekChange.mock.calls[0][0]
      expect(calledDate.getTime()).toBe(new Date(2026, 2, 16).getTime())
    })

    it('user navigates to previous week', async () => {
      const user = userEvent.setup()
      render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      const prevButton = screen.getByRole('button', { name: /Previous week/i })
      await user.click(prevButton)

      expect(mockOnWeekChange).toHaveBeenCalledOnce()
      const calledDate = mockOnWeekChange.mock.calls[0][0]
      expect(calledDate.getTime()).toBe(new Date(2026, 2, 2).getTime())
    })

    it('user clicks Today to jump to current week', async () => {
      const user = userEvent.setup()
      const futureWeek = new Date(2026, 11, 6) // Dec 6, 2026
      render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={futureWeek}
          onWeekChange={mockOnWeekChange}
        />
      )

      const todayButton = screen.getByRole('button', { name: /Today/i })
      await user.click(todayButton)

      expect(mockOnWeekChange).toHaveBeenCalledOnce()
      const calledDate = mockOnWeekChange.mock.calls[0][0]
      expect(calledDate.getDay()).toBe(0) // Should be a Sunday
    })
  })

  describe('error handling', () => {
    it('displays error from hook', () => {
      vi.mocked(useRoomDateAssignments).mockReturnValue({
        assignments: [],
        staffAssignments: [],
        loading: false,
        error: 'Database connection failed',
        fetchWeek: mockFetchWeek,
        assignSurgeon: vi.fn(),
        removeSurgeon: vi.fn(),
        assignStaff: vi.fn(),
        removeStaff: vi.fn(),
        cloneDay: vi.fn(),
        cloneWeek: vi.fn(),
      })

      render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      expect(screen.getByText('Database connection failed')).toBeDefined()
    })

    it('still renders grid structure when error exists', () => {
      vi.mocked(useRoomDateAssignments).mockReturnValue({
        assignments: [],
        staffAssignments: [],
        loading: false,
        error: 'Failed to load',
        fetchWeek: mockFetchWeek,
        assignSurgeon: vi.fn(),
        removeSurgeon: vi.fn(),
        assignStaff: vi.fn(),
        removeStaff: vi.fn(),
        cloneDay: vi.fn(),
        cloneWeek: vi.fn(),
      })

      render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      // Grid should still render
      expect(screen.getByText('OR 1')).toBeDefined()
      expect(screen.getByText('OR 2')).toBeDefined()
      expect(screen.getByText('OR 3')).toBeDefined()
    })
  })

  describe('loading state integration', () => {
    it('shows spinner while both rooms and assignments load', () => {
      vi.mocked(useRooms).mockReturnValue({
        data: [],
        loading: true,
      })

      vi.mocked(useRoomDateAssignments).mockReturnValue({
        assignments: [],
        staffAssignments: [],
        loading: true,
        error: null,
        fetchWeek: mockFetchWeek,
        assignSurgeon: vi.fn(),
        removeSurgeon: vi.fn(),
        assignStaff: vi.fn(),
        removeStaff: vi.fn(),
        cloneDay: vi.fn(),
        cloneWeek: vi.fn(),
      })

      const { container } = render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      expect(container.querySelector('.animate-spin')).toBeDefined()
    })

    it('hides spinner when both loads complete', () => {
      const { container } = render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      expect(container.querySelector('.animate-spin')).toBeNull()
    })
  })

  describe('multi-surgeon same day', () => {
    it('displays multiple surgeons assigned to same room-date', () => {
      vi.mocked(useRoomDateAssignments).mockReturnValue({
        assignments: [
          {
            id: 'asgn-1',
            facility_id: 'fac-1',
            or_room_id: 'room-1',
            assignment_date: '2026-03-10',
            surgeon_id: 'surg-1',
            notes: null,
            created_by: null,
            created_at: '2026-03-01T00:00:00Z',
            updated_at: '2026-03-01T00:00:00Z',
            surgeon: {
              id: 'surg-1',
              last_name: 'Smith',
              first_name: 'John',
            },
          },
          {
            id: 'asgn-2',
            facility_id: 'fac-1',
            or_room_id: 'room-1',
            assignment_date: '2026-03-10',
            surgeon_id: 'surg-2',
            notes: null,
            created_by: null,
            created_at: '2026-03-01T00:00:00Z',
            updated_at: '2026-03-01T00:00:00Z',
            surgeon: {
              id: 'surg-2',
              last_name: 'Johnson',
              first_name: 'Sarah',
            },
          },
        ],
        staffAssignments: [],
        loading: false,
        error: null,
        fetchWeek: mockFetchWeek,
        assignSurgeon: vi.fn(),
        removeSurgeon: vi.fn(),
        assignStaff: vi.fn(),
        removeStaff: vi.fn(),
        cloneDay: vi.fn(),
        cloneWeek: vi.fn(),
      })

      render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      expect(screen.getByText('Dr. Smith')).toBeDefined()
      expect(screen.getByText('Dr. Johnson')).toBeDefined()
    })
  })

  describe('cross-week boundary', () => {
    it('handles week that spans two months', () => {
      // Sun March 30 - Sat April 5, 2026
      const sundayMarch30 = new Date(2026, 2, 30)
      render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch30}
          onWeekChange={mockOnWeekChange}
        />
      )

      expect(screen.getByText('March – April 2026')).toBeDefined()
    })

    it('fetches correct date range for cross-month week', async () => {
      const sundayMarch30 = new Date(2026, 2, 30)
      render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch30}
          onWeekChange={mockOnWeekChange}
        />
      )

      await waitFor(() => {
        expect(mockFetchWeek).toHaveBeenCalledWith('2026-03-30', '2026-04-05')
      })
    })
  })
})
