// components/block-schedule/__tests__/AssignedStaffBadge.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssignedStaffBadge } from '../AssignedStaffBadge'
import type { RoomDateStaff } from '@/types/room-scheduling'

const defaultStaff: RoomDateStaff = {
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
}

describe('AssignedStaffBadge', () => {
  describe('rendering', () => {
    it('displays staff name in abbreviated format (first initial + last name)', () => {
      render(<AssignedStaffBadge staff={defaultStaff} />)
      expect(screen.getByText(/J\. Doe/)).toBeDefined()
    })

    it('displays role name in small badge', () => {
      render(<AssignedStaffBadge staff={defaultStaff} />)
      expect(screen.getByText('RN')).toBeDefined()
    })

    it('does not render role badge when role is null', () => {
      const staff = { ...defaultStaff, role: undefined }
      const { container } = render(<AssignedStaffBadge staff={staff} />)
      expect(container.textContent).not.toContain('RN')
    })

    it('does not render role badge when role.name is null', () => {
      const staff = { ...defaultStaff, role: { id: 'role-1', name: null } }
      const { container } = render(<AssignedStaffBadge staff={staff} />)
      // Should only show staff name, no role badge
      expect(screen.getByText(/J\. Doe/)).toBeDefined()
      expect(container.querySelector('.bg-slate-100')).toBeNull()
    })

    it('displays Unknown when user data is missing', () => {
      const staff = { ...defaultStaff, user: undefined }
      render(<AssignedStaffBadge staff={staff} />)
      expect(screen.getByText('Unknown')).toBeDefined()
    })

    it('handles missing first_name gracefully', () => {
      const staff = {
        ...defaultStaff,
        user: { id: 'user-1', first_name: null, last_name: 'Doe' },
      }
      render(<AssignedStaffBadge staff={staff} />)
      expect(screen.getByText('. Doe')).toBeDefined()
    })

    it('handles missing last_name gracefully', () => {
      const staff = {
        ...defaultStaff,
        user: { id: 'user-1', first_name: 'Jane', last_name: null },
      }
      render(<AssignedStaffBadge staff={staff} />)
      expect(screen.getByText(/J\. Unknown/)).toBeDefined()
    })

    it('applies correct text styling', () => {
      const { container } = render(<AssignedStaffBadge staff={defaultStaff} />)
      expect(container.querySelector('.text-slate-600')).toBeDefined()
    })

    it('applies hover background transition', () => {
      const { container } = render(<AssignedStaffBadge staff={defaultStaff} />)
      expect(container.querySelector('.hover\\:bg-slate-50')).toBeDefined()
    })
  })

  describe('remove button', () => {
    it('does not render remove button when onRemove is not provided', () => {
      const { container } = render(<AssignedStaffBadge staff={defaultStaff} />)
      expect(container.querySelector('button')).toBeNull()
    })

    it('renders remove button when onRemove is provided', () => {
      const onRemove = vi.fn()
      const { container } = render(<AssignedStaffBadge staff={defaultStaff} onRemove={onRemove} />)
      expect(container.querySelector('button')).toBeDefined()
    })

    it('remove button has correct title attribute', () => {
      const onRemove = vi.fn()
      const { container } = render(<AssignedStaffBadge staff={defaultStaff} onRemove={onRemove} />)
      const button = container.querySelector('button')
      expect(button?.getAttribute('title')).toBe('Remove J. Doe')
    })

    it('remove button title handles missing user data', () => {
      const onRemove = vi.fn()
      const staff = { ...defaultStaff, user: undefined }
      const { container } = render(<AssignedStaffBadge staff={staff} onRemove={onRemove} />)
      const button = container.querySelector('button')
      expect(button?.getAttribute('title')).toBe('Remove Unknown')
    })

    it('calls onRemove with staff ID when remove button clicked', async () => {
      const user = userEvent.setup()
      const onRemove = vi.fn()
      const { container } = render(<AssignedStaffBadge staff={defaultStaff} onRemove={onRemove} />)

      const button = container.querySelector('button')
      expect(button).toBeDefined()
      await user.click(button!)

      expect(onRemove).toHaveBeenCalledOnce()
      expect(onRemove).toHaveBeenCalledWith('staff-1')
    })

    it('stops event propagation when remove button clicked', async () => {
      const user = userEvent.setup()
      const onRemove = vi.fn()
      const onClick = vi.fn()

      const { container } = render(
        <div onClick={onClick}>
          <AssignedStaffBadge staff={defaultStaff} onRemove={onRemove} />
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
      const { container } = render(<AssignedStaffBadge staff={defaultStaff} onRemove={onRemove} />)
      const button = container.querySelector('button')
      expect(button?.className).toContain('opacity-0')
      expect(button?.className).toContain('group-hover:opacity-100')
    })

    it('renders X icon in remove button', () => {
      const onRemove = vi.fn()
      const { container } = render(<AssignedStaffBadge staff={defaultStaff} onRemove={onRemove} />)
      const button = container.querySelector('button')
      expect(button).toBeDefined()
      // Icon is rendered (lucide-react renders as SVG)
      const svg = button?.querySelector('svg')
      expect(svg).toBeDefined()
    })

    it('applies correct role badge styling', () => {
      const { container } = render(<AssignedStaffBadge staff={defaultStaff} />)
      const roleBadge = container.querySelector('.bg-slate-100')
      expect(roleBadge).toBeDefined()
      expect(roleBadge?.className).toContain('text-slate-400')
    })
  })
})
