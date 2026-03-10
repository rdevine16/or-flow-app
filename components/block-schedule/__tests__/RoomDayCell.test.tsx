// components/block-schedule/__tests__/RoomDayCell.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RoomDayCell } from '../RoomDayCell'
import type { RoomDayCellData } from '@/types/room-scheduling'

describe('RoomDayCell', () => {
  describe('empty state', () => {
    it('renders empty cell with dash when cellData is null', () => {
      const { container } = render(
        <RoomDayCell cellData={null} isToday={false} />
      )

      expect(screen.getByText('—')).toBeDefined()
      expect(container.querySelector('.bg-white')).toBeDefined()
      expect(container.querySelector('.hover\\:bg-slate-50')).toBeDefined()
    })

    it('renders empty cell when cellData has no surgeons or staff', () => {
      const emptyData: RoomDayCellData = {
        surgeons: [],
        staff: [],
      }

      render(<RoomDayCell cellData={emptyData} isToday={false} />)
      expect(screen.getByText('—')).toBeDefined()
    })

    it('applies today highlighting to empty cell', () => {
      const { container } = render(
        <RoomDayCell cellData={null} isToday={true} />
      )

      expect(container.querySelector('.bg-blue-50\\/50')).toBeDefined()
    })
  })

  describe('surgeon rendering', () => {
    it('renders single surgeon with blue styling', () => {
      const cellData: RoomDayCellData = {
        surgeons: [
          {
            id: 'asgn-1',
            surgeon: {
              id: 'surg-1',
              last_name: 'Smith',
              first_name: 'John',
            },
          },
        ],
        staff: [],
      }

      const { container } = render(
        <RoomDayCell cellData={cellData} isToday={false} />
      )

      expect(screen.getByText('Dr. Smith')).toBeDefined()
      expect(container.querySelector('.bg-blue-50')).toBeDefined()
      expect(container.querySelector('.border-blue-200')).toBeDefined()
      expect(container.querySelector('.bg-blue-500')).toBeDefined() // Dot
    })

    it('renders multiple surgeons', () => {
      const cellData: RoomDayCellData = {
        surgeons: [
          {
            id: 'asgn-1',
            surgeon: {
              id: 'surg-1',
              last_name: 'Smith',
              first_name: 'John',
            },
          },
          {
            id: 'asgn-2',
            surgeon: {
              id: 'surg-2',
              last_name: 'Johnson',
              first_name: 'Sarah',
            },
          },
        ],
        staff: [],
      }

      render(<RoomDayCell cellData={cellData} isToday={false} />)

      expect(screen.getByText('Dr. Smith')).toBeDefined()
      expect(screen.getByText('Dr. Johnson')).toBeDefined()
    })

    it('handles missing surgeon data gracefully', () => {
      const cellData: RoomDayCellData = {
        surgeons: [
          {
            id: 'asgn-1',
            surgeon: null,
          },
        ],
        staff: [],
      }

      render(<RoomDayCell cellData={cellData} isToday={false} />)
      expect(screen.getByText('Dr. Unknown')).toBeDefined()
    })

    it('handles surgeon with no last_name', () => {
      const cellData: RoomDayCellData = {
        surgeons: [
          {
            id: 'asgn-1',
            surgeon: {
              id: 'surg-1',
              last_name: null,
              first_name: 'John',
            },
          },
        ],
        staff: [],
      }

      render(<RoomDayCell cellData={cellData} isToday={false} />)
      expect(screen.getByText('Dr. Unknown')).toBeDefined()
    })
  })

  describe('staff rendering', () => {
    it('renders single staff member', () => {
      const cellData: RoomDayCellData = {
        surgeons: [],
        staff: [
          {
            id: 'staff-1',
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
      }

      render(<RoomDayCell cellData={cellData} isToday={false} />)

      expect(screen.getByText(/J\. Doe/)).toBeDefined()
      expect(screen.getByText('RN')).toBeDefined()
    })

    it('renders multiple staff members', () => {
      const cellData: RoomDayCellData = {
        surgeons: [],
        staff: [
          {
            id: 'staff-1',
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
            user: {
              id: 'user-2',
              first_name: 'Bob',
              last_name: 'Smith',
            },
            role: {
              id: 'role-2',
              name: 'ST',
            },
          },
        ],
      }

      render(<RoomDayCell cellData={cellData} isToday={false} />)

      expect(screen.getByText(/J\. Doe/)).toBeDefined()
      expect(screen.getByText(/B\. Smith/)).toBeDefined()
      expect(screen.getByText('RN')).toBeDefined()
      expect(screen.getByText('ST')).toBeDefined()
    })

    it('handles missing staff user data', () => {
      const cellData: RoomDayCellData = {
        surgeons: [],
        staff: [
          {
            id: 'staff-1',
            user: null,
            role: {
              id: 'role-1',
              name: 'RN',
            },
          },
        ],
      }

      render(<RoomDayCell cellData={cellData} isToday={false} />)
      expect(screen.getByText(/\. Unknown/)).toBeDefined()
    })

    it('handles staff with no role', () => {
      const cellData: RoomDayCellData = {
        surgeons: [],
        staff: [
          {
            id: 'staff-1',
            user: {
              id: 'user-1',
              first_name: 'Jane',
              last_name: 'Doe',
            },
            role: null,
          },
        ],
      }

      const { container } = render(
        <RoomDayCell cellData={cellData} isToday={false} />
      )

      expect(screen.getByText(/J\. Doe/)).toBeDefined()
      // Role text should not be present
      expect(container.textContent).not.toContain('RN')
    })
  })

  describe('combined surgeons + staff', () => {
    it('renders both surgeons and staff in the same cell', () => {
      const cellData: RoomDayCellData = {
        surgeons: [
          {
            id: 'asgn-1',
            surgeon: {
              id: 'surg-1',
              last_name: 'Smith',
              first_name: 'John',
            },
          },
        ],
        staff: [
          {
            id: 'staff-1',
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
      }

      render(<RoomDayCell cellData={cellData} isToday={false} />)

      expect(screen.getByText('Dr. Smith')).toBeDefined()
      expect(screen.getByText(/J\. Doe/)).toBeDefined()
      expect(screen.getByText('RN')).toBeDefined()
    })

    it('does not show empty state when surgeons exist but staff is empty', () => {
      const cellData: RoomDayCellData = {
        surgeons: [
          {
            id: 'asgn-1',
            surgeon: {
              id: 'surg-1',
              last_name: 'Smith',
              first_name: 'John',
            },
          },
        ],
        staff: [],
      }

      render(<RoomDayCell cellData={cellData} isToday={false} />)

      expect(screen.getByText('Dr. Smith')).toBeDefined()
      expect(screen.queryByText('—')).toBeNull()
    })

    it('does not show empty state when staff exist but surgeons is empty', () => {
      const cellData: RoomDayCellData = {
        surgeons: [],
        staff: [
          {
            id: 'staff-1',
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
      }

      render(<RoomDayCell cellData={cellData} isToday={false} />)

      expect(screen.getByText(/J\. Doe/)).toBeDefined()
      expect(screen.queryByText('—')).toBeNull()
    })
  })

  describe('today highlighting', () => {
    it('applies blue background when isToday is true', () => {
      const cellData: RoomDayCellData = {
        surgeons: [
          {
            id: 'asgn-1',
            surgeon: {
              id: 'surg-1',
              last_name: 'Smith',
              first_name: 'John',
            },
          },
        ],
        staff: [],
      }

      const { container } = render(
        <RoomDayCell cellData={cellData} isToday={true} />
      )

      expect(container.querySelector('.bg-blue-50\\/50')).toBeDefined()
    })

    it('does not apply blue background when isToday is false', () => {
      const cellData: RoomDayCellData = {
        surgeons: [
          {
            id: 'asgn-1',
            surgeon: {
              id: 'surg-1',
              last_name: 'Smith',
              first_name: 'John',
            },
          },
        ],
        staff: [],
      }

      const { container } = render(
        <RoomDayCell cellData={cellData} isToday={false} />
      )

      expect(container.querySelector('.bg-white')).toBeDefined()
      expect(container.querySelector('.bg-blue-50\\/50')).toBeNull()
    })
  })

  describe('visual layout', () => {
    it('applies minimum height to cell', () => {
      const { container } = render(
        <RoomDayCell cellData={null} isToday={false} />
      )

      expect(container.querySelector('.min-h-\\[80px\\]')).toBeDefined()
    })

    it('applies proper spacing between surgeons and staff', () => {
      const cellData: RoomDayCellData = {
        surgeons: [
          {
            id: 'asgn-1',
            surgeon: {
              id: 'surg-1',
              last_name: 'Smith',
              first_name: 'John',
            },
          },
        ],
        staff: [
          {
            id: 'staff-1',
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
      }

      const { container } = render(
        <RoomDayCell cellData={cellData} isToday={false} />
      )

      expect(container.querySelector('.space-y-1')).toBeDefined()
    })
  })
})
