import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
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

function renderCard(staff: StaffMember = mockStaff) {
  return render(
    <DndContext>
      <DraggableStaffCard staff={staff} />
    </DndContext>
  )
}

describe('DraggableStaffCard', () => {
  it('renders staff name', () => {
    renderCard()
    expect(screen.getByText('Jane Doe')).toBeDefined()
  })

  it('renders staff initials', () => {
    renderCard()
    expect(screen.getByText('JD')).toBeDefined()
  })

  it('renders role name', () => {
    renderCard()
    expect(screen.getByText('Nurse')).toBeDefined()
  })

  it('shows "Staff" when no role is defined', () => {
    const noRole: StaffMember = { ...mockStaff, user_roles: undefined }
    renderCard(noRole)
    expect(screen.getByText('Staff')).toBeDefined()
  })

  it('has grab cursor styling', () => {
    const { container } = renderCard()
    const card = container.querySelector('[class*="cursor-grab"]')
    expect(card).not.toBeNull()
  })

  it('renders correctly within DndContext', () => {
    const { container } = renderCard()
    expect(container.firstElementChild).not.toBeNull()
  })
})
