// components/block-schedule/__tests__/AssignedSurgeonBadge.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssignedSurgeonBadge } from '../AssignedSurgeonBadge'
import type { RoomDateAssignment } from '@/types/room-scheduling'

const defaultAssignment: RoomDateAssignment = {
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
}

describe('AssignedSurgeonBadge', () => {
  describe('rendering', () => {
    it('displays surgeon last name with Dr. prefix', () => {
      render(<AssignedSurgeonBadge assignment={defaultAssignment} />)
      expect(screen.getByText('Dr. Smith')).toBeDefined()
    })

    it('displays Dr. Unknown when surgeon data is missing', () => {
      const assignment = { ...defaultAssignment, surgeon: undefined }
      render(<AssignedSurgeonBadge assignment={assignment} />)
      expect(screen.getByText('Dr. Unknown')).toBeDefined()
    })

    it('displays Dr. Unknown when last_name is null', () => {
      const assignment = {
        ...defaultAssignment,
        surgeon: { id: 'surg-1', last_name: null, first_name: 'John' },
      }
      render(<AssignedSurgeonBadge assignment={assignment} />)
      expect(screen.getByText('Dr. Unknown')).toBeDefined()
    })

    it('applies blue badge styling', () => {
      const { container } = render(<AssignedSurgeonBadge assignment={defaultAssignment} />)
      expect(container.querySelector('.bg-blue-50')).toBeDefined()
      expect(container.querySelector('.border-blue-200')).toBeDefined()
      expect(container.querySelector('.text-blue-800')).toBeDefined()
    })

    it('includes blue dot indicator', () => {
      const { container } = render(<AssignedSurgeonBadge assignment={defaultAssignment} />)
      expect(container.querySelector('.bg-blue-500.rounded-full')).toBeDefined()
    })
  })

  describe('remove button', () => {
    it('does not render remove button when onRemove is not provided', () => {
      const { container } = render(<AssignedSurgeonBadge assignment={defaultAssignment} />)
      expect(container.querySelector('button')).toBeNull()
    })

    it('renders remove button when onRemove is provided', () => {
      const onRemove = vi.fn()
      const { container } = render(
        <AssignedSurgeonBadge assignment={defaultAssignment} onRemove={onRemove} />
      )
      expect(container.querySelector('button')).toBeDefined()
    })

    it('remove button has correct title attribute', () => {
      const onRemove = vi.fn()
      const { container } = render(
        <AssignedSurgeonBadge assignment={defaultAssignment} onRemove={onRemove} />
      )
      const button = container.querySelector('button')
      expect(button?.getAttribute('title')).toBe('Remove Dr. Smith')
    })

    it('remove button title handles missing surgeon name', () => {
      const onRemove = vi.fn()
      const assignment = { ...defaultAssignment, surgeon: undefined }
      const { container } = render(<AssignedSurgeonBadge assignment={assignment} onRemove={onRemove} />)
      const button = container.querySelector('button')
      expect(button?.getAttribute('title')).toBe('Remove Dr. Unknown')
    })

    it('calls onRemove with assignment ID when remove button clicked', async () => {
      const user = userEvent.setup()
      const onRemove = vi.fn()
      const { container } = render(
        <AssignedSurgeonBadge assignment={defaultAssignment} onRemove={onRemove} />
      )

      const button = container.querySelector('button')
      expect(button).toBeDefined()
      await user.click(button!)

      expect(onRemove).toHaveBeenCalledOnce()
      expect(onRemove).toHaveBeenCalledWith('asgn-1')
    })

    it('stops event propagation when remove button clicked', async () => {
      const user = userEvent.setup()
      const onRemove = vi.fn()
      const onClick = vi.fn()

      const { container } = render(
        <div onClick={onClick}>
          <AssignedSurgeonBadge assignment={defaultAssignment} onRemove={onRemove} />
        </div>
      )

      const button = container.querySelector('button')
      expect(button).toBeDefined()
      await user.click(button!)

      expect(onRemove).toHaveBeenCalledOnce()
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('visual state', () => {
    it('applies opacity-0 to remove button by default', () => {
      const onRemove = vi.fn()
      const { container } = render(
        <AssignedSurgeonBadge assignment={defaultAssignment} onRemove={onRemove} />
      )
      const button = container.querySelector('button')
      expect(button?.className).toContain('opacity-0')
      expect(button?.className).toContain('group-hover:opacity-100')
    })

    it('renders X icon in remove button', () => {
      const onRemove = vi.fn()
      const { container } = render(
        <AssignedSurgeonBadge assignment={defaultAssignment} onRemove={onRemove} />
      )
      const button = container.querySelector('button')
      expect(button).toBeDefined()
      // Icon is rendered (lucide-react renders as SVG)
      const svg = button?.querySelector('svg')
      expect(svg).toBeDefined()
    })
  })
})
