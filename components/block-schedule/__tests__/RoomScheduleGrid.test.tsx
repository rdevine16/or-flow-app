// components/block-schedule/__tests__/RoomScheduleGrid.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoomScheduleGrid } from '../RoomScheduleGrid'

// Mock hooks
vi.mock('@/hooks/useLookups', () => ({
  useRooms: vi.fn(),
}))

vi.mock('@/hooks/useRoomDateAssignments', () => ({
  useRoomDateAssignments: vi.fn(),
}))

import { useRooms } from '@/hooks/useLookups'
import { useRoomDateAssignments } from '@/hooks/useRoomDateAssignments'

describe('RoomScheduleGrid', () => {
  const mockOnWeekChange = vi.fn()
  const mockFetchWeek = vi.fn()

  // Helper: Sun March 9, 2026
  const sundayMarch9 = new Date(2026, 2, 9) // Month is 0-indexed

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock: 2 rooms
    vi.mocked(useRooms).mockReturnValue({
      data: [
        { id: 'room-1', name: 'OR 1', facility_id: 'fac-1' },
        { id: 'room-2', name: 'OR 2', facility_id: 'fac-1' },
      ],
      loading: false,
    })

    // Default mock: empty assignments
    vi.mocked(useRoomDateAssignments).mockReturnValue({
      assignments: [],
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
  })

  describe('rendering', () => {
    it('renders week navigation header', () => {
      render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      expect(screen.getByRole('button', { name: /Today/i })).toBeDefined()
      expect(screen.getByRole('button', { name: /Previous week/i })).toBeDefined()
      expect(screen.getByRole('button', { name: /Next week/i })).toBeDefined()
    })

    it('displays correct week header for single-month week', () => {
      render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      expect(screen.getByText('March 2026')).toBeDefined()
    })

    it('displays correct week header for cross-month week', () => {
      // Sun March 30, 2026 → Sat April 5, 2026
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

    it('renders 7 day columns (Sun-Sat)', () => {
      render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      expect(screen.getByText('Sun')).toBeDefined()
      expect(screen.getByText('Mon')).toBeDefined()
      expect(screen.getByText('Tue')).toBeDefined()
      expect(screen.getByText('Wed')).toBeDefined()
      expect(screen.getByText('Thu')).toBeDefined()
      expect(screen.getByText('Fri')).toBeDefined()
      expect(screen.getByText('Sat')).toBeDefined()
    })

    it('renders room rows', () => {
      render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      expect(screen.getByText('OR 1')).toBeDefined()
      expect(screen.getByText('OR 2')).toBeDefined()
    })

    it('renders grid with rooms x days cells', () => {
      const { container } = render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      // 2 rooms x 7 days = 14 RoomDayCell components
      const tbody = container.querySelector('tbody')
      expect(tbody?.querySelectorAll('tr').length).toBe(2) // 2 room rows
      expect(tbody?.querySelectorAll('td').length).toBe(16) // 2 rows * (1 room name + 7 day cells)
    })
  })

  describe('loading state', () => {
    it('shows loading spinner when rooms are loading', () => {
      vi.mocked(useRooms).mockReturnValue({
        data: [],
        loading: true,
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

    it('shows loading spinner when assignments are loading', () => {
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

    it('hides loading spinner when loading completes', () => {
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

  describe('error state', () => {
    it('displays error message when error exists', () => {
      vi.mocked(useRoomDateAssignments).mockReturnValue({
        assignments: [],
        staffAssignments: [],
        loading: false,
        error: 'Failed to load assignments',
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

      expect(screen.getByText('Failed to load assignments')).toBeDefined()
    })

    it('does not display error message when error is null', () => {
      const { container } = render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      expect(container.querySelector('.bg-red-50')).toBeNull()
    })
  })

  describe('empty state', () => {
    it('shows "No rooms configured" when rooms array is empty', () => {
      vi.mocked(useRooms).mockReturnValue({
        data: [],
        loading: false,
      })

      render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      expect(screen.getByText('No rooms configured')).toBeDefined()
      expect(screen.getByText('Add rooms in Settings to start scheduling')).toBeDefined()
    })

    it('does not show empty state while rooms are loading', () => {
      vi.mocked(useRooms).mockReturnValue({
        data: [],
        loading: true,
      })

      render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      expect(screen.queryByText('No rooms configured')).toBeNull()
    })
  })

  describe('week navigation', () => {
    it('calls onWeekChange with previous week when Previous button clicked', async () => {
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
      expect(calledDate.getTime()).toBe(new Date(2026, 2, 2).getTime()) // March 2, 2026
    })

    it('calls onWeekChange with next week when Next button clicked', async () => {
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
      expect(calledDate.getTime()).toBe(new Date(2026, 2, 16).getTime()) // March 16, 2026
    })

    it('calls onWeekChange with start of current week when Today button clicked', async () => {
      const user = userEvent.setup()
      render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={new Date(2026, 1, 1)} // Feb 1, 2026
          onWeekChange={mockOnWeekChange}
        />
      )

      const todayButton = screen.getByRole('button', { name: /Today/i })
      await user.click(todayButton)

      expect(mockOnWeekChange).toHaveBeenCalledOnce()
      const calledDate = mockOnWeekChange.mock.calls[0][0]
      // Should return Sunday of current week (depends on when test runs)
      expect(calledDate.getDay()).toBe(0) // Sunday
    })
  })

  describe('data fetching', () => {
    it('calls fetchWeek on mount with correct date range', async () => {
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

    it('calls fetchWeek when week changes', async () => {
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

    it('builds assignment map from assignments and staff assignments', () => {
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

      render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      // Cell should render both surgeon and staff
      expect(screen.getByText('Dr. Smith')).toBeDefined()
      expect(screen.getByText(/J\. Doe/)).toBeDefined()
    })
  })

  describe('today highlighting', () => {
    it('highlights today column with blue background', () => {
      const { container } = render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      const todayHeaders = container.querySelectorAll('.bg-blue-50')
      expect(todayHeaders.length).toBeGreaterThan(0)
    })

    it('marks today column header with blue text', () => {
      const { container } = render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      const todayHeaders = container.querySelectorAll('.text-blue-600')
      expect(todayHeaders.length).toBeGreaterThan(0)
    })
  })

  describe('facilityId handling', () => {
    it('renders with null facilityId', () => {
      render(
        <RoomScheduleGrid
          facilityId={null}
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      expect(screen.getByRole('button', { name: /Today/i })).toBeDefined()
    })

    it('fetches assignments when facilityId is provided', async () => {
      render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      await waitFor(() => {
        expect(mockFetchWeek).toHaveBeenCalled()
      })
    })
  })

  describe('layout', () => {
    it('applies sticky header to column headers', () => {
      const { container } = render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      const thead = container.querySelector('thead')
      expect(thead?.className).toContain('sticky')
      expect(thead?.className).toContain('top-0')
    })

    it('applies overflow auto to grid container', () => {
      const { container } = render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      const gridContainer = container.querySelector('.overflow-auto')
      expect(gridContainer).toBeDefined()
    })

    it('applies fixed width to room column', () => {
      const { container } = render(
        <RoomScheduleGrid
          facilityId="fac-1"
          currentWeekStart={sundayMarch9}
          onWeekChange={mockOnWeekChange}
        />
      )

      const roomHeader = container.querySelector('th.w-\\[120px\\]')
      expect(roomHeader).toBeDefined()
    })
  })
})
