// components/staff-management/__tests__/DrawerActionsTab.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DrawerActionsTab } from '../DrawerActionsTab'
import type { UserListItem } from '@/lib/dal/users'

// ============================================
// Mocks
// ============================================

const mockUpdateUser = vi.fn()
const mockDeactivateUser = vi.fn()
const mockReactivateUser = vi.fn()

vi.mock('@/lib/dal/users', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/dal/users')>()
  return {
    ...actual,
    usersDAL: {
      ...actual.usersDAL,
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      deactivateUser: (...args: unknown[]) => mockDeactivateUser(...args),
      reactivateUser: (...args: unknown[]) => mockReactivateUser(...args),
    },
  }
})

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({ from: vi.fn() }),
}))

const mockShowToast = vi.fn()
vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@/lib/audit-logger', () => ({
  userAudit: {
    updated: vi.fn().mockResolvedValue(undefined),
    invited: vi.fn().mockResolvedValue(undefined),
    deactivated: vi.fn().mockResolvedValue(undefined),
    reactivated: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/hooks/useLookups', () => ({
  useUserRoles: () => ({
    data: [
      { id: 'role-rn', name: 'nurse' },
      { id: 'role-st', name: 'scrub tech' },
    ],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))

// ============================================
// Test data
// ============================================

const activeUser: UserListItem = {
  id: 'user-1',
  email: 'jane@example.com',
  first_name: 'Jane',
  last_name: 'Wilson',
  role_id: 'role-rn',
  is_active: true,
  access_level: 'user',
  last_login_at: '2026-03-10T10:00:00Z',
  created_at: '2025-01-15T00:00:00Z',
  role: { name: 'nurse' },
}

const pendingUser: UserListItem = {
  ...activeUser,
  id: 'user-2',
  last_login_at: null,
}

const noEmailUser: UserListItem = {
  ...activeUser,
  id: 'user-3',
  email: '' as string,
}

const inactiveUser: UserListItem = {
  ...activeUser,
  id: 'user-4',
  is_active: false,
}

const mockOnUserUpdated = vi.fn()

// ============================================
// Tests
// ============================================

describe('DrawerActionsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateUser.mockResolvedValue({ data: activeUser, error: null })
    mockDeactivateUser.mockResolvedValue({ data: { id: 'user-1' }, error: null })
    mockReactivateUser.mockResolvedValue({ data: { id: 'user-4' }, error: null })
  })

  // ------------------------------------------
  // Unit: Rendering
  // ------------------------------------------
  describe('rendering', () => {
    it('renders Edit Profile button for active user', () => {
      render(
        <DrawerActionsTab user={activeUser} currentUserId="other-user" onUserUpdated={mockOnUserUpdated} />
      )

      expect(screen.getByText('Edit Profile')).toBeDefined()
    })

    it('renders Deactivate button for non-self active user', () => {
      render(
        <DrawerActionsTab user={activeUser} currentUserId="other-user" onUserUpdated={mockOnUserUpdated} />
      )

      expect(screen.getByText('Deactivate Account')).toBeDefined()
    })

    it('does not render Deactivate button for self', () => {
      render(
        <DrawerActionsTab user={activeUser} currentUserId="user-1" onUserUpdated={mockOnUserUpdated} />
      )

      expect(screen.queryByText('Deactivate Account')).toBeNull()
      expect(screen.getByText(/cannot deactivate your own/)).toBeDefined()
    })

    it('renders Reactivate button for inactive user', () => {
      render(
        <DrawerActionsTab user={inactiveUser} currentUserId="other-user" onUserUpdated={mockOnUserUpdated} />
      )

      expect(screen.getByText('Reactivate Account')).toBeDefined()
    })

    it('renders Send Invite for pending user with email', () => {
      render(
        <DrawerActionsTab user={pendingUser} currentUserId="other-user" onUserUpdated={mockOnUserUpdated} />
      )

      expect(screen.getByText('Resend Invite')).toBeDefined()
    })

    it('shows no-email hint for user without email', () => {
      render(
        <DrawerActionsTab user={noEmailUser} currentUserId="other-user" onUserUpdated={mockOnUserUpdated} />
      )

      expect(screen.getByText(/no email address/)).toBeDefined()
    })
  })

  // ------------------------------------------
  // Integration: Edit Profile flow
  // ------------------------------------------
  describe('edit profile', () => {
    it('shows edit form when Edit Profile clicked', async () => {
      const user = userEvent.setup()
      render(
        <DrawerActionsTab user={activeUser} currentUserId="other-user" onUserUpdated={mockOnUserUpdated} />
      )

      await user.click(screen.getByText('Edit Profile'))

      expect(screen.getByLabelText('First Name')).toBeDefined()
      expect(screen.getByLabelText('Last Name')).toBeDefined()
    })

    it('hides edit form when Cancel clicked', async () => {
      const user = userEvent.setup()
      render(
        <DrawerActionsTab user={activeUser} currentUserId="other-user" onUserUpdated={mockOnUserUpdated} />
      )

      await user.click(screen.getByText('Edit Profile'))
      expect(screen.getByLabelText('First Name')).toBeDefined()

      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByLabelText('First Name')).toBeNull()
    })

    it('calls DAL updateUser on save and triggers onUserUpdated', async () => {
      const user = userEvent.setup()
      render(
        <DrawerActionsTab user={activeUser} currentUserId="other-user" onUserUpdated={mockOnUserUpdated} />
      )

      await user.click(screen.getByText('Edit Profile'))

      const firstNameInput = screen.getByLabelText('First Name')
      await user.clear(firstNameInput)
      await user.type(firstNameInput, 'Janet')

      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      expect(mockUpdateUser).toHaveBeenCalledTimes(1)
      expect(mockUpdateUser).toHaveBeenCalledWith(
        expect.anything(), // supabase client
        'user-1',
        expect.objectContaining({ first_name: 'Janet' })
      )
      expect(mockOnUserUpdated).toHaveBeenCalled()
    })

    it('shows error toast when update fails', async () => {
      mockUpdateUser.mockResolvedValue({ data: null, error: { message: 'DB error' } })
      const user = userEvent.setup()
      render(
        <DrawerActionsTab user={activeUser} currentUserId="other-user" onUserUpdated={mockOnUserUpdated} />
      )

      await user.click(screen.getByText('Edit Profile'))

      const firstNameInput = screen.getByLabelText('First Name')
      await user.clear(firstNameInput)
      await user.type(firstNameInput, 'Janet')

      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', title: 'Update Failed' })
      )
    })
  })

  // ------------------------------------------
  // Integration: Deactivate flow
  // ------------------------------------------
  describe('deactivate', () => {
    it('shows confirmation dialog when Deactivate clicked', async () => {
      const user = userEvent.setup()
      render(
        <DrawerActionsTab user={activeUser} currentUserId="other-user" onUserUpdated={mockOnUserUpdated} />
      )

      await user.click(screen.getByText('Deactivate Account'))

      // Confirmation dialog should appear
      expect(screen.getByText(/Deactivate Jane Wilson/)).toBeDefined()
    })

    it('deactivates user when confirmed', async () => {
      const user = userEvent.setup()
      render(
        <DrawerActionsTab user={activeUser} currentUserId="other-user" onUserUpdated={mockOnUserUpdated} />
      )

      await user.click(screen.getByText('Deactivate Account'))
      await user.click(screen.getByRole('button', { name: 'Deactivate' }))

      expect(mockDeactivateUser).toHaveBeenCalledWith(expect.anything(), 'user-1')
      expect(mockOnUserUpdated).toHaveBeenCalled()
    })
  })

  // ------------------------------------------
  // Integration: Reactivate flow
  // ------------------------------------------
  describe('reactivate', () => {
    it('reactivates user when Reactivate clicked', async () => {
      const user = userEvent.setup()
      render(
        <DrawerActionsTab user={inactiveUser} currentUserId="other-user" onUserUpdated={mockOnUserUpdated} />
      )

      await user.click(screen.getByText('Reactivate Account'))

      expect(mockReactivateUser).toHaveBeenCalledWith(expect.anything(), 'user-4')
      expect(mockOnUserUpdated).toHaveBeenCalled()
    })
  })

  // ------------------------------------------
  // Workflow: Edit → Save → Refresh
  // ------------------------------------------
  describe('workflow', () => {
    it('edit profile → modify name → save → calls onUserUpdated', async () => {
      const user = userEvent.setup()
      render(
        <DrawerActionsTab user={activeUser} currentUserId="other-user" onUserUpdated={mockOnUserUpdated} />
      )

      // 1. Click Edit Profile
      await user.click(screen.getByText('Edit Profile'))

      // 2. Modify first name
      const firstNameInput = screen.getByLabelText('First Name')
      await user.clear(firstNameInput)
      await user.type(firstNameInput, 'Janet')

      // 3. Save
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      // 4. Verify update was called
      expect(mockUpdateUser).toHaveBeenCalledTimes(1)

      // 5. Verify refresh triggered
      expect(mockOnUserUpdated).toHaveBeenCalledTimes(1)

      // 6. Success toast shown
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success', title: 'Profile Updated' })
      )
    })
  })
})
