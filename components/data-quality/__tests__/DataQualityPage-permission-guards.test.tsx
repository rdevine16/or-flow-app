import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import DataQualityPage from '../DataQualityPage'

// ============================================
// MOCKS
// ============================================

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

let mockCan = vi.fn()
let mockUserLoading = false
let mockEffectiveFacilityId: string | null = 'facility-1'

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    can: mockCan,
    loading: mockUserLoading,
    effectiveFacilityId: mockEffectiveFacilityId,
  }),
}))

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
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

vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('@/lib/audit-logger', () => ({
  dataQualityAudit: { log: vi.fn() },
}))

vi.mock('@/lib/logger', () => ({
  logger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@/lib/dataQuality', () => ({
  fetchMetricIssues: vi.fn().mockResolvedValue([]),
  fetchIssueTypes: vi.fn().mockResolvedValue([]),
  fetchResolutionTypes: vi.fn().mockResolvedValue([]),
  calculateDataQualitySummary: vi.fn().mockReturnValue({ totalIssues: 0, resolvedIssues: 0, pendingIssues: 0, score: 100 }),
  resolveIssue: vi.fn(),
  resolveMultipleIssues: vi.fn(),
  runDetectionForFacility: vi.fn(),
  expireOldIssues: vi.fn(),
  METRIC_REQUIREMENTS: {},
}))

vi.mock('../SummaryRow', () => ({
  default: () => <div data-testid="summary-row">Summary</div>,
}))

vi.mock('../ScanProgress', () => ({
  default: () => null,
}))

vi.mock('../FilterBar', () => ({
  default: () => <div data-testid="filter-bar">Filters</div>,
}))

vi.mock('../IssuesTable', () => ({
  default: () => <div data-testid="issues-table">Issues</div>,
}))

vi.mock('../ReviewDrawer', () => ({
  default: () => null,
}))

vi.mock('../MilestoneTimeline', () => ({
  default: () => null,
}))

// ============================================
// TESTS
// ============================================

describe('Data Quality Page — Permission Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserLoading = false
    mockEffectiveFacilityId = 'facility-1'
    mockCan = vi.fn().mockReturnValue(true)
  })

  describe('Unit: Permission key checks', () => {
    it('checks can(data_quality.manage) when user is loaded', async () => {
      mockCan = vi.fn((key: string) => key === 'data_quality.manage')
      render(<DataQualityPage />)

      await waitFor(() => {
        expect(mockCan).toHaveBeenCalledWith('data_quality.manage')
      })
    })

    it('renders AccessDenied when can(data_quality.manage) returns false', async () => {
      mockCan = vi.fn().mockReturnValue(false)
      render(<DataQualityPage />)

      await waitFor(() => {
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
      })
    })

    it('does NOT render AccessDenied while user is loading', () => {
      mockUserLoading = true
      mockCan = vi.fn().mockReturnValue(false)
      render(<DataQualityPage />)

      expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument()
    })
  })

  describe('Integration: Permission denied flow', () => {
    it('shows AccessDenied with dashboard layout when permission denied', async () => {
      mockCan = vi.fn().mockReturnValue(false)
      render(<DataQualityPage />)

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument()
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
      })
    })
  })

  describe('Workflow: User journey with denied permissions', () => {
    it('user navigates to Data Quality → denied → sees AccessDenied → no data', async () => {
      mockCan = vi.fn().mockReturnValue(false)
      render(<DataQualityPage />)

      await waitFor(() => {
        expect(screen.getByTestId('access-denied')).toBeInTheDocument()
      })
      expect(screen.queryByText('Data Quality')).not.toBeInTheDocument()
    })

    it('user with data_quality.manage → sees Data Quality content', async () => {
      mockCan = vi.fn((key: string) => key === 'data_quality.manage')
      render(<DataQualityPage />)

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument()
        expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument()
      })
    })
  })
})
