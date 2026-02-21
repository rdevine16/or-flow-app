// app/admin/facilities/new/__tests__/AdminStep.test.tsx
// Tests for AdminStep component (Step 2 of facility wizard)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AdminStep from '../AdminStep'
import type { AdminData } from '../types'
import { DEFAULT_ADMIN_DATA } from '../types'

// Mock useUserRoles hook
vi.mock('@/hooks/useLookups', () => ({
  useUserRoles: vi.fn(() => ({
    data: [
      { id: 'role-1', name: 'admin' },
      { id: 'role-2', name: 'facility_manager' },
      { id: 'role-3', name: 'staff_member' },
    ],
    loading: false,
    error: null,
    refresh: vi.fn(),
  })),
}))

describe('AdminStep', () => {
  const mockOnChange = vi.fn()
  const mockOnSendWelcomeEmailChange = vi.fn()

  function setup(
    data: Partial<AdminData> = {},
    sendWelcomeEmail = true
  ) {
    const adminData: AdminData = { ...DEFAULT_ADMIN_DATA, ...data }
    const props = {
      data: adminData,
      onChange: mockOnChange,
      sendWelcomeEmail,
      onSendWelcomeEmailChange: mockOnSendWelcomeEmailChange,
    }
    return render(<AdminStep {...props} />)
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // RENDERING
  // ============================================================================

  describe('Rendering', () => {
    it('renders the admin step with correct heading and description', () => {
      setup()
      expect(screen.getByText('First Administrator')).toBeTruthy()
      expect(screen.getByText(/This person will manage the facility/)).toBeTruthy()
    })

    it('renders all required field labels with asterisks', () => {
      setup()
      expect(screen.getByText(/First Name/)).toBeTruthy()
      expect(screen.getByText(/Last Name/)).toBeTruthy()
      expect(screen.getByText(/Email Address/)).toBeTruthy()
      expect(screen.getByText(/Role/)).toBeTruthy()
    })

    it('renders first name input with correct value', () => {
      setup({ firstName: 'Jane' })
      const input = screen.getByTestId('admin-first-name-input') as HTMLInputElement
      expect(input.value).toBe('Jane')
    })

    it('renders last name input with correct value', () => {
      setup({ lastName: 'Smith' })
      const input = screen.getByTestId('admin-last-name-input') as HTMLInputElement
      expect(input.value).toBe('Smith')
    })

    it('renders email input with correct value', () => {
      setup({ email: 'jane.smith@hospital.com' })
      const input = screen.getByTestId('admin-email-input') as HTMLInputElement
      expect(input.value).toBe('jane.smith@hospital.com')
    })

    it('renders role select with default empty value', () => {
      setup()
      const select = screen.getByTestId('admin-role-select') as HTMLSelectElement
      expect(select.value).toBe('')
    })

    it('renders role select with options from useUserRoles', () => {
      setup()
      expect(screen.getByText('Admin')).toBeTruthy()
      expect(screen.getByText('Facility manager')).toBeTruthy()
      expect(screen.getByText('Staff member')).toBeTruthy()
    })

    it('renders info banner about invitation email', () => {
      setup()
      expect(screen.getByTestId('admin-info-banner')).toBeTruthy()
      expect(screen.getByText('Invitation Email')).toBeTruthy()
      expect(screen.getByText(/An invitation email will be sent/)).toBeTruthy()
    })

    it('renders send welcome email toggle', () => {
      setup()
      expect(screen.getByTestId('send-welcome-email-toggle')).toBeTruthy()
      expect(screen.getByText('Send welcome email')).toBeTruthy()
    })

    it('renders welcome email checkbox as checked by default', () => {
      setup({}, true)
      const checkbox = screen.getByTestId('send-welcome-email-toggle').querySelector('input') as HTMLInputElement
      expect(checkbox.checked).toBe(true)
    })

    it('renders welcome email checkbox as unchecked when prop is false', () => {
      setup({}, false)
      const checkbox = screen.getByTestId('send-welcome-email-toggle').querySelector('input') as HTMLInputElement
      expect(checkbox.checked).toBe(false)
    })
  })

  // ============================================================================
  // FIELD UPDATES
  // ============================================================================

  describe('Field Updates', () => {
    it('calls onChange when first name is updated', () => {
      setup()
      const input = screen.getByTestId('admin-first-name-input')
      fireEvent.change(input, { target: { value: 'Jane' } })
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Jane' })
      )
    })

    it('calls onChange when last name is updated', () => {
      setup()
      const input = screen.getByTestId('admin-last-name-input')
      fireEvent.change(input, { target: { value: 'Smith' } })
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ lastName: 'Smith' })
      )
    })

    it('calls onChange when email is updated', () => {
      setup()
      const input = screen.getByTestId('admin-email-input')
      fireEvent.change(input, { target: { value: 'jane.smith@hospital.com' } })
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'jane.smith@hospital.com' })
      )
    })

    it('calls onChange when role is selected', () => {
      setup()
      const select = screen.getByTestId('admin-role-select')
      fireEvent.change(select, { target: { value: 'role-2' } })
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ roleId: 'role-2' })
      )
    })

    it('calls onSendWelcomeEmailChange when checkbox is toggled', () => {
      setup({}, true)
      const checkbox = screen.getByTestId('send-welcome-email-toggle').querySelector('input') as HTMLInputElement
      fireEvent.click(checkbox)
      expect(mockOnSendWelcomeEmailChange).toHaveBeenCalledWith(false)
    })

    it('calls onSendWelcomeEmailChange when checkbox is toggled from unchecked to checked', () => {
      setup({}, false)
      const checkbox = screen.getByTestId('send-welcome-email-toggle').querySelector('input') as HTMLInputElement
      fireEvent.click(checkbox)
      expect(mockOnSendWelcomeEmailChange).toHaveBeenCalledWith(true)
    })
  })

  // ============================================================================
  // ROLE LOADING STATE
  // ============================================================================

  describe('Role Loading State', () => {
    it('disables role select when roles are loading', async () => {
      const { useUserRoles } = vi.mocked(await import('@/hooks/useLookups'))
      useUserRoles.mockReturnValueOnce({
        data: [],
        loading: true,
        error: null,
        refresh: vi.fn(),
      })

      setup()
      const select = screen.getByTestId('admin-role-select') as HTMLSelectElement
      expect(select.disabled).toBe(true)
    })

    it('shows "Loading roles..." when roles are loading', async () => {
      const { useUserRoles } = vi.mocked(await import('@/hooks/useLookups'))
      useUserRoles.mockReturnValueOnce({
        data: [],
        loading: true,
        error: null,
        refresh: vi.fn(),
      })

      setup()
      expect(screen.getByText('Loading roles...')).toBeTruthy()
    })

    it('shows "Select a role" when roles are loaded', () => {
      setup()
      expect(screen.getByText('Select a role')).toBeTruthy()
    })
  })

  // ============================================================================
  // ROLE NAME FORMATTING
  // ============================================================================

  describe('Role Name Formatting', () => {
    it('capitalizes first letter of role name', () => {
      setup()
      expect(screen.getByText('Admin')).toBeTruthy()
    })

    it('replaces underscores with spaces in role name', () => {
      setup()
      expect(screen.getByText('Facility manager')).toBeTruthy()
      expect(screen.getByText('Staff member')).toBeTruthy()
    })
  })

  // ============================================================================
  // FORM STRUCTURE
  // ============================================================================

  describe('Form Structure', () => {
    it('uses email input type for email field', () => {
      setup()
      const input = screen.getByTestId('admin-email-input')
      expect(input.getAttribute('type')).toBe('email')
    })

    it('uses text input type for name fields', () => {
      setup()
      const firstNameInput = screen.getByTestId('admin-first-name-input')
      const lastNameInput = screen.getByTestId('admin-last-name-input')
      expect(firstNameInput.getAttribute('type')).toBe('text')
      expect(lastNameInput.getAttribute('type')).toBe('text')
    })
  })
})
