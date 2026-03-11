// components/block-schedule/__tests__/RoomScheduleGrid.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'
import { RoomScheduleGrid } from '../RoomScheduleGrid'
import type { RoomDateAssignment, RoomDateStaff } from '@/types/room-scheduling'

// Mock hooks
vi.mock('@/hooks/useLookups', () => ({
  useRooms: vi.fn(),
}))

import { useRooms } from '@/hooks/useLookups'

interface GridTestProps {
  facilityId?: string | null
  currentWeekStart?: Date
  onWeekChange?: ReturnType<typeof vi.fn>
  assignments?: RoomDateAssignment[]
  staffAssignments?: RoomDateStaff[]
  assignmentsLoading?: boolean
  assignmentsError?: string | null
  onRemoveSurgeon?: (assignmentId: string) => void
  onRemoveStaff?: (staffId: string) => void
  onCloneWeek?: (sourceWeekStart: string, targetWeekStart: string) => void
  onCloneDay?: (sourceDate: string, targetDate: string) => void
}

function renderGrid(overrides: GridTestProps = {}) {
  const onWeekChange = (overrides.onWeekChange ?? vi.fn()) as unknown as (weekStart: Date) => void
  return render(
    <DndContext>
      <RoomScheduleGrid
        facilityId={overrides.facilityId ?? 'fac-1'}
        currentWeekStart={overrides.currentWeekStart ?? new Date(2026, 2, 9)}
        onWeekChange={onWeekChange}
        assignments={overrides.assignments ?? []}
        staffAssignments={overrides.staffAssignments ?? []}
        assignmentsLoading={overrides.assignmentsLoading ?? false}
        assignmentsError={overrides.assignmentsError ?? null}
        onRemoveSurgeon={overrides.onRemoveSurgeon}
        onRemoveStaff={overrides.onRemoveStaff}
        onCloneWeek={overrides.onCloneWeek}
        onCloneDay={overrides.onCloneDay}
      />
    </DndContext>
  )
}

describe('RoomScheduleGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useRooms).mockReturnValue({
      data: [
        { id: 'room-1', name: 'OR 1' },
        { id: 'room-2', name: 'OR 2' },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
  })

  describe('rendering', () => {
    it('renders week navigation header', () => {
      renderGrid()
      expect(screen.getByRole('button', { name: /Today/i })).toBeDefined()
      expect(screen.getByRole('button', { name: /Previous week/i })).toBeDefined()
      expect(screen.getByRole('button', { name: /Next week/i })).toBeDefined()
    })

    it('displays correct week header for single-month week', () => {
      renderGrid()
      expect(screen.getByText('March 2026')).toBeDefined()
    })

    it('displays correct week header for cross-month week', () => {
      renderGrid({ currentWeekStart: new Date(2026, 2, 30) })
      expect(screen.getByText('March – April 2026')).toBeDefined()
    })

    it('renders 7 day columns (Sun-Sat)', () => {
      renderGrid()
      expect(screen.getByText('Sun')).toBeDefined()
      expect(screen.getByText('Mon')).toBeDefined()
      expect(screen.getByText('Tue')).toBeDefined()
      expect(screen.getByText('Wed')).toBeDefined()
      expect(screen.getByText('Thu')).toBeDefined()
      expect(screen.getByText('Fri')).toBeDefined()
      expect(screen.getByText('Sat')).toBeDefined()
    })

    it('renders room rows', () => {
      renderGrid()
      expect(screen.getByText('OR 1')).toBeDefined()
      expect(screen.getByText('OR 2')).toBeDefined()
    })

    it('renders grid with rooms x days cells', () => {
      const { container } = renderGrid()
      const tbody = container.querySelector('tbody')
      expect(tbody?.querySelectorAll('tr').length).toBe(2)
      expect(tbody?.querySelectorAll('td').length).toBe(16) // 2 rows * (1 room name + 7 day cells)
    })
  })

  describe('loading state', () => {
    it('shows loading spinner when rooms are loading', () => {
      vi.mocked(useRooms).mockReturnValue({
        data: [],
        loading: true,
        error: null,
        refresh: vi.fn(),
      })

      const { container } = renderGrid()
      expect(container.querySelector('.animate-spin')).toBeDefined()
    })

    it('shows loading spinner when assignments are loading', () => {
      const { container } = renderGrid({ assignmentsLoading: true })
      expect(container.querySelector('.animate-spin')).toBeDefined()
    })

    it('hides loading spinner when loading completes', () => {
      const { container } = renderGrid()
      expect(container.querySelector('.animate-spin')).toBeNull()
    })
  })

  describe('error state', () => {
    it('displays error message when error exists', () => {
      renderGrid({ assignmentsError: 'Failed to load assignments' })
      expect(screen.getByText('Failed to load assignments')).toBeDefined()
    })

    it('does not display error message when error is null', () => {
      const { container } = renderGrid()
      expect(container.querySelector('.bg-red-50')).toBeNull()
    })
  })

  describe('empty state', () => {
    it('shows "No rooms configured" when rooms array is empty', () => {
      vi.mocked(useRooms).mockReturnValue({
        data: [],
        loading: false,
        error: null,
        refresh: vi.fn(),
      })

      renderGrid()
      expect(screen.getByText('No rooms configured')).toBeDefined()
      expect(screen.getByText('Add rooms in Settings to start scheduling')).toBeDefined()
    })

    it('does not show empty state while rooms are loading', () => {
      vi.mocked(useRooms).mockReturnValue({
        data: [],
        loading: true,
        error: null,
        refresh: vi.fn(),
      })

      renderGrid()
      expect(screen.queryByText('No rooms configured')).toBeNull()
    })
  })

  describe('week navigation', () => {
    it('calls onWeekChange with previous week when Previous button clicked', async () => {
      const user = userEvent.setup()
      const onWeekChange = vi.fn()
      renderGrid({ onWeekChange })

      await user.click(screen.getByRole('button', { name: /Previous week/i }))

      expect(onWeekChange).toHaveBeenCalledOnce()
      const calledDate = onWeekChange.mock.calls[0][0]
      expect(calledDate.getTime()).toBe(new Date(2026, 2, 2).getTime())
    })

    it('calls onWeekChange with next week when Next button clicked', async () => {
      const user = userEvent.setup()
      const onWeekChange = vi.fn()
      renderGrid({ onWeekChange })

      await user.click(screen.getByRole('button', { name: /Next week/i }))

      expect(onWeekChange).toHaveBeenCalledOnce()
      const calledDate = onWeekChange.mock.calls[0][0]
      expect(calledDate.getTime()).toBe(new Date(2026, 2, 16).getTime())
    })

    it('calls onWeekChange with start of current week when Today button clicked', async () => {
      const user = userEvent.setup()
      const onWeekChange = vi.fn()
      renderGrid({ onWeekChange, currentWeekStart: new Date(2026, 1, 1) })

      await user.click(screen.getByRole('button', { name: /Today/i }))

      expect(onWeekChange).toHaveBeenCalledOnce()
      const calledDate = onWeekChange.mock.calls[0][0]
      expect(calledDate.getDay()).toBe(0) // Sunday
    })
  })

  describe('assignment rendering', () => {
    it('builds assignment map and renders assignments in cells', () => {
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
            user: { id: 'user-1', first_name: 'Jane', last_name: 'Doe' },
            role: { id: 'role-1', name: 'RN' },
          },
        ],
      })

      expect(screen.getByText('Dr. Smith')).toBeDefined()
      expect(screen.getByText(/J\. Doe/)).toBeDefined()
    })
  })

  describe('layout', () => {
    it('applies sticky header to column headers', () => {
      const { container } = renderGrid()
      const thead = container.querySelector('thead')
      expect(thead?.className).toContain('sticky')
      expect(thead?.className).toContain('top-0')
    })

    it('applies overflow auto to grid container', () => {
      const { container } = renderGrid()
      expect(container.querySelector('.overflow-auto')).toBeDefined()
    })

    it('applies fixed width to room column', () => {
      const { container } = renderGrid()
      expect(container.querySelector('th.w-\\[120px\\]')).toBeDefined()
    })
  })

  describe('removal callbacks', () => {
    it('passes onRemoveSurgeon callback to RoomDayCell components', () => {
      const onRemoveSurgeon = vi.fn()
      const assignments: RoomDateAssignment[] = [
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
      ]

      const { container } = renderGrid({ assignments, onRemoveSurgeon })

      // Surgeon badge should have remove button (search within table body to avoid nav buttons)
      const tbody = container.querySelector('tbody')
      const removeButton = tbody?.querySelector('button[title*="Remove"]')
      expect(removeButton).toBeDefined()
      expect(removeButton?.getAttribute('title')).toBe('Remove Dr. Smith')
    })

    it('passes onRemoveStaff callback to RoomDayCell components', () => {
      const onRemoveStaff = vi.fn()
      const staffAssignments: RoomDateStaff[] = [
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
      ]

      const { container } = renderGrid({ staffAssignments, onRemoveStaff })

      // Staff badge should have remove button (search within table body to avoid nav buttons)
      const tbody = container.querySelector('tbody')
      const removeButton = tbody?.querySelector('button[title*="Remove"]')
      expect(removeButton).toBeDefined()
      expect(removeButton?.getAttribute('title')).toBe('Remove J. Doe')
    })

    it('does not render badge remove buttons when callbacks are not provided', () => {
      const assignments: RoomDateAssignment[] = [
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
      ]

      const { container } = renderGrid({ assignments })
      const tbody = container.querySelector('tbody')
      // Should not have any remove buttons in cells (nav buttons are ok)
      expect(tbody?.querySelector('button[title*="Remove"]')).toBeNull()
    })
  })

  describe('clone functionality', () => {
    describe('clone week button', () => {
      it('renders "Clone previous week" button when onCloneWeek callback provided', () => {
        const onCloneWeek = vi.fn()
        renderGrid({ onCloneWeek })

        const cloneButton = screen.getByRole('button', { name: /Clone previous week/i })
        expect(cloneButton).toBeDefined()
        expect(cloneButton.title).toBe('Copy all assignments from the previous week to this week')
      })

      it('does not render clone week button when onCloneWeek not provided', () => {
        renderGrid()

        expect(screen.queryByRole('button', { name: /Clone previous week/i })).toBeNull()
      })

      it('calls onCloneWeek with correct date strings when clicked', async () => {
        const user = userEvent.setup()
        const onCloneWeek = vi.fn()
        renderGrid({ onCloneWeek, currentWeekStart: new Date(2026, 2, 9) }) // March 9, 2026

        const cloneButton = screen.getByRole('button', { name: /Clone previous week/i })
        await user.click(cloneButton)

        expect(onCloneWeek).toHaveBeenCalledOnce()
        expect(onCloneWeek).toHaveBeenCalledWith('2026-03-02', '2026-03-09')
      })

      it('disables clone week button when loading', () => {
        const onCloneWeek = vi.fn()
        renderGrid({ onCloneWeek, assignmentsLoading: true })

        const cloneButton = screen.getByRole('button', { name: /Clone previous week/i })
        expect(cloneButton.disabled).toBe(true)
      })

      it('enables clone week button when not loading', () => {
        const onCloneWeek = vi.fn()
        renderGrid({ onCloneWeek, assignmentsLoading: false })

        const cloneButton = screen.getByRole('button', { name: /Clone previous week/i })
        expect(cloneButton.disabled).toBe(false)
      })
    })

    describe('clone day links', () => {
      it('renders "Clone" link in each day column header when onCloneDay provided', () => {
        const onCloneDay = vi.fn()
        renderGrid({ onCloneDay })

        const cloneLinks = screen.getAllByRole('button', { name: /Clone/i }).filter((btn) => {
          // Filter to only day column clone buttons (not the week clone button)
          return btn.textContent === 'Clone'
        })

        expect(cloneLinks.length).toBe(7) // One for each day of the week
      })

      it('does not render clone day links when onCloneDay not provided', () => {
        renderGrid()

        const cloneLinks = screen.queryAllByRole('button', { name: /Clone/i }).filter((btn) => {
          return btn.textContent === 'Clone'
        })

        expect(cloneLinks.length).toBe(0)
      })

      it('calls onCloneDay with correct date strings when Sunday clone clicked', async () => {
        const user = userEvent.setup()
        const onCloneDay = vi.fn()
        renderGrid({ onCloneDay, currentWeekStart: new Date(2026, 2, 9) }) // March 9, 2026 (Sunday)

        const cloneLinks = screen.getAllByRole('button', { name: /Clone/i }).filter((btn) => {
          return btn.textContent === 'Clone'
        })

        // Click the first day (Sunday) clone link
        await user.click(cloneLinks[0])

        expect(onCloneDay).toHaveBeenCalledOnce()
        expect(onCloneDay).toHaveBeenCalledWith('2026-03-02', '2026-03-09') // Previous Sun -> Current Sun
      })

      it('calls onCloneDay with correct date strings when Wednesday clone clicked', async () => {
        const user = userEvent.setup()
        const onCloneDay = vi.fn()
        renderGrid({ onCloneDay, currentWeekStart: new Date(2026, 2, 9) }) // March 9, 2026 (Sunday)

        const cloneLinks = screen.getAllByRole('button', { name: /Clone/i }).filter((btn) => {
          return btn.textContent === 'Clone'
        })

        // Click the fourth day (Wednesday) clone link
        await user.click(cloneLinks[3])

        expect(onCloneDay).toHaveBeenCalledOnce()
        expect(onCloneDay).toHaveBeenCalledWith('2026-03-05', '2026-03-12') // Previous Wed -> Current Wed
      })

      it('displays correct tooltip for day clone buttons', () => {
        const onCloneDay = vi.fn()
        renderGrid({ onCloneDay, currentWeekStart: new Date(2026, 2, 9) })

        const cloneLinks = screen.getAllByRole('button', { name: /Clone/i }).filter((btn) => {
          return btn.textContent === 'Clone'
        })

        // Check tooltips for each day
        expect(cloneLinks[0].title).toBe('Clone from last Sun')
        expect(cloneLinks[1].title).toBe('Clone from last Mon')
        expect(cloneLinks[2].title).toBe('Clone from last Tue')
        expect(cloneLinks[3].title).toBe('Clone from last Wed')
        expect(cloneLinks[4].title).toBe('Clone from last Thu')
        expect(cloneLinks[5].title).toBe('Clone from last Fri')
        expect(cloneLinks[6].title).toBe('Clone from last Sat')
      })
    })

    describe('combined clone functionality', () => {
      it('renders both clone week button and clone day links when both callbacks provided', () => {
        const onCloneWeek = vi.fn()
        const onCloneDay = vi.fn()
        renderGrid({ onCloneWeek, onCloneDay })

        expect(screen.getByRole('button', { name: /Clone previous week/i })).toBeDefined()

        const cloneLinks = screen.getAllByRole('button', { name: /Clone/i }).filter((btn) => {
          return btn.textContent === 'Clone'
        })
        expect(cloneLinks.length).toBe(7)
      })

      it('allows cloning a week and then cloning individual days', async () => {
        const user = userEvent.setup()
        const onCloneWeek = vi.fn()
        const onCloneDay = vi.fn()
        renderGrid({ onCloneWeek, onCloneDay, currentWeekStart: new Date(2026, 2, 9) })

        // Clone the week
        await user.click(screen.getByRole('button', { name: /Clone previous week/i }))
        expect(onCloneWeek).toHaveBeenCalledOnce()

        // Then clone a specific day
        const cloneLinks = screen.getAllByRole('button', { name: /Clone/i }).filter((btn) => {
          return btn.textContent === 'Clone'
        })
        await user.click(cloneLinks[0])
        expect(onCloneDay).toHaveBeenCalledOnce()
      })
    })
  })
})
