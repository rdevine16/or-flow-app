// components/block-schedule/__tests__/RoomDayCell.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { RoomDayCell } from '../RoomDayCell'
import type { RoomDayCellData, RoomDateAssignment, RoomDateStaff } from '@/types/room-scheduling'

const defaultProps = {
  roomId: 'room-1',
  date: '2026-03-09',
  roomName: 'OR 1',
  isClosed: false,
}

function renderCell(props: Parameters<typeof RoomDayCell>[0]) {
  return render(
    <DndContext>
      <RoomDayCell {...props} />
    </DndContext>
  )
}

function makeSurgeon(overrides: Partial<RoomDateAssignment> & { id: string }): RoomDateAssignment {
  return {
    facility_id: 'fac-1',
    or_room_id: 'room-1',
    assignment_date: '2026-03-09',
    surgeon_id: 'surg-1',
    notes: null,
    created_by: null,
    created_at: '2026-03-09T00:00:00Z',
    updated_at: '2026-03-09T00:00:00Z',
    ...overrides,
  }
}

function makeStaff(overrides: Partial<RoomDateStaff> & { id: string }): RoomDateStaff {
  return {
    room_date_assignment_id: null,
    facility_id: 'fac-1',
    or_room_id: 'room-1',
    assignment_date: '2026-03-09',
    user_id: 'user-1',
    role_id: 'role-1',
    created_at: '2026-03-09T00:00:00Z',
    ...overrides,
  }
}

describe('RoomDayCell', () => {
  describe('empty state', () => {
    it('renders empty cell with dash when cellData is null', () => {
      const { container } = renderCell({ cellData: null, isToday: false, ...defaultProps })
      expect(screen.getByText('—')).toBeDefined()
      expect(container.querySelector('.bg-white')).toBeDefined()
    })

    it('renders empty cell when cellData has no surgeons or staff', () => {
      const emptyData: RoomDayCellData = {
        roomId: 'room-1',
        date: '2026-03-09',
        surgeons: [],
        staff: [],
      }
      renderCell({ cellData: emptyData, isToday: false, ...defaultProps })
      expect(screen.getByText('—')).toBeDefined()
    })

    it('applies today highlighting to empty cell', () => {
      const { container } = renderCell({ cellData: null, isToday: true, ...defaultProps })
      expect(container.querySelector('.bg-blue-50\\/50')).toBeDefined()
    })
  })

  describe('surgeon rendering', () => {
    it('renders single surgeon with blue styling', () => {
      const cellData: RoomDayCellData = {
        roomId: 'room-1',
        date: '2026-03-09',
        surgeons: [
          makeSurgeon({
            id: 'asgn-1',
            surgeon: { id: 'surg-1', last_name: 'Smith', first_name: 'John' },
          }),
        ],
        staff: [],
      }

      const { container } = renderCell({ cellData, isToday: false, ...defaultProps })
      expect(screen.getByText('Dr. Smith')).toBeDefined()
      expect(container.querySelector('.bg-blue-50')).toBeDefined()
      expect(container.querySelector('.border-blue-200')).toBeDefined()
    })

    it('renders multiple surgeons', () => {
      const cellData: RoomDayCellData = {
        roomId: 'room-1',
        date: '2026-03-09',
        surgeons: [
          makeSurgeon({
            id: 'asgn-1',
            surgeon: { id: 'surg-1', last_name: 'Smith', first_name: 'John' },
          }),
          makeSurgeon({
            id: 'asgn-2',
            surgeon_id: 'surg-2',
            surgeon: { id: 'surg-2', last_name: 'Johnson', first_name: 'Sarah' },
          }),
        ],
        staff: [],
      }

      renderCell({ cellData, isToday: false, ...defaultProps })
      expect(screen.getByText('Dr. Smith')).toBeDefined()
      expect(screen.getByText('Dr. Johnson')).toBeDefined()
    })

    it('handles missing surgeon data gracefully', () => {
      const cellData: RoomDayCellData = {
        roomId: 'room-1',
        date: '2026-03-09',
        surgeons: [
          makeSurgeon({ id: 'asgn-1', surgeon: undefined }),
        ],
        staff: [],
      }

      renderCell({ cellData, isToday: false, ...defaultProps })
      expect(screen.getByText('Dr. Unknown')).toBeDefined()
    })
  })

  describe('staff rendering', () => {
    it('renders single staff member', () => {
      const cellData: RoomDayCellData = {
        roomId: 'room-1',
        date: '2026-03-09',
        surgeons: [],
        staff: [
          makeStaff({
            id: 'staff-1',
            user: { id: 'user-1', first_name: 'Jane', last_name: 'Doe' },
            role: { id: 'role-1', name: 'RN' },
          }),
        ],
      }

      renderCell({ cellData, isToday: false, ...defaultProps })
      expect(screen.getByText(/J\. Doe/)).toBeDefined()
      expect(screen.getByText('RN')).toBeDefined()
    })

    it('renders multiple staff members', () => {
      const cellData: RoomDayCellData = {
        roomId: 'room-1',
        date: '2026-03-09',
        surgeons: [],
        staff: [
          makeStaff({
            id: 'staff-1',
            user: { id: 'user-1', first_name: 'Jane', last_name: 'Doe' },
            role: { id: 'role-1', name: 'RN' },
          }),
          makeStaff({
            id: 'staff-2',
            user_id: 'user-2',
            user: { id: 'user-2', first_name: 'Bob', last_name: 'Smith' },
            role: { id: 'role-2', name: 'ST' },
          }),
        ],
      }

      renderCell({ cellData, isToday: false, ...defaultProps })
      expect(screen.getByText(/J\. Doe/)).toBeDefined()
      expect(screen.getByText(/B\. Smith/)).toBeDefined()
      expect(screen.getByText('RN')).toBeDefined()
      expect(screen.getByText('ST')).toBeDefined()
    })

    it('handles staff with no role', () => {
      const cellData: RoomDayCellData = {
        roomId: 'room-1',
        date: '2026-03-09',
        surgeons: [],
        staff: [
          makeStaff({
            id: 'staff-1',
            user: { id: 'user-1', first_name: 'Jane', last_name: 'Doe' },
            role: undefined,
          }),
        ],
      }

      const { container } = renderCell({ cellData, isToday: false, ...defaultProps })
      expect(screen.getByText(/J\. Doe/)).toBeDefined()
      expect(container.textContent).not.toContain('RN')
    })
  })

  describe('combined surgeons + staff', () => {
    it('renders both surgeons and staff in the same cell', () => {
      const cellData: RoomDayCellData = {
        roomId: 'room-1',
        date: '2026-03-09',
        surgeons: [
          makeSurgeon({
            id: 'asgn-1',
            surgeon: { id: 'surg-1', last_name: 'Smith', first_name: 'John' },
          }),
        ],
        staff: [
          makeStaff({
            id: 'staff-1',
            user: { id: 'user-1', first_name: 'Jane', last_name: 'Doe' },
            role: { id: 'role-1', name: 'RN' },
          }),
        ],
      }

      renderCell({ cellData, isToday: false, ...defaultProps })
      expect(screen.getByText('Dr. Smith')).toBeDefined()
      expect(screen.getByText(/J\. Doe/)).toBeDefined()
      expect(screen.getByText('RN')).toBeDefined()
    })

    it('does not show empty state when surgeons exist but staff is empty', () => {
      const cellData: RoomDayCellData = {
        roomId: 'room-1',
        date: '2026-03-09',
        surgeons: [
          makeSurgeon({
            id: 'asgn-1',
            surgeon: { id: 'surg-1', last_name: 'Smith', first_name: 'John' },
          }),
        ],
        staff: [],
      }

      renderCell({ cellData, isToday: false, ...defaultProps })
      expect(screen.getByText('Dr. Smith')).toBeDefined()
      expect(screen.queryByText('—')).toBeNull()
    })
  })

  describe('today highlighting', () => {
    it('applies blue background when isToday is true', () => {
      const cellData: RoomDayCellData = {
        roomId: 'room-1',
        date: '2026-03-09',
        surgeons: [
          makeSurgeon({
            id: 'asgn-1',
            surgeon: { id: 'surg-1', last_name: 'Smith', first_name: 'John' },
          }),
        ],
        staff: [],
      }

      const { container } = renderCell({ cellData, isToday: true, ...defaultProps })
      expect(container.querySelector('.bg-blue-50\\/50')).toBeDefined()
    })

    it('does not apply blue background when isToday is false', () => {
      const cellData: RoomDayCellData = {
        roomId: 'room-1',
        date: '2026-03-09',
        surgeons: [
          makeSurgeon({
            id: 'asgn-1',
            surgeon: { id: 'surg-1', last_name: 'Smith', first_name: 'John' },
          }),
        ],
        staff: [],
      }

      const { container } = renderCell({ cellData, isToday: false, ...defaultProps })
      expect(container.querySelector('.bg-white')).toBeDefined()
    })
  })

  describe('visual layout', () => {
    it('applies minimum height to cell', () => {
      const { container } = renderCell({ cellData: null, isToday: false, ...defaultProps })
      expect(container.querySelector('.min-h-\\[80px\\]')).toBeDefined()
    })

    it('applies proper spacing between surgeons and staff', () => {
      const cellData: RoomDayCellData = {
        roomId: 'room-1',
        date: '2026-03-09',
        surgeons: [
          makeSurgeon({
            id: 'asgn-1',
            surgeon: { id: 'surg-1', last_name: 'Smith', first_name: 'John' },
          }),
        ],
        staff: [
          makeStaff({
            id: 'staff-1',
            user: { id: 'user-1', first_name: 'Jane', last_name: 'Doe' },
            role: { id: 'role-1', name: 'RN' },
          }),
        ],
      }

      const { container } = renderCell({ cellData, isToday: false, ...defaultProps })
      expect(container.querySelector('.space-y-1')).toBeDefined()
    })
  })

  describe('remove callbacks', () => {
    it('passes onRemoveSurgeon callback to AssignedSurgeonBadge', () => {
      const onRemoveSurgeon = vi.fn()
      const cellData: RoomDayCellData = {
        roomId: 'room-1',
        date: '2026-03-09',
        surgeons: [
          makeSurgeon({
            id: 'asgn-1',
            surgeon: { id: 'surg-1', last_name: 'Smith', first_name: 'John' },
          }),
        ],
        staff: [],
      }

      const { container } = renderCell({
        cellData,
        isToday: false,
        onRemoveSurgeon,
        ...defaultProps,
      })

      // Badge should have remove button when callback provided
      const button = container.querySelector('button')
      expect(button).toBeDefined()
      expect(button?.getAttribute('title')).toBe('Remove Dr. Smith')
    })

    it('passes onRemoveStaff callback to AssignedStaffBadge', () => {
      const onRemoveStaff = vi.fn()
      const cellData: RoomDayCellData = {
        roomId: 'room-1',
        date: '2026-03-09',
        surgeons: [],
        staff: [
          makeStaff({
            id: 'staff-1',
            user: { id: 'user-1', first_name: 'Jane', last_name: 'Doe' },
            role: { id: 'role-1', name: 'RN' },
          }),
        ],
      }

      const { container } = renderCell({
        cellData,
        isToday: false,
        onRemoveStaff,
        ...defaultProps,
      })

      // Badge should have remove button when callback provided
      const button = container.querySelector('button')
      expect(button).toBeDefined()
      expect(button?.getAttribute('title')).toBe('Remove Jane Doe')
    })

    it('does not render remove buttons when callbacks not provided', () => {
      const cellData: RoomDayCellData = {
        roomId: 'room-1',
        date: '2026-03-09',
        surgeons: [
          makeSurgeon({
            id: 'asgn-1',
            surgeon: { id: 'surg-1', last_name: 'Smith', first_name: 'John' },
          }),
        ],
        staff: [
          makeStaff({
            id: 'staff-1',
            user: { id: 'user-1', first_name: 'Jane', last_name: 'Doe' },
            role: { id: 'role-1', name: 'RN' },
          }),
        ],
      }

      const { container } = renderCell({ cellData, isToday: false, ...defaultProps })
      expect(container.querySelector('button')).toBeNull()
    })
  })

  describe('closed room state', () => {
    it('renders Closed label with lock icon when isClosed is true', () => {
      renderCell({ ...defaultProps, cellData: null, isToday: false, isClosed: true })
      expect(screen.getByText('Closed')).toBeDefined()
    })

    it('applies gray background when closed', () => {
      const { container } = renderCell({ ...defaultProps, cellData: null, isToday: false, isClosed: true })
      expect(container.querySelector('.bg-slate-100\\/80')).toBeDefined()
    })

    it('has correct aria-label when closed', () => {
      const { container } = renderCell({ ...defaultProps, cellData: null, isToday: false, isClosed: true })
      expect(container.querySelector('[aria-label="OR 1 closed on 2026-03-09"]')).toBeDefined()
    })
  })

  describe('click-to-assign fallback', () => {
    it('renders assign button in empty cell when onRequestAssign provided', () => {
      const onRequestAssign = vi.fn()
      const { container } = renderCell({ ...defaultProps, cellData: null, isToday: false, onRequestAssign })
      const button = container.querySelector('[aria-label="Assign surgeon or staff to OR 1 on 2026-03-09"]')
      expect(button).toBeDefined()
    })

    it('renders Add button in non-empty cell when onRequestAssign provided', () => {
      const onRequestAssign = vi.fn()
      const cellData: RoomDayCellData = {
        roomId: 'room-1',
        date: '2026-03-09',
        surgeons: [makeSurgeon({ id: 'asgn-1', surgeon: { id: 'surg-1', last_name: 'Smith', first_name: 'John' } })],
        staff: [],
      }
      const { container } = renderCell({ ...defaultProps, cellData, isToday: false, onRequestAssign })
      const addButton = container.querySelector('[aria-label="Add surgeon or staff to OR 1 on 2026-03-09"]')
      expect(addButton).toBeDefined()
    })

    it('does not render assign button when closed', () => {
      const onRequestAssign = vi.fn()
      const { container } = renderCell({ ...defaultProps, cellData: null, isToday: false, isClosed: true, onRequestAssign })
      expect(container.querySelector('[aria-label*="Assign surgeon"]')).toBeNull()
    })
  })

  describe('add staff hint', () => {
    it('shows "Add staff" hint when surgeons exist but no staff', () => {
      const cellData: RoomDayCellData = {
        roomId: 'room-1',
        date: '2026-03-09',
        surgeons: [
          makeSurgeon({
            id: 'asgn-1',
            surgeon: { id: 'surg-1', last_name: 'Smith', first_name: 'John' },
          }),
        ],
        staff: [],
      }

      renderCell({ cellData, isToday: false, ...defaultProps })
      expect(screen.getByText('+ Add staff')).toBeDefined()
    })

    it('does not show hint when staff exists', () => {
      const cellData: RoomDayCellData = {
        roomId: 'room-1',
        date: '2026-03-09',
        surgeons: [
          makeSurgeon({
            id: 'asgn-1',
            surgeon: { id: 'surg-1', last_name: 'Smith', first_name: 'John' },
          }),
        ],
        staff: [
          makeStaff({
            id: 'staff-1',
            user: { id: 'user-1', first_name: 'Jane', last_name: 'Doe' },
            role: { id: 'role-1', name: 'RN' },
          }),
        ],
      }

      renderCell({ cellData, isToday: false, ...defaultProps })
      expect(screen.queryByText('+ Add staff')).toBeNull()
    })

    it('does not show hint when no surgeons exist', () => {
      const cellData: RoomDayCellData = {
        roomId: 'room-1',
        date: '2026-03-09',
        surgeons: [],
        staff: [],
      }

      renderCell({ cellData, isToday: false, ...defaultProps })
      expect(screen.queryByText('+ Add staff')).toBeNull()
    })
  })
})
