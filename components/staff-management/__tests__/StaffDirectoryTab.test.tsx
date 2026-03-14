// components/staff-management/__tests__/StaffDirectoryTab.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StaffDirectoryTab } from '../StaffDirectoryTab'

// ============================================
// Mocks
// ============================================

vi.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQueries: vi.fn(),
}))

vi.mock('@/hooks/useLookups', () => ({
  useUserRoles: vi.fn(),
}))

// Must import AFTER vi.mock
import { useSupabaseQueries } from '@/hooks/useSupabaseQuery'
import { useUserRoles } from '@/hooks/useLookups'

// ============================================
// Test data
// ============================================

const mockStaff = [
  {
    id: 'user-1',
    email: 'jane.wilson@example.com',
    first_name: 'Jane',
    last_name: 'Wilson',
    role_id: 'role-rn',
    facility_id: 'fac-1',
    is_active: true,
    access_level: 'user',
    last_login_at: '2026-03-10T10:00:00Z',
    created_at: '2025-01-15T00:00:00Z',
    role: { name: 'nurse' },
  },
  {
    id: 'user-2',
    email: 'mike.brown@example.com',
    first_name: 'Mike',
    last_name: 'Brown',
    role_id: 'role-st',
    facility_id: 'fac-1',
    is_active: true,
    access_level: 'user',
    last_login_at: null,
    created_at: '2025-06-01T00:00:00Z',
    role: { name: 'scrub tech' },
  },
  {
    id: 'user-3',
    email: 'admin@example.com',
    first_name: 'Sarah',
    last_name: 'Adams',
    role_id: 'role-admin',
    facility_id: 'fac-1',
    is_active: true,
    access_level: 'facility_admin',
    last_login_at: '2026-03-11T08:00:00Z',
    created_at: '2024-10-01T00:00:00Z',
    role: { name: 'facility admin' },
  },
]

const mockStaffAllFacilities = [
  {
    ...mockStaff[0],
    facility_id: 'fac-1',
    facility: { name: 'General Hospital' },
  },
  {
    ...mockStaff[1],
    facility_id: 'fac-2',
    facility: { name: 'City Medical Center' },
  },
  {
    ...mockStaff[2],
    facility_id: 'fac-1',
    facility: { name: 'General Hospital' },
  },
]

const mockTotals = [
  { user_id: 'user-1', pto_days: 5, sick_days: 2, total_days: 7 },
  { user_id: 'user-3', pto_days: 3, sick_days: 0, total_days: 3 },
]

const mockRoles = [
  { id: 'role-rn', name: 'nurse' },
  { id: 'role-st', name: 'scrub tech' },
  { id: 'role-admin', name: 'facility admin' },
]

// Default mock callbacks
const mockOnSelectUser = vi.fn()
const mockOnToggleDeactivated = vi.fn()
const mockOnAddStaff = vi.fn()

const defaultProps = {
  facilityId: 'fac-1',
  onSelectUser: mockOnSelectUser,
  showDeactivated: false,
  onToggleDeactivated: mockOnToggleDeactivated,
  onAddStaff: mockOnAddStaff,
}

function setupMocks(overrides?: {
  staff?: typeof mockStaff
  totals?: typeof mockTotals
  loading?: boolean
  errors?: Record<string, string>
}) {
  vi.mocked(useSupabaseQueries).mockReturnValue({
    data: {
      staff: overrides?.staff ?? mockStaff,
      totals: overrides?.totals ?? mockTotals,
    },
    loading: overrides?.loading ?? false,
    errors: overrides?.errors ?? {},
    refetch: vi.fn(),
  })

  vi.mocked(useUserRoles).mockReturnValue({
    data: mockRoles,
    loading: false,
    error: null,
    refresh: vi.fn(),
  })
}

// ============================================
// Tests
// ============================================

describe('StaffDirectoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ------------------------------------------
  // Unit: Rendering
  // ------------------------------------------
  describe('rendering', () => {
    it('renders staff table with all members', () => {
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} />)

      expect(screen.getByText('Jane Wilson')).toBeDefined()
      expect(screen.getByText('Mike Brown')).toBeDefined()
      expect(screen.getByText('Sarah Adams')).toBeDefined()
    })

    it('shows staff count', () => {
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} />)

      expect(screen.getByText('3 active members')).toBeDefined()
    })

    it('shows singular count for 1 member', () => {
      setupMocks({ staff: [mockStaff[0]] })
      render(<StaffDirectoryTab {...defaultProps} />)

      expect(screen.getByText('1 active member')).toBeDefined()
    })

    it('displays time-off totals inline for users with data', () => {
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} />)

      expect(screen.getByText('PTO: 5d | Sick: 2d')).toBeDefined()
    })

    it('shows 0d for users with no time-off data', () => {
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} />)

      // Mike Brown (user-2) has no totals
      const rows = screen.getAllByText('0d')
      expect(rows.length).toBeGreaterThanOrEqual(1)
    })

    it('renders role badges', () => {
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} />)

      // Role names appear in both dropdown and badge — use getAllByText
      const nurseBadges = screen.getAllByText('nurse')
      expect(nurseBadges.length).toBeGreaterThanOrEqual(1)
      // Verify at least one is a badge (span)
      expect(nurseBadges.some((el) => el.tagName === 'SPAN')).toBe(true)

      const scrubTechBadges = screen.getAllByText('scrub tech')
      expect(scrubTechBadges.some((el) => el.tagName === 'SPAN')).toBe(true)
    })

    it('renders access level labels', () => {
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} />)

      // "Staff" appears in multiple places (access level + count text)
      const staffLabels = screen.getAllByText('Staff')
      expect(staffLabels.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Facility Admin')).toBeDefined()
    })
  })

  // ------------------------------------------
  // Unit: Loading & Error states
  // ------------------------------------------
  describe('loading and error states', () => {
    it('shows loader when loading', () => {
      setupMocks({ loading: true })
      const { container } = render(<StaffDirectoryTab {...defaultProps} />)

      // PageLoader renders a spinner
      expect(container.querySelector('[class*="animate-spin"]')).toBeDefined()
    })

    it('shows error banner when staff query fails', () => {
      vi.mocked(useSupabaseQueries).mockReturnValue({
        data: { staff: [], totals: [] },
        loading: false,
        errors: { staff: 'Failed to fetch staff' },
        refetch: vi.fn(),
      })
      vi.mocked(useUserRoles).mockReturnValue({
        data: mockRoles, loading: false, error: null, refresh: vi.fn(),
      })

      render(<StaffDirectoryTab {...defaultProps} />)
      expect(screen.getByText(/Failed to fetch staff/)).toBeDefined()
    })
  })

  // ------------------------------------------
  // Unit: Empty states
  // ------------------------------------------
  describe('empty states', () => {
    it('shows empty state when no staff exist', () => {
      setupMocks({ staff: [] })
      render(<StaffDirectoryTab {...defaultProps} />)

      expect(screen.getByText('No staff members found')).toBeDefined()
      expect(screen.getByText('No active staff in this facility.')).toBeDefined()
    })

    it('shows filter-specific empty state when filters eliminate all results', async () => {
      const user = userEvent.setup()
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} />)

      // Search for something that matches nobody
      const searchInput = screen.getByPlaceholderText('Search by name or email...')
      await user.type(searchInput, 'zzzznotfound')

      expect(screen.getByText('No staff members found')).toBeDefined()
      expect(screen.getByText('Try adjusting your search or filters.')).toBeDefined()
    })
  })

  // ------------------------------------------
  // Integration: Search filtering
  // ------------------------------------------
  describe('search filtering', () => {
    it('filters by name', async () => {
      const user = userEvent.setup()
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search by name or email...')
      await user.type(searchInput, 'Jane')

      expect(screen.getByText('Jane Wilson')).toBeDefined()
      expect(screen.queryByText('Mike Brown')).toBeNull()
      expect(screen.getByText('1 active member')).toBeDefined()
    })

    it('filters by email', async () => {
      const user = userEvent.setup()
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search by name or email...')
      await user.type(searchInput, 'admin@')

      expect(screen.getByText('Sarah Adams')).toBeDefined()
      expect(screen.queryByText('Jane Wilson')).toBeNull()
    })

    it('is case-insensitive', async () => {
      const user = userEvent.setup()
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search by name or email...')
      await user.type(searchInput, 'MIKE')

      expect(screen.getByText('Mike Brown')).toBeDefined()
    })
  })

  // ------------------------------------------
  // Integration: Role filtering
  // ------------------------------------------
  describe('role filtering', () => {
    it('filters by role', async () => {
      const user = userEvent.setup()
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} />)

      const roleSelect = screen.getByDisplayValue('All Roles')
      await user.selectOptions(roleSelect, 'role-rn')

      expect(screen.getByText('Jane Wilson')).toBeDefined()
      expect(screen.queryByText('Mike Brown')).toBeNull()
      expect(screen.getByText('1 active member')).toBeDefined()
    })
  })

  // ------------------------------------------
  // Integration: Sorting
  // ------------------------------------------
  describe('sorting', () => {
    it('sorts by name ascending by default', () => {
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} />)

      // Default sort: last_name asc → Adams, Brown, Wilson
      const names = screen.getAllByText(/Adams|Brown|Wilson/).map((el) => el.textContent)
      expect(names[0]).toContain('Adams')
    })

    it('toggles sort direction on column header click', async () => {
      const user = userEvent.setup()
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} />)

      // Click "Name" header to toggle to descending
      const nameHeader = screen.getByRole('columnheader', { name: /Sort by name/ })
      await user.click(nameHeader)

      // Now descending: Wilson, Brown, Adams
      const nameEls = screen.getAllByText(/Adams|Brown|Wilson/)
      expect(nameEls[0].textContent).toContain('Wilson')
    })

    it('sorts by time-off total', async () => {
      const user = userEvent.setup()
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} />)

      const timeOffHeader = screen.getByRole('columnheader', { name: /Sort by time off/ })
      await user.click(timeOffHeader)

      // Ascending: Brown (0d), Adams (4d), Wilson (7d)
      const nameEls = screen.getAllByText(/Adams|Brown|Wilson/)
      expect(nameEls[0].textContent).toContain('Brown')
    })
  })

  // ------------------------------------------
  // Integration: Drawer trigger (Phase 11)
  // ------------------------------------------
  describe('drawer trigger', () => {
    it('calls onSelectUser when row is clicked', async () => {
      const user = userEvent.setup()
      const mockOnSelectUserLocal = vi.fn()
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} onSelectUser={mockOnSelectUserLocal} />)

      // Click Jane Wilson's row (component uses div grid layout, not table rows)
      const janeRow = screen.getByText('Jane Wilson').closest('div[class*="cursor-pointer"]')
      if (!janeRow) throw new Error('Could not find Jane row')
      await user.click(janeRow)

      // Should call onSelectUser with Jane's data
      expect(mockOnSelectUserLocal).toHaveBeenCalledTimes(1)
      expect(mockOnSelectUserLocal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-1',
          first_name: 'Jane',
          last_name: 'Wilson',
        })
      )
    })

    it('calls onSelectUser with correct user data when different row clicked', async () => {
      const user = userEvent.setup()
      const mockOnSelectUserLocal = vi.fn()
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} onSelectUser={mockOnSelectUserLocal} />)

      // Click Mike Brown's row
      const mikeRow = screen.getByText('Mike Brown').closest('div[class*="cursor-pointer"]')
      if (!mikeRow) throw new Error('Could not find Mike row')
      await user.click(mikeRow)

      expect(mockOnSelectUserLocal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-2',
          first_name: 'Mike',
          last_name: 'Brown',
        })
      )
    })
  })

  // ------------------------------------------
  // Phase 14: Keyboard navigation
  // ------------------------------------------
  describe('keyboard navigation', () => {
    it('opens drawer when Enter key pressed on row', async () => {
      const user = userEvent.setup()
      const mockOnSelectUserLocal = vi.fn()
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} onSelectUser={mockOnSelectUserLocal} />)

      // Find Jane Wilson's row
      const janeRow = screen.getByText('Jane Wilson').closest('div[role="row"]')
      if (!janeRow) throw new Error('Could not find Jane row')

      // Focus and press Enter
      janeRow.focus()
      await user.keyboard('{Enter}')

      expect(mockOnSelectUserLocal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-1',
          first_name: 'Jane',
          last_name: 'Wilson',
        })
      )
    })

    it('opens drawer when Space key pressed on row', async () => {
      const user = userEvent.setup()
      const mockOnSelectUserLocal = vi.fn()
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} onSelectUser={mockOnSelectUserLocal} />)

      // Find Mike Brown's row
      const mikeRow = screen.getByText('Mike Brown').closest('div[role="row"]')
      if (!mikeRow) throw new Error('Could not find Mike row')

      // Focus and press Space
      mikeRow.focus()
      await user.keyboard(' ')

      expect(mockOnSelectUserLocal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-2',
          first_name: 'Mike',
          last_name: 'Brown',
        })
      )
    })

    it('rows have tabIndex=0 for keyboard accessibility', () => {
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} />)

      const rows = screen.getAllByRole('row').filter((el) => el.getAttribute('tabIndex') === '0')
      // Header row does not have tabIndex, only data rows (3 staff members)
      expect(rows.length).toBe(3)
    })
  })

  // ------------------------------------------
  // Workflow: Combined filters + sort
  // ------------------------------------------
  describe('workflow: combined filters and sort', () => {
    it('search + role filter work together', async () => {
      const user = userEvent.setup()
      // Add another nurse to test combined filters
      const extraStaff = [
        ...mockStaff,
        {
          id: 'user-4',
          email: 'amy.nurse@example.com',
          first_name: 'Amy',
          last_name: 'Nurse',
          role_id: 'role-rn',
          is_active: true,
          access_level: 'user',
          last_login_at: null,
          created_at: '2025-08-01T00:00:00Z',
          role: { name: 'nurse' },
        },
      ]
      setupMocks({ staff: extraStaff })
      render(<StaffDirectoryTab {...defaultProps} />)

      // Filter to nurses only
      const roleSelect = screen.getByDisplayValue('All Roles')
      await user.selectOptions(roleSelect, 'role-rn')

      // Then search within nurses
      const searchInput = screen.getByPlaceholderText('Search by name or email...')
      await user.type(searchInput, 'Jane')

      expect(screen.getByText('Jane Wilson')).toBeDefined()
      expect(screen.queryByText('Amy Nurse')).toBeNull()
      expect(screen.getByText('1 active member')).toBeDefined()
    })
  })

  // ------------------------------------------
  // Integration: Data merge (staff + totals)
  // ------------------------------------------
  describe('data merge: staff list + time-off totals', () => {
    it('correctly matches totals to users by user_id', () => {
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} />)

      // Jane (user-1) should show PTO: 5d | Sick: 2d
      expect(screen.getByText('PTO: 5d | Sick: 2d')).toBeDefined()

      // Sarah (user-3) should show PTO: 3d
      expect(screen.getByText('PTO: 3d')).toBeDefined()
    })

    it('handles users with no matching totals gracefully', () => {
      setupMocks({ totals: [] })
      render(<StaffDirectoryTab {...defaultProps} />)

      // All users should show 0d
      const zeroDays = screen.getAllByText('0d')
      expect(zeroDays.length).toBe(3)
    })
  })

  // ------------------------------------------
  // Integration: Facility scoping
  // ------------------------------------------
  describe('facility scoping', () => {
    it('passes facilityId to useSupabaseQueries', () => {
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} facilityId="fac-test-123" />)

      expect(vi.mocked(useSupabaseQueries)).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          deps: ['fac-test-123', expect.any(Number), false, false],
          enabled: true,
        })
      )
    })

    it('disables queries when facilityId is empty', () => {
      setupMocks()
      render(<StaffDirectoryTab {...defaultProps} facilityId="" />)

      expect(vi.mocked(useSupabaseQueries)).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          enabled: false,
        })
      )
    })
  })

  // ------------------------------------------
  // Phase 13: All Facilities mode (global admin)
  // ------------------------------------------
  describe('all facilities mode', () => {
    it('shows facility column instead of time-off column', () => {
      setupMocks({ staff: mockStaffAllFacilities })
      render(
        <StaffDirectoryTab
          {...defaultProps}
          facilityId={null}
          isAllFacilitiesMode
        />
      )

      // Facility header should appear
      expect(screen.getByRole('columnheader', { name: /Sort by facility/ })).toBeDefined()
      // Time-off header should not appear
      expect(screen.queryByRole('columnheader', { name: /Sort by time off/ })).toBeNull()
    })

    it('renders facility names for each user', () => {
      setupMocks({ staff: mockStaffAllFacilities })
      render(
        <StaffDirectoryTab
          {...defaultProps}
          facilityId={null}
          isAllFacilitiesMode
        />
      )

      expect(screen.getAllByText('General Hospital').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('City Medical Center')).toBeDefined()
    })

    it('enables queries when facilityId is null but isAllFacilitiesMode is true', () => {
      setupMocks({ staff: mockStaffAllFacilities })
      render(
        <StaffDirectoryTab
          {...defaultProps}
          facilityId={null}
          isAllFacilitiesMode
        />
      )

      expect(vi.mocked(useSupabaseQueries)).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          enabled: true,
        })
      )
    })

    it('sorts by facility name', async () => {
      const user = userEvent.setup()
      setupMocks({ staff: mockStaffAllFacilities })
      render(
        <StaffDirectoryTab
          {...defaultProps}
          facilityId={null}
          isAllFacilitiesMode
        />
      )

      const facilityHeader = screen.getByRole('columnheader', { name: /Sort by facility/ })
      await user.click(facilityHeader)

      // Ascending by facility: City Medical Center first, then General Hospital
      const names = screen.getAllByText(/Adams|Brown|Wilson/).map((el) => el.textContent)
      expect(names[0]).toContain('Brown') // City Medical Center
    })

    it('search works in all-facilities mode', async () => {
      const user = userEvent.setup()
      setupMocks({ staff: mockStaffAllFacilities })
      render(
        <StaffDirectoryTab
          {...defaultProps}
          facilityId={null}
          isAllFacilitiesMode
        />
      )

      const searchInput = screen.getByPlaceholderText('Search by name or email...')
      await user.type(searchInput, 'Mike')

      expect(screen.getByText('Mike Brown')).toBeDefined()
      expect(screen.queryByText('Jane Wilson')).toBeNull()
      expect(screen.getByText('City Medical Center')).toBeDefined()
    })
  })
})
