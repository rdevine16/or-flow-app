import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DraggableStaffCard } from '../DraggableStaffCard'
import type { StaffMember } from '@/types/staff-assignment'

const mockStaff: StaffMember = {
  id: 'staff-1',
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane@example.com',
  profile_image_url: null,
  role_id: 'role-1',
  facility_id: 'fac-1',
  user_roles: { name: 'Nurse' },
}

describe('DraggableStaffCard', () => {
  it('renders staff name', () => {
    render(<DraggableStaffCard staff={mockStaff} />)
    expect(screen.getByText('Jane Doe')).toBeDefined()
  })

  it('renders staff initials', () => {
    render(<DraggableStaffCard staff={mockStaff} />)
    expect(screen.getByText('JD')).toBeDefined()
  })

  it('renders role name', () => {
    render(<DraggableStaffCard staff={mockStaff} />)
    expect(screen.getByText('Nurse')).toBeDefined()
  })

  it('shows "Staff" when no role is defined', () => {
    const noRole: StaffMember = { ...mockStaff, user_roles: undefined }
    render(<DraggableStaffCard staff={noRole} />)
    expect(screen.getByText('Staff')).toBeDefined()
  })

  it('sets data-staff-id and data-role-id attributes', () => {
    const { container } = render(<DraggableStaffCard staff={mockStaff} />)
    expect(container.querySelector('[data-staff-id="staff-1"]')).not.toBeNull()
    expect(container.querySelector('[data-role-id="role-1"]')).not.toBeNull()
  })

  it('has grab cursor styling', () => {
    const { container } = render(<DraggableStaffCard staff={mockStaff} />)
    const card = container.firstElementChild
    expect(card?.className).toContain('cursor-grab')
  })
})
