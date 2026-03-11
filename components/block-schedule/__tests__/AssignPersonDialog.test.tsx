// components/block-schedule/__tests__/AssignPersonDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssignPersonDialog } from '../AssignPersonDialog'
import type { Surgeon } from '@/hooks/useLookups'
import type { StaffMember } from '@/types/staff-assignment'

const mockSurgeons: Surgeon[] = [
  { id: 'surg-1', first_name: 'John', last_name: 'Smith', email: '', profile_image_url: null, role_id: 'r1', facility_id: 'f1' },
  { id: 'surg-2', first_name: 'Sarah', last_name: 'Johnson', email: '', profile_image_url: null, role_id: 'r1', facility_id: 'f1' },
]

const mockStaff: StaffMember[] = [
  { id: 'staff-1', first_name: 'Jane', last_name: 'Doe', email: '', profile_image_url: null, role_id: 'role-rn', facility_id: 'f1', user_roles: { name: 'RN' } },
  { id: 'staff-2', first_name: 'Bob', last_name: 'Tech', email: '', profile_image_url: null, role_id: 'role-st', facility_id: 'f1', user_roles: { name: 'ST' } },
  // Surgeon in staff list (should be filtered out)
  { id: 'staff-3', first_name: 'Alice', last_name: 'Surgeon', email: '', profile_image_url: null, role_id: 'role-surg', facility_id: 'f1', user_roles: { name: 'Surgeon' } },
]

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  roomName: 'OR 1',
  date: '2026-03-09',
  surgeons: mockSurgeons,
  staff: mockStaff,
  onAssignSurgeon: vi.fn(),
  onAssignStaff: vi.fn(),
  assignedSurgeonIds: new Set<string>(),
  assignedStaffIds: new Set<string>(),
}

describe('AssignPersonDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = render(<AssignPersonDialog {...defaultProps} isOpen={false} />)
      expect(container.innerHTML).toBe('')
    })

    it('renders room name and date in header', () => {
      render(<AssignPersonDialog {...defaultProps} />)
      expect(screen.getByText('Assign to OR 1')).toBeDefined()
      // Date formatted as "Mon, Mar 9"
      expect(screen.getByText(/Mon, Mar 9/)).toBeDefined()
    })

    it('renders surgeons tab by default', () => {
      render(<AssignPersonDialog {...defaultProps} />)
      expect(screen.getByText('Dr. Smith')).toBeDefined()
      expect(screen.getByText('Dr. Johnson')).toBeDefined()
    })

    it('shows surgeon count in tab label', () => {
      render(<AssignPersonDialog {...defaultProps} />)
      expect(screen.getByText('Surgeons (2)')).toBeDefined()
    })

    it('shows staff count excluding surgeons in tab label', () => {
      render(<AssignPersonDialog {...defaultProps} />)
      // Only 2 non-surgeon staff (Jane Doe and Bob Tech)
      expect(screen.getByText('Staff (2)')).toBeDefined()
    })
  })

  describe('tab switching', () => {
    it('switches to staff tab when clicked', async () => {
      const user = userEvent.setup()
      render(<AssignPersonDialog {...defaultProps} />)

      await user.click(screen.getByText(/Staff \(2\)/))
      expect(screen.getByText('Jane Doe')).toBeDefined()
      expect(screen.getByText('Bob Tech')).toBeDefined()
      // Surgeon should be filtered out
      expect(screen.queryByText('Alice Surgeon')).toBeNull()
    })

    it('shows role labels on staff items', async () => {
      const user = userEvent.setup()
      render(<AssignPersonDialog {...defaultProps} />)

      await user.click(screen.getByText(/Staff \(2\)/))
      expect(screen.getByText('RN')).toBeDefined()
      expect(screen.getByText('ST')).toBeDefined()
    })
  })

  describe('search filtering', () => {
    it('filters surgeons by search text', async () => {
      const user = userEvent.setup()
      render(<AssignPersonDialog {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search...')
      await user.type(searchInput, 'smith')

      expect(screen.getByText('Dr. Smith')).toBeDefined()
      expect(screen.queryByText('Dr. Johnson')).toBeNull()
    })

    it('filters staff by search text', async () => {
      const user = userEvent.setup()
      render(<AssignPersonDialog {...defaultProps} />)

      await user.click(screen.getByText(/Staff \(2\)/))
      const searchInput = screen.getByPlaceholderText('Search...')
      await user.type(searchInput, 'doe')

      expect(screen.getByText('Jane Doe')).toBeDefined()
      expect(screen.queryByText('Bob Tech')).toBeNull()
    })

    it('shows "No surgeons found" when search has no results', async () => {
      const user = userEvent.setup()
      render(<AssignPersonDialog {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search...')
      await user.type(searchInput, 'zzzzz')

      expect(screen.getByText('No surgeons found')).toBeDefined()
    })
  })

  describe('assignment callbacks', () => {
    it('calls onAssignSurgeon and onClose when surgeon clicked', async () => {
      const user = userEvent.setup()
      render(<AssignPersonDialog {...defaultProps} />)

      await user.click(screen.getByText('Dr. Smith'))

      expect(defaultProps.onAssignSurgeon).toHaveBeenCalledWith('surg-1')
      expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('calls onAssignStaff and onClose when staff clicked', async () => {
      const user = userEvent.setup()
      render(<AssignPersonDialog {...defaultProps} />)

      await user.click(screen.getByText(/Staff \(2\)/))
      await user.click(screen.getByText('Jane Doe'))

      expect(defaultProps.onAssignStaff).toHaveBeenCalledWith('staff-1', 'role-rn')
      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  describe('already assigned indicators', () => {
    it('disables surgeon that is already assigned', () => {
      render(
        <AssignPersonDialog
          {...defaultProps}
          assignedSurgeonIds={new Set(['surg-1'])}
        />
      )

      // Dr. Smith's button should be disabled
      const buttons = screen.getAllByRole('button')
      const smithButton = buttons.find((b) => b.textContent?.includes('Dr. Smith'))
      expect(smithButton?.hasAttribute('disabled')).toBe(true)
      expect(screen.getByText('Assigned today')).toBeDefined()
    })

    it('disables staff that is already assigned', async () => {
      const user = userEvent.setup()
      render(
        <AssignPersonDialog
          {...defaultProps}
          assignedStaffIds={new Set(['staff-1'])}
        />
      )

      await user.click(screen.getByText(/Staff/))

      const buttons = screen.getAllByRole('button')
      const doeButton = buttons.find((b) => b.textContent?.includes('Jane Doe'))
      expect(doeButton?.hasAttribute('disabled')).toBe(true)
    })
  })

  describe('closing behavior', () => {
    it('calls onClose when close button clicked', async () => {
      const user = userEvent.setup()
      render(<AssignPersonDialog {...defaultProps} />)

      await user.click(screen.getByLabelText('Close'))

      expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('calls onClose when backdrop clicked', async () => {
      const user = userEvent.setup()
      render(<AssignPersonDialog {...defaultProps} />)

      // Click the backdrop (outer div with role="dialog")
      const dialog = screen.getByRole('dialog')
      await user.click(dialog)

      expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('calls onClose when Escape pressed', () => {
      render(<AssignPersonDialog {...defaultProps} />)

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('has dialog role and aria-modal', () => {
      render(<AssignPersonDialog {...defaultProps} />)
      const dialog = screen.getByRole('dialog')
      expect(dialog.getAttribute('aria-modal')).toBe('true')
    })

    it('has tablist for surgeon/staff tabs', () => {
      render(<AssignPersonDialog {...defaultProps} />)
      expect(screen.getByRole('tablist')).toBeDefined()
    })

    it('autofocuses search input', () => {
      render(<AssignPersonDialog {...defaultProps} />)
      const searchInput = screen.getByPlaceholderText('Search...')
      expect(document.activeElement).toBe(searchInput)
    })
  })
})
