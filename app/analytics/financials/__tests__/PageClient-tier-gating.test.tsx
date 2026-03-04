// app/analytics/financials/__tests__/PageClient-tier-gating.test.tsx
// Phase 10: Test that Financials page requires enterprise tier

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import FinancialsAnalyticsPage from '../PageClient'

// ============================================
// Mocks
// ============================================

let mockCan: (perm: string) => boolean = () => true
let mockIsTierAtLeast: (tier: string) => boolean = () => true
let mockUserLoading = false

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    loading: mockUserLoading,
    isGlobalAdmin: false,
    effectiveFacilityId: 'facility-1',
    can: mockCan,
    isTierAtLeast: mockIsTierAtLeast,
  }),
}))

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => ({ data: [], error: null }),
              }),
            }),
          }),
          single: () => ({ data: null, error: null }),
          order: () => ({ data: [], error: null }),
        }),
      }),
    }),
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/components/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}))

vi.mock('@/components/ui/AccessDenied', () => ({
  default: () => <div data-testid="access-denied">Access Denied</div>,
}))

vi.mock('@/components/ui/Loading', () => ({
  PageLoader: () => <div data-testid="page-loader">Loading...</div>,
}))

vi.mock('@/components/analytics/AnalyticsBreadcrumb', () => ({
  AnalyticsPageHeader: ({ title }: { title: string }) => <div>{title}</div>,
}))

vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('@/components/ui/ErrorBanner', () => ({
  ErrorBanner: () => null,
}))

vi.mock('@/components/ui/DateRangeSelector', () => ({
  default: () => null,
}))

vi.mock('@/lib/date-utils', () => ({
  getLocalDateString: () => '2026-03-04',
}))

vi.mock('@/components/analytics/financials/types', () => ({}))

vi.mock('@/components/analytics/financials/useFinancialsMetrics', () => ({
  useFinancialsMetrics: () => ({}),
}))

vi.mock('@/components/analytics/financials/OverviewTab', () => ({
  default: () => <div>Overview</div>,
}))

vi.mock('@/components/analytics/financials/ProcedureTab', () => ({
  default: () => <div>Procedures</div>,
}))

vi.mock('@/components/analytics/financials/SurgeonTab', () => ({
  default: () => <div>Surgeons</div>,
}))

// ============================================
// Tests
// ============================================

describe('FinancialsAnalyticsPage — Tier Gating', () => {
  beforeEach(() => {
    mockCan = () => true
    mockIsTierAtLeast = () => true
    mockUserLoading = false
  })

  // ---- Unit: Permission + Tier Guard ----

  it('shows AccessDenied when user lacks financials.view permission', () => {
    mockCan = () => false
    mockIsTierAtLeast = () => true

    render(<FinancialsAnalyticsPage />)
    expect(screen.getByTestId('access-denied')).toBeDefined()
  })

  it('shows AccessDenied when user has permission but not enterprise tier', () => {
    mockCan = () => true
    mockIsTierAtLeast = (tier) => tier !== 'enterprise'

    render(<FinancialsAnalyticsPage />)
    expect(screen.getByTestId('access-denied')).toBeDefined()
  })

  it('shows AccessDenied for Essential tier even with permission', () => {
    mockCan = () => true
    mockIsTierAtLeast = (tier) => tier === 'essential'

    render(<FinancialsAnalyticsPage />)
    expect(screen.getByTestId('access-denied')).toBeDefined()
  })

  it('shows AccessDenied for Professional tier even with permission', () => {
    mockCan = () => true
    mockIsTierAtLeast = (tier) => tier === 'professional' || tier === 'essential'

    render(<FinancialsAnalyticsPage />)
    expect(screen.getByTestId('access-denied')).toBeDefined()
  })

  it('does NOT show AccessDenied for Enterprise tier with permission', () => {
    mockCan = () => true
    mockIsTierAtLeast = () => true // Enterprise passes all tier checks

    render(<FinancialsAnalyticsPage />)
    expect(screen.queryByTestId('access-denied')).toBeNull()
  })

  // ---- Integration: Combined guard ----

  it('denies access when BOTH permission and tier fail', () => {
    mockCan = () => false
    mockIsTierAtLeast = (tier) => tier === 'essential'

    render(<FinancialsAnalyticsPage />)
    expect(screen.getByTestId('access-denied')).toBeDefined()
  })

  // ---- Workflow: Enterprise user sees page content ----

  it('Enterprise user sees page layout (not access denied or loader)', () => {
    mockCan = () => true
    mockIsTierAtLeast = () => true

    render(<FinancialsAnalyticsPage />)
    expect(screen.queryByTestId('access-denied')).toBeNull()
    expect(screen.getByTestId('dashboard-layout')).toBeDefined()
  })
})
