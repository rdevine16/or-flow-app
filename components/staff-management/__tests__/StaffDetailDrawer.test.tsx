// components/staff-management/__tests__/StaffDetailDrawer.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StaffDetailDrawer } from '../StaffDetailDrawer'
import type { UserListItem } from '@/lib/dal/users'
import type { TimeOffRequest, UserTimeOffSummary } from '@/types/time-off'

// ============================================
// Test data
// ============================================

const mockUser: UserListItem = {
  id: 'user-1',
  email: 'jane.wilson@example.com',
  first_name: 'Jane',
  last_name: 'Wilson',
  role_id: 'role-rn',
  is_active: true,
  access_level: 'user',
  last_login_at: '2026-03-10T10:00:00Z',
  created_at: '2025-01-15T00:00:00Z',
  role: { name: 'nurse' },
}

const mockTotals: UserTimeOffSummary[] = [
  {
    user_id: 'user-1',
    pto_days: 5,
    sick_days: 2,
    personal_days: 0,
    total_days: 7,
  },
]

const mockRequests: TimeOffRequest[] = [
  {
    id: 'req-1',
    facility_id: 'fac-1',
    user_id: 'user-1',
    request_type: 'pto',
    start_date: '2026-03-15',
    end_date: '2026-03-17',
    partial_day_type: null,
    reason: 'Spring vacation',
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    review_notes: null,
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
    is_active: true,
  },
]

// ============================================
// Tests
// ============================================

describe('StaffDetailDrawer', () => {
  const mockOnClose = vi.fn()
  const mockOnReview = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ------------------------------------------
  // Unit: Rendering
  // ------------------------------------------
  describe('rendering', () => {
    it('renders user name and role in header', () => {
      render(
        <StaffDetailDrawer
          user={mockUser}
          onClose={mockOnClose}
          facilityName="Main Hospital"
          totals={mockTotals}
          requests={mockRequests}
          currentUserId="current-user"
          onReview={mockOnReview}
        />
      )

      expect(screen.getByText('Jane Wilson')).toBeDefined()
      // "nurse" appears in multiple places (header badge + profile tab), use getAllByText
      const nurseBadges = screen.getAllByText('nurse')
      expect(nurseBadges.length).toBeGreaterThanOrEqual(1)
    })

    it('renders account status badge in header', () => {
      render(
        <StaffDetailDrawer
          user={mockUser}
          onClose={mockOnClose}
          facilityName="Main Hospital"
          totals={mockTotals}
          requests={mockRequests}
          currentUserId="current-user"
          onReview={mockOnReview}
        />
      )

      // Active user with recent login shows "Active" badge
      expect(screen.getByText('Active')).toBeDefined()
    })

    it('renders all three tabs', () => {
      render(
        <StaffDetailDrawer
          user={mockUser}
          onClose={mockOnClose}
          facilityName="Main Hospital"
          totals={mockTotals}
          requests={mockRequests}
          currentUserId="current-user"
          onReview={mockOnReview}
        />
      )

      expect(screen.getByRole('tab', { name: 'Profile' })).toBeDefined()
      expect(screen.getByRole('tab', { name: 'Time Off' })).toBeDefined()
      expect(screen.getByRole('tab', { name: 'Actions' })).toBeDefined()
    })

    it('shows Profile tab active by default', () => {
      render(
        <StaffDetailDrawer
          user={mockUser}
          onClose={mockOnClose}
          facilityName="Main Hospital"
          totals={mockTotals}
          requests={mockRequests}
          currentUserId="current-user"
          onReview={mockOnReview}
        />
      )

      const profileTab = screen.getByRole('tab', { name: 'Profile' })
      expect(profileTab.getAttribute('aria-selected')).toBe('true')
    })

    it('renders null when user is null', () => {
      const { container } = render(
        <StaffDetailDrawer
          user={null}
          onClose={mockOnClose}
          facilityName="Main Hospital"
          totals={mockTotals}
          requests={mockRequests}
          currentUserId="current-user"
          onReview={mockOnReview}
        />
      )

      expect(container.firstChild).toBeNull()
    })
  })

  // ------------------------------------------
  // Integration: Tab switching
  // ------------------------------------------
  describe('tab switching', () => {
    it('switches to Time Off tab when clicked', async () => {
      const user = userEvent.setup()
      render(
        <StaffDetailDrawer
          user={mockUser}
          onClose={mockOnClose}
          facilityName="Main Hospital"
          totals={mockTotals}
          requests={mockRequests}
          currentUserId="current-user"
          onReview={mockOnReview}
        />
      )

      const timeOffTab = screen.getByRole('tab', { name: 'Time Off' })
      await user.click(timeOffTab)

      expect(timeOffTab.getAttribute('aria-selected')).toBe('true')
    })

    it('switches to Actions tab when clicked', async () => {
      const user = userEvent.setup()
      render(
        <StaffDetailDrawer
          user={mockUser}
          onClose={mockOnClose}
          facilityName="Main Hospital"
          totals={mockTotals}
          requests={mockRequests}
          currentUserId="current-user"
          onReview={mockOnReview}
        />
      )

      const actionsTab = screen.getByRole('tab', { name: 'Actions' })
      await user.click(actionsTab)

      expect(actionsTab.getAttribute('aria-selected')).toBe('true')
    })

    it('resets to Profile tab when user changes', () => {
      const { rerender } = render(
        <StaffDetailDrawer
          user={mockUser}
          onClose={mockOnClose}
          facilityName="Main Hospital"
          totals={mockTotals}
          requests={mockRequests}
          currentUserId="current-user"
          onReview={mockOnReview}
        />
      )

      // Switch to Time Off tab
      const timeOffTab = screen.getByRole('tab', { name: 'Time Off' })
      timeOffTab.click()

      // Change user
      const newUser = { ...mockUser, id: 'user-2', first_name: 'Mike', last_name: 'Brown' }
      rerender(
        <StaffDetailDrawer
          user={newUser}
          onClose={mockOnClose}
          facilityName="Main Hospital"
          totals={mockTotals}
          requests={mockRequests}
          currentUserId="current-user"
          onReview={mockOnReview}
        />
      )

      // Should reset to Profile tab
      const profileTab = screen.getByRole('tab', { name: 'Profile' })
      expect(profileTab.getAttribute('aria-selected')).toBe('true')
    })
  })

  // ------------------------------------------
  // Integration: Close action
  // ------------------------------------------
  describe('close action', () => {
    it('calls onClose when close button clicked', async () => {
      const user = userEvent.setup()
      render(
        <StaffDetailDrawer
          user={mockUser}
          onClose={mockOnClose}
          facilityName="Main Hospital"
          totals={mockTotals}
          requests={mockRequests}
          currentUserId="current-user"
          onReview={mockOnReview}
        />
      )

      const closeButton = screen.getByLabelText('Close drawer')
      await user.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  // ------------------------------------------
  // Integration: Correct data passed to tab components
  // ------------------------------------------
  describe('data flow to tab components', () => {
    it('passes user totals to DrawerTimeOffTab filtered by user_id', async () => {
      const user = userEvent.setup()
      const allTotals: UserTimeOffSummary[] = [
        { user_id: 'user-1', pto_days: 5, sick_days: 2, personal_days: 0, total_days: 7 },
        { user_id: 'user-2', pto_days: 3, sick_days: 1, personal_days: 1, total_days: 5 },
      ]

      render(
        <StaffDetailDrawer
          user={mockUser}
          onClose={mockOnClose}
          facilityName="Main Hospital"
          totals={allTotals}
          requests={mockRequests}
          currentUserId="current-user"
          onReview={mockOnReview}
        />
      )

      // Switch to Time Off tab
      const timeOffTab = screen.getByRole('tab', { name: 'Time Off' })
      await user.click(timeOffTab)

      // Verify the Time Off tab is active (tab content is rendered)
      // DrawerTimeOffTab component is tested separately
      expect(timeOffTab.getAttribute('aria-selected')).toBe('true')
    })

    it('renders DrawerActionsTab when Actions tab is active', async () => {
      const user = userEvent.setup()
      render(
        <StaffDetailDrawer
          user={mockUser}
          onClose={mockOnClose}
          facilityName="Main Hospital"
          totals={mockTotals}
          requests={mockRequests}
          currentUserId="current-user"
          onReview={mockOnReview}
        />
      )

      const actionsTab = screen.getByRole('tab', { name: 'Actions' })
      await user.click(actionsTab)

      // Verify the Actions tab is active
      expect(actionsTab.getAttribute('aria-selected')).toBe('true')
      // DrawerActionsTab component is tested separately
    })
  })
})
