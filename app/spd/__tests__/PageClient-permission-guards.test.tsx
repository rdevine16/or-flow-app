import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import SPDDashboardPage from '../PageClient'

// ============================================
// MOCKS
// ============================================

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
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
  }),
}))

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              neq: vi.fn(() => ({
                order: vi.fn(() => ({
                  order: vi.fn(() => ({ data: [], error: null })),
                })),
              })),
            })),
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

vi.mock('@/components/ui/Loading', () => ({
  PageLoader: () => <div data-testid="page-loader">Loading...</div>,
}))

vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('@/components/ui/SurgeonAvatar', () => ({
  default: () => <div data-testid="surgeon-avatar" />,
}))

vi.mock('@/lib/date-utils', () => ({
  getLocalDateString: () => '2026-03-16',
}))

vi.mock('@/components/ui/EmptyState', () => ({
  EmptyState: () => <div data-testid="empty-state">No cases</div>,
}))

vi.mock('@/components/ui/ErrorBanner', () => ({
  ErrorBanner: () => null,
}))

// ============================================
// TESTS
// ============================================

describe('SPD Page — Permission Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserLoading = false
    mockEffectiveFacilityId = 'facility-1'
    mockIsGlobalAdmin = false
    mockCan = vi.fn().mockReturnValue(true)
  })

  describe('Unit: Permission key checks', () => {
    it('checks can(spd.view) when user is loaded', async () => {
      mockCan = vi.fn((key: string) => key === 'spd.view')
      render(<SPDDashboardPage />)

      await waitFor(() => {
        expect(mockCan).toHaveBeenCalledWith('spd.view')
      })
    })

    it('renders AccessDenied when can(spd.view) returns false', async () => {
      mockCan = vi.fn().mockReturnValue(false)
      render(<SPDDashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
      })
    })

    it('does NOT render AccessDenied while user is loading', () => {
      mockUserLoading = true
      mockCan = vi.fn().mockReturnValue(false)
      render(<SPDDashboardPage />)

      expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument()
    })
  })

  describe('Integration: Permission denied flow', () => {
    it('shows AccessDenied with dashboard layout when permission denied', async () => {
      mockCan = vi.fn().mockReturnValue(false)
      render(<SPDDashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument()
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
      })
    })
  })

  describe('Workflow: User journey with denied permissions', () => {
    it('user navigates to SPD → denied spd.view → sees AccessDenied → no data', async () => {
      mockCan = vi.fn().mockReturnValue(false)
      render(<SPDDashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
      })
      expect(screen.queryByText('SPD Dashboard')).not.toBeInTheDocument()
    })

    it('user with spd.view → sees SPD dashboard content', async () => {
      mockCan = vi.fn((key: string) => key === 'spd.view')
      render(<SPDDashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument()
        expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument()
      })
    })
  })
})
