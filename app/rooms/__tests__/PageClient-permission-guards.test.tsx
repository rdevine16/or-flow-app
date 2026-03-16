import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import RoomsPage from '../PageClient'

// ============================================
// MOCKS
// ============================================

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

let mockCan = vi.fn()
let mockUserLoading = false
let mockEffectiveFacilityId = 'facility-1'

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    can: mockCan,
    loading: mockUserLoading,
    effectiveFacilityId: mockEffectiveFacilityId,
    userData: { userId: 'user-1', firstName: 'Test', lastName: 'User' },
  }),
}))

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [],
            error: null,
          })),
        })),
      })),
    })),
  }),
}))

vi.mock('@/components/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
}))

vi.mock('@/components/ui/AccessDenied', () => ({
  default: () => <div data-testid="access-denied">Access Denied</div>,
}))

vi.mock('@/components/dashboard/CaseListView', () => ({
  default: () => <div data-testid="case-list-view">Case List View</div>,
}))

vi.mock('@/components/dashboard/EnhancedRoomGridView', () => ({
  default: () => <div data-testid="room-grid-view">Room Grid View</div>,
}))

vi.mock('@/hooks/useStaffAssignment', () => ({
  useStaffAssignment: () => ({
    staffMembers: [],
    dragData: null,
    handleDragStart: vi.fn(),
    handleDragEnd: vi.fn(),
  }),
}))

// ============================================
// TESTS
// ============================================

describe('Rooms Page — Permission Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserLoading = false
    mockEffectiveFacilityId = 'facility-1'
    mockCan = vi.fn().mockReturnValue(true)
  })

  describe('Unit: Permission key checks', () => {
    it('checks can(rooms.view) when user is loaded', async () => {
      mockCan = vi.fn((key: string) => key === 'rooms.view')
      render(<RoomsPage />)

      await waitFor(() => {
        expect(mockCan).toHaveBeenCalledWith('rooms.view')
      })
    })

    it('renders AccessDenied when can(rooms.view) returns false', async () => {
      mockCan = vi.fn().mockReturnValue(false)
      render(<RoomsPage />)

      await waitFor(() => {
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
      })
    })

    it('does NOT render AccessDenied while user is loading', () => {
      mockUserLoading = true
      mockCan = vi.fn().mockReturnValue(false)
      render(<RoomsPage />)

      expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument()
    })

    it('renders rooms grid when can(rooms.view) returns true', async () => {
      mockCan = vi.fn((key: string) => key === 'rooms.view')
      render(<RoomsPage />)

      await waitFor(() => {
        expect(screen.getByTestId('room-grid-view')).toBeInTheDocument()
      })
    })
  })

  describe('Integration: Permission denied flow', () => {
    it('shows AccessDenied with dashboard layout when permission denied', async () => {
      mockCan = vi.fn().mockReturnValue(false)
      render(<RoomsPage />)

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument()
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
        expect(screen.queryByTestId('room-grid-view')).not.toBeInTheDocument()
      })
    })

    it('does NOT render room grid or data when permission denied', async () => {
      mockCan = vi.fn().mockReturnValue(false)
      render(<RoomsPage />)

      await waitFor(() => {
        expect(screen.queryByTestId('room-grid-view')).not.toBeInTheDocument()
        expect(screen.queryByTestId('case-list-view')).not.toBeInTheDocument()
      })
    })
  })

  describe('Workflow: User journey with denied permissions', () => {
    it('user clicks "Rooms" nav item → denied rooms.view → sees AccessDenied → no data load', async () => {
      mockCan = vi.fn((key: string) => {
        if (key === 'rooms.view') return false
        return false
      })

      render(<RoomsPage />)

      await waitFor(() => {
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
      })

      // Verify downstream components are NOT rendered
      expect(screen.queryByTestId('room-grid-view')).not.toBeInTheDocument()
      expect(screen.queryByTestId('case-list-view')).not.toBeInTheDocument()
    })

    it('user has rooms.view → sees rooms grid → correct components rendered', async () => {
      mockCan = vi.fn((key: string) => key === 'rooms.view')

      render(<RoomsPage />)

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument()
        expect(screen.getByTestId('room-grid-view')).toBeInTheDocument()
        expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument()
      })
    })
  })
})
