import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RoomScheduleDragOverlay } from '../RoomScheduleDragOverlay'
import type { Active } from '@dnd-kit/core'
import type { SurgeonDragData, StaffDragData } from '@/types/room-scheduling'

function makeActive(data: SurgeonDragData | StaffDragData): Active {
  return {
    id: 'test-drag',
    data: { current: data },
    rect: { current: { initial: null, translated: null } },
  } as unknown as Active
}

describe('RoomScheduleDragOverlay', () => {
  it('renders nothing when active is null', () => {
    const { container } = render(<RoomScheduleDragOverlay active={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders surgeon preview when dragging a surgeon', () => {
    const surgeonData: SurgeonDragData = {
      type: 'surgeon',
      surgeonId: 'surg-1',
      surgeon: { id: 'surg-1', first_name: 'John', last_name: 'Smith' },
    }

    render(<RoomScheduleDragOverlay active={makeActive(surgeonData)} />)

    expect(screen.getByText('Dr. Smith')).toBeDefined()
    expect(screen.getByText('JS')).toBeDefined()
  })

  it('renders staff preview when dragging a staff member', () => {
    const staffData: StaffDragData = {
      type: 'staff',
      userId: 'user-1',
      roleId: 'role-1',
      user: { id: 'user-1', first_name: 'Jane', last_name: 'Doe' },
      roleName: 'RN',
    }

    render(<RoomScheduleDragOverlay active={makeActive(staffData)} />)

    expect(screen.getByText('Jane Doe')).toBeDefined()
    expect(screen.getByText('JD')).toBeDefined()
    expect(screen.getByText('RN')).toBeDefined()
  })

  it('applies blue border to surgeon overlay', () => {
    const surgeonData: SurgeonDragData = {
      type: 'surgeon',
      surgeonId: 'surg-1',
      surgeon: { id: 'surg-1', first_name: 'John', last_name: 'Smith' },
    }

    const { container } = render(
      <RoomScheduleDragOverlay active={makeActive(surgeonData)} />
    )

    expect(container.querySelector('.border-blue-400')).not.toBeNull()
  })

  it('applies slate border to staff overlay', () => {
    const staffData: StaffDragData = {
      type: 'staff',
      userId: 'user-1',
      roleId: 'role-1',
      user: { id: 'user-1', first_name: 'Jane', last_name: 'Doe' },
      roleName: 'Nurse',
    }

    const { container } = render(
      <RoomScheduleDragOverlay active={makeActive(staffData)} />
    )

    expect(container.querySelector('.border-slate-400')).not.toBeNull()
  })

  it('renders nothing when active has no data', () => {
    const emptyActive = {
      id: 'test-drag',
      data: { current: undefined },
      rect: { current: { initial: null, translated: null } },
    } as unknown as Active

    const { container } = render(<RoomScheduleDragOverlay active={emptyActive} />)
    expect(container.innerHTML).toBe('')
  })
})
