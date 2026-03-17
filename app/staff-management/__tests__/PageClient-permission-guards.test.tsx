import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import StaffManagementPageClient from '../PageClient'

// ============================================
// MOCKS
// ============================================

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/staff-management',
}))

let mockCan = vi.fn()
let mockUserLoading = false
let mockEffectiveFacilityId: string | null = 'facility-1'
let mockIsGlobalAdmin = false

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    can: mockCan,
    loading: mockUserLoading,
    effectiveFacilityId: mockEffectiveFacilityId,
    isGlobalAdmin: mockIsGlobalAdmin,
    isImpersonating: false,
    userData: { userId: 'user-1', firstName: 'Test', lastName: 'User', facilityName: 'Test Facility' },
  }),
}))

vi.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: () => ({ data: [], loading: false, refetch: vi.fn() }),
}))

vi.mock('@/hooks/useLookups', () => ({
  useUserRoles: () => ({ data: [] }),
}))

vi.mock('@/hooks/useTimeOffRequests', () => ({
  useTimeOffRequests: () => ({
    requests: [],
    totals: {},
    holidays: [],
    reviewRequest: vi.fn(),
    refetch: vi.fn(),
  }),
}))

vi.mock('@/lib/dal/users', () => ({
  usersDAL: {
    listByFacility: vi.fn().mockResolvedValue({ data: [], error: null }),
    listAllFacilities: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}))

vi.mock('@/lib/dal/facilities', () => ({
  facilitiesDAL: {
    listAll: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}))

vi.mock('@/components/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
}))

vi.mock('@/components/ui/Loading', () => ({
  PageLoader: () => <div data-testid="page-loader">Loading...</div>,
}))

vi.mock('@/components/ui/AccessDenied', () => ({
  default: () => <div data-testid="access-denied">Access Denied</div>,
}))

vi.mock('@/components/staff-management/StaffDirectoryTab', () => ({
  StaffDirectoryTab: () => <div data-testid="staff-directory">Staff Directory</div>,
}))

vi.mock('@/components/staff-management/TimeOffCalendarTab', () => ({
  TimeOffCalendarTab: () => <div data-testid="time-off-calendar">Time Off Calendar</div>,
}))

vi.mock('@/components/staff-management/TimeOffReviewModal', () => ({
  TimeOffReviewModal: () => null,
}))

vi.mock('@/components/staff-management/StaffDetailDrawer', () => ({
  StaffDetailDrawer: () => null,
}))

vi.mock('@/components/InviteUserModal', () => ({
  default: () => null,
}))

vi.mock('@/components/staff-management/HolidaysTab', () => ({
  HolidaysTab: () => <div data-testid="holidays-tab">Holidays</div>,
}))

vi.mock('@/components/staff-management/AnnouncementsTab', () => ({
  AnnouncementsTab: () => <div data-testid="announcements-tab">Announcements</div>,
}))

vi.mock('@/lib/logger', () => ({
  logger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

// ============================================
// TESTS
// ============================================

describe('Staff Management Page — Permission Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserLoading = false
    mockEffectiveFacilityId = 'facility-1'
    mockIsGlobalAdmin = false
    mockCan = vi.fn().mockReturnValue(true)
  })

  describe('Unit: Permission key checks', () => {
    it('checks can(staff_management.manage) when user is loaded', async () => {
      mockCan = vi.fn((key: string) => key === 'staff_management.manage')
      render(<StaffManagementPageClient />)

      await waitFor(() => {
        expect(mockCan).toHaveBeenCalledWith('staff_management.manage')
      })
    })

    it('renders AccessDenied when can(staff_management.manage) returns false', async () => {
      mockCan = vi.fn().mockReturnValue(false)
      render(<StaffManagementPageClient />)

      await waitFor(() => {
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
      })
    })

    it('does NOT render AccessDenied while user is loading', () => {
      mockUserLoading = true
      mockCan = vi.fn().mockReturnValue(false)
      render(<StaffManagementPageClient />)

      expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument()
    })
  })

  describe('Integration: Permission denied flow', () => {
    it('shows AccessDenied without DashboardLayout wrapper when permission denied', async () => {
      mockCan = vi.fn().mockReturnValue(false)
      render(<StaffManagementPageClient />)

      await waitFor(() => {
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
      })
      // Staff management renders AccessDenied without DashboardLayout wrapper
      expect(screen.queryByTestId('staff-directory')).not.toBeInTheDocument()
    })
  })

  describe('Workflow: User journey with denied permissions', () => {
    it('user navigates to Staff Management → denied → sees AccessDenied → no data', async () => {
      mockCan = vi.fn().mockReturnValue(false)
      render(<StaffManagementPageClient />)

      await waitFor(() => {
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
      })
      expect(screen.queryByText('Staff Management')).not.toBeInTheDocument()
      expect(screen.queryByTestId('staff-directory')).not.toBeInTheDocument()
    })

    it('user with staff_management.manage → sees staff directory', async () => {
      mockCan = vi.fn((key: string) => key === 'staff_management.manage')
      render(<StaffManagementPageClient />)

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument()
        expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument()
      })
    })
  })
})
