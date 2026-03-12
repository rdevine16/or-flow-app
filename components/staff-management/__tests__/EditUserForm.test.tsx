// components/staff-management/__tests__/EditUserForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditUserForm } from '../EditUserForm'

// Mock useLookups
vi.mock('@/hooks/useLookups', () => ({
  useUserRoles: () => ({
    data: [
      { id: 'role-rn', name: 'nurse' },
      { id: 'role-st', name: 'scrub tech' },
      { id: 'role-admin', name: 'facility admin' },
    ],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))

// ============================================
// Test data
// ============================================

const defaultInitialValues = {
  first_name: 'Jane',
  last_name: 'Wilson',
  email: 'jane@example.com',
  role_id: 'role-rn',
  access_level: 'user',
}

const defaultProps = {
  userId: 'user-1',
  initialValues: defaultInitialValues,
  isSelf: false,
  loading: false,
  onSave: vi.fn().mockResolvedValue(undefined),
  onCancel: vi.fn(),
}

// ============================================
// Tests
// ============================================

describe('EditUserForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ------------------------------------------
  // Unit: Rendering
  // ------------------------------------------
  describe('rendering', () => {
    it('renders all form fields with initial values', () => {
      render(<EditUserForm {...defaultProps} />)

      expect(screen.getByLabelText('First Name')).toHaveValue('Jane')
      expect(screen.getByLabelText('Last Name')).toHaveValue('Wilson')
      expect(screen.getByLabelText(/Email/)).toHaveValue('jane@example.com')
    })

    it('disables access level select when isSelf is true', () => {
      render(<EditUserForm {...defaultProps} isSelf={true} />)

      const accessSelect = screen.getByLabelText(/Permissions/)
      expect(accessSelect).toBeDisabled()
    })

    it('shows self-warning for permissions when isSelf', () => {
      render(<EditUserForm {...defaultProps} isSelf={true} />)

      expect(screen.getByText(/cannot change your own/)).toBeDefined()
    })
  })

  // ------------------------------------------
  // Unit: Validation
  // ------------------------------------------
  describe('validation', () => {
    it('disables Save when no changes made', () => {
      render(<EditUserForm {...defaultProps} />)

      const saveButton = screen.getByRole('button', { name: 'Save Changes' })
      expect(saveButton).toBeDisabled()
    })

    it('enables Save when field is changed', async () => {
      const user = userEvent.setup()
      render(<EditUserForm {...defaultProps} />)

      const firstNameInput = screen.getByLabelText('First Name')
      await user.clear(firstNameInput)
      await user.type(firstNameInput, 'Janet')

      const saveButton = screen.getByRole('button', { name: 'Save Changes' })
      expect(saveButton).not.toBeDisabled()
    })

    it('disables Save when first name is empty', async () => {
      const user = userEvent.setup()
      render(<EditUserForm {...defaultProps} />)

      const firstNameInput = screen.getByLabelText('First Name')
      await user.clear(firstNameInput)

      const saveButton = screen.getByRole('button', { name: 'Save Changes' })
      expect(saveButton).toBeDisabled()
    })
  })

  // ------------------------------------------
  // Integration: Submit
  // ------------------------------------------
  describe('submit', () => {
    it('calls onSave with only changed fields', async () => {
      const user = userEvent.setup()
      const mockOnSave = vi.fn().mockResolvedValue(undefined)
      render(<EditUserForm {...defaultProps} onSave={mockOnSave} />)

      const firstNameInput = screen.getByLabelText('First Name')
      await user.clear(firstNameInput)
      await user.type(firstNameInput, 'Janet')

      const saveButton = screen.getByRole('button', { name: 'Save Changes' })
      await user.click(saveButton)

      expect(mockOnSave).toHaveBeenCalledWith({ first_name: 'Janet' })
    })

    it('calls onSave with multiple changed fields', async () => {
      const user = userEvent.setup()
      const mockOnSave = vi.fn().mockResolvedValue(undefined)
      render(<EditUserForm {...defaultProps} onSave={mockOnSave} />)

      const firstNameInput = screen.getByLabelText('First Name')
      await user.clear(firstNameInput)
      await user.type(firstNameInput, 'Janet')

      const lastNameInput = screen.getByLabelText('Last Name')
      await user.clear(lastNameInput)
      await user.type(lastNameInput, 'Smith')

      const saveButton = screen.getByRole('button', { name: 'Save Changes' })
      await user.click(saveButton)

      expect(mockOnSave).toHaveBeenCalledWith({
        first_name: 'Janet',
        last_name: 'Smith',
      })
    })

    it('shows loading state when loading prop is true', () => {
      render(<EditUserForm {...defaultProps} loading={true} />)

      expect(screen.getByText('Saving...')).toBeDefined()
    })
  })

  // ------------------------------------------
  // Integration: Cancel
  // ------------------------------------------
  describe('cancel', () => {
    it('calls onCancel when Cancel button is clicked', async () => {
      const user = userEvent.setup()
      const mockOnCancel = vi.fn()
      render(<EditUserForm {...defaultProps} onCancel={mockOnCancel} />)

      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      await user.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    })
  })
})
