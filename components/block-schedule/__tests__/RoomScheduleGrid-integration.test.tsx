// components/block-schedule/__tests__/RoomScheduleGrid-integration.test.tsx
// Integration test: RoomScheduleGrid with assignment data and navigation
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'
import { RoomScheduleGrid } from '../RoomScheduleGrid'
import type { RoomDateAssignment, RoomDateStaff } from '@/types/room-scheduling'

// Mock hooks
vi.mock('@/hooks/useLookups', () => ({
  useRooms: vi.fn(),
}))

import { useRooms } from '@/hooks/useLookups'

const sundayMarch9 = new Date(2026, 2, 9)

const threeRooms = [
  { id: 'room-1', name: 'OR 1' },
  { id: 'room-2', name: 'OR 2' },
  { id: 'room-3', name: 'OR 3' },
]

const sampleAssignments: RoomDateAssignment[] = [
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
    surgeon: { id: 'surg-1', last_name: 'Smith', first_name: 'John' },
  },
  {
    id: 'asgn-2',
    facility_id: 'fac-1',
    or_room_id: 'room-1',
    assignment_date: '2026-03-11',
    surgeon_id: 'surg-2',
    notes: null,
    created_by: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    surgeon: { id: 'surg-2', last_name: 'Johnson', first_name: 'Sarah' },
  },
  {
    id: 'asgn-3',
    facility_id: 'fac-1',
    or_room_id: 'room-2',
    assignment_date: '2026-03-10',
    surgeon_id: 'surg-1',
    notes: null,
    created_by: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    surgeon: { id: 'surg-1', last_name: 'Smith', first_name: 'John' },
  },
]

const sampleStaff: RoomDateStaff[] = [
  {
    id: 'staff-1',
    room_date_assignment_id: null,
    facility_id: 'fac-1',
    or_room_id: 'room-1',
    assignment_date: '2026-03-10',
    user_id: 'user-1',
    role_id: 'role-1',
    created_at: '2026-03-01T00:00:00Z',
    user: { id: 'user-1', first_name: 'Jane', last_name: 'Doe' },
    role: { id: 'role-1', name: 'RN' },
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
    user: { id: 'user-2', first_name: 'Bob', last_name: 'Wilson' },
    role: { id: 'role-2', name: 'ST' },
  },
]

interface GridTestProps {
  facilityId?: string | null
  currentWeekStart?: Date
  onWeekChange?: ReturnType<typeof vi.fn>
  assignments?: RoomDateAssignment[]
  staffAssignments?: RoomDateStaff[]
  assignmentsLoading?: boolean
  assignmentsError?: string | null
}

function renderGrid(overrides: GridTestProps = {}) {
  const onWeekChange = (overrides.onWeekChange ?? vi.fn()) as unknown as (weekStart: Date) => void
  return render(
    <DndContext>
      <RoomScheduleGrid
        facilityId={overrides.facilityId ?? 'fac-1'}
        currentWeekStart={overrides.currentWeekStart ?? sundayMarch9}
        onWeekChange={onWeekChange}
        assignments={overrides.assignments ?? sampleAssignments}
        staffAssignments={overrides.staffAssignments ?? sampleStaff}
        assignmentsLoading={overrides.assignmentsLoading ?? false}
        assignmentsError={overrides.assignmentsError ?? null}
      />
    </DndContext>
  )
}

describe('RoomScheduleGrid — Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useRooms).mockReturnValue({
      data: threeRooms,
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
  })

  describe('data integration', () => {
    it('displays assignments in correct cells', () => {
      renderGrid()

      // OR 1, Monday (Mar 10): Dr. Smith + 2 staff
      expect(screen.getByText(/J\. Doe/)).toBeDefined()
      expect(screen.getByText(/B\. Wilson/)).toBeDefined()

      // OR 1, Tuesday (Mar 11): Dr. Johnson
      expect(screen.getByText('Dr. Johnson')).toBeDefined()

      // OR 2, Monday (Mar 10): Dr. Smith (appears twice total)
      const smithCells = screen.getAllByText('Dr. Smith')
      expect(smithCells.length).toBe(2)
    })

    it('renders empty cells for days with no assignments', () => {
      renderGrid()

      // 3 rooms x 7 days = 21 cells
      // 3 cells have data (OR1 Mon, OR1 Tue, OR2 Mon)
      // 18 cells should be empty
      const emptyCells = screen.getAllByText('—')
      expect(emptyCells.length).toBe(18)
    })
  })

  describe('workflow: navigate weeks and view assignments', () => {
    it('user navigates to next week', async () => {
      const user = userEvent.setup()
      const onWeekChange = vi.fn()
      renderGrid({ onWeekChange })

      await user.click(screen.getByRole('button', { name: /Next week/i }))

      expect(onWeekChange).toHaveBeenCalledOnce()
      const calledDate = onWeekChange.mock.calls[0][0]
      expect(calledDate.getTime()).toBe(new Date(2026, 2, 16).getTime())
    })

    it('user navigates to previous week', async () => {
      const user = userEvent.setup()
      const onWeekChange = vi.fn()
      renderGrid({ onWeekChange })

      await user.click(screen.getByRole('button', { name: /Previous week/i }))

      expect(onWeekChange).toHaveBeenCalledOnce()
      const calledDate = onWeekChange.mock.calls[0][0]
      expect(calledDate.getTime()).toBe(new Date(2026, 2, 2).getTime())
    })

    it('user clicks Today to jump to current week', async () => {
      const user = userEvent.setup()
      const onWeekChange = vi.fn()
      renderGrid({ onWeekChange, currentWeekStart: new Date(2026, 11, 6) })

      await user.click(screen.getByRole('button', { name: /Today/i }))

      expect(onWeekChange).toHaveBeenCalledOnce()
      const calledDate = onWeekChange.mock.calls[0][0]
      expect(calledDate.getDay()).toBe(0) // Sunday
    })
  })

  describe('error handling', () => {
    it('displays error from props', () => {
      renderGrid({ assignmentsError: 'Database connection failed' })
      expect(screen.getByText('Database connection failed')).toBeDefined()
    })

    it('still renders grid structure when error exists', () => {
      renderGrid({ assignmentsError: 'Failed to load' })
      expect(screen.getByText('OR 1')).toBeDefined()
      expect(screen.getByText('OR 2')).toBeDefined()
      expect(screen.getByText('OR 3')).toBeDefined()
    })
  })

  describe('loading state integration', () => {
    it('shows spinner while assignments are loading', () => {
      const { container } = renderGrid({ assignmentsLoading: true })
      expect(container.querySelector('.animate-spin')).toBeDefined()
    })

    it('hides spinner when loading completes', () => {
      const { container } = renderGrid()
      expect(container.querySelector('.animate-spin')).toBeNull()
    })
  })

  describe('multi-surgeon same day', () => {
    it('displays multiple surgeons assigned to same room-date', () => {
      renderGrid({
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
            surgeon: { id: 'surg-1', last_name: 'Smith', first_name: 'John' },
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
            surgeon: { id: 'surg-2', last_name: 'Johnson', first_name: 'Sarah' },
          },
        ],
        staffAssignments: [],
      })

      expect(screen.getByText('Dr. Smith')).toBeDefined()
      expect(screen.getByText('Dr. Johnson')).toBeDefined()
    })
  })

  describe('cross-week boundary', () => {
    it('handles week that spans two months', () => {
      renderGrid({ currentWeekStart: new Date(2026, 2, 30) })
      expect(screen.getByText('March – April 2026')).toBeDefined()
    })
  })
})
