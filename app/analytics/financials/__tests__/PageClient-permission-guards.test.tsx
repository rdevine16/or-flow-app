import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import FinancialsAnalyticsPage from '../PageClient'

// ============================================
// MOCKS
// ============================================

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

let mockCan = vi.fn()
let mockUserLoading = false
let mockEffectiveFacilityId: string | null = 'facility-1'
let mockIsGlobalAdmin = false
let mockIsTierAtLeast = vi.fn().mockReturnValue(true)

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    can: mockCan,
    loading: mockUserLoading,
    effectiveFacilityId: mockEffectiveFacilityId,
    isGlobalAdmin: mockIsGlobalAdmin,
    isTierAtLeast: mockIsTierAtLeast,
  }),
}))

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ data: [], error: null })),
      })),
    })),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
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

vi.mock('@/components/ui/ErrorBanner', () => ({
  ErrorBanner: () => null,
}))

vi.mock('@/components/analytics/AnalyticsBreadcrumb', () => ({
  AnalyticsPageHeader: () => <div data-testid="analytics-header">Analytics Header</div>,
}))

vi.mock('@/components/FeatureGate', () => ({
  FeatureGate: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/analytics/financials/types', () => ({
  SubTab: {},
}))

vi.mock('@/components/analytics/financials/useFinancialsMetrics', () => ({
  useFinancialsMetrics: () => ({
    procedureStats: [],
    surgeonStats: [],
    revenueTotal: 0,
    costTotal: 0,
    profitTotal: 0,
  }),
}))

vi.mock('@/components/ui/DateRangeSelector', () => ({
  default: () => <div data-testid="date-range-selector">Date Range</div>,
}))

vi.mock('@/lib/date-utils', () => ({
  getLocalDateString: () => '2026-03-16',
}))

vi.mock('@/components/analytics/financials/OverviewTab', () => ({
  default: () => <div data-testid="overview-tab">Overview</div>,
}))

vi.mock('@/components/analytics/financials/ProcedureTab', () => ({
  default: () => <div data-testid="procedure-tab">Procedures</div>,
}))

vi.mock('@/components/analytics/financials/SurgeonTab', () => ({
  default: () => <div data-testid="surgeon-tab">Surgeons</div>,
}))

// ============================================
// TESTS
// ============================================

describe('Financials Analytics Page — Permission Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserLoading = false
    mockEffectiveFacilityId = 'facility-1'
    mockIsGlobalAdmin = false
    mockCan = vi.fn().mockReturnValue(true)
    mockIsTierAtLeast = vi.fn().mockReturnValue(true)
  })

  describe('Unit: Three-way permission check', () => {
    it('checks both analytics.view and financials.view', async () => {
      mockCan = vi.fn().mockReturnValue(true)
      render(<FinancialsAnalyticsPage />)

      await waitFor(() => {
        expect(mockCan).toHaveBeenCalledWith('analytics.view')
        expect(mockCan).toHaveBeenCalledWith('financials.view')
      })
    })

    it('renders AccessDenied when analytics.view is false', async () => {
      mockCan = vi.fn((key: string) => {
        if (key === 'analytics.view') return false
        return true
      })
      render(<FinancialsAnalyticsPage />)

      await waitFor(() => {
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
      })
    })

    it('renders AccessDenied when financials.view is false', async () => {
      mockCan = vi.fn((key: string) => {
        if (key === 'financials.view') return false
        return true
      })
      render(<FinancialsAnalyticsPage />)

      await waitFor(() => {
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
      })
    })

    it('renders AccessDenied when tier is below enterprise', async () => {
      mockCan = vi.fn().mockReturnValue(true)
      mockIsTierAtLeast = vi.fn().mockReturnValue(false)
      render(<FinancialsAnalyticsPage />)

      await waitFor(() => {
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
      })
    })

    it('does NOT render AccessDenied while user is loading', () => {
      mockUserLoading = true
      mockCan = vi.fn().mockReturnValue(false)
      render(<FinancialsAnalyticsPage />)

      expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument()
    })
  })

  describe('Integration: Permission denied flow', () => {
    it('shows AccessDenied with dashboard layout when any permission is denied', async () => {
      mockCan = vi.fn().mockReturnValue(false)
      render(<FinancialsAnalyticsPage />)

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument()
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
      })
    })
  })

  describe('Workflow: Three-way gate scenarios', () => {
    it('all three checks pass → sees financials content', async () => {
      mockCan = vi.fn().mockReturnValue(true)
      mockIsTierAtLeast = vi.fn().mockReturnValue(true)
      render(<FinancialsAnalyticsPage />)

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument()
        expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument()
      })
    })

    it('has financials.view but not analytics.view → AccessDenied', async () => {
      mockCan = vi.fn((key: string) => key === 'financials.view')
      mockIsTierAtLeast = vi.fn().mockReturnValue(true)
      render(<FinancialsAnalyticsPage />)

      await waitFor(() => {
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
      })
    })
  })
})
