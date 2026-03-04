// app/analytics/kpi/__tests__/PageClient-tier-gating.test.tsx
// Phase 10: Test tier-based gating on KPI analytics page
// Validates: Layer 3 (operational analysis) and Layer 4 (AI Insights) blur for Essential

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import KPIAnalyticsPage from '../PageClient'

// ============================================
// Mocks
// ============================================

let mockIsTierAtLeast: (tier: string) => boolean = () => true
let mockCan: (perm: string) => boolean = () => true

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    userData: {
      firstName: 'Test',
      lastName: 'User',
      facilityId: 'facility-1',
      accessLevel: 'facility_admin',
    },
    loading: false,
    isGlobalAdmin: false,
    can: mockCan,
    isTierAtLeast: mockIsTierAtLeast,
  }),
}))

vi.mock('@/lib/impersonation', () => ({
  getImpersonationState: () => null,
}))

// Mock analytics calculation — must include ALL AnalyticsOverview properties
vi.mock('@/lib/analyticsV2', () => {
  const kpi = (v: number, d: string) => ({
    value: v, displayValue: d, delta: 0, deltaType: 'unchanged',
    target: v, targetMet: true, subtitle: '', dailyData: [],
  })
  return {
    calculateAnalyticsOverview: () => ({
      // Volume
      totalCases: 10,
      completedCases: 10,
      cancelledCases: 0,
      // KPIs
      fcots: { ...kpi(92, '92%'), firstCaseDetails: [] },
      orUtilization: { ...kpi(80, '80%'), scheduledValue: 80, actualValue: 80, roomBreakdown: [] },
      sameRoomTurnover: { ...kpi(22, '22m'), details: [], compliantCount: 0, nonCompliantCount: 0, complianceRate: 100 },
      flipRoomTurnover: { ...kpi(15, '15m'), details: [], compliantCount: 0, nonCompliantCount: 0, complianceRate: 100 },
      caseVolume: { ...kpi(10, '10'), weeklyVolume: [] },
      cancellationRate: { ...kpi(0, '0%'), sameDayCount: 0 },
      cumulativeTardiness: kpi(0, '0m'),
      nonOperativeTime: kpi(20, '20m'),
      surgeonIdleTime: kpi(8, '8m'),
      surgeonIdleFlip: kpi(5, '5m'),
      surgeonIdleSameRoom: kpi(12, '12m'),
      // Flip room details
      sameRoomSurgicalTurnover: kpi(18, '18m'),
      flipRoomSurgicalTurnover: kpi(12, '12m'),
      flipRoomAnalysis: [],
      surgeonIdleSummaries: [],
      // Time breakdown
      avgTotalCaseTime: 0,
      avgSurgicalTime: 0,
      avgPreOpTime: 0,
      avgAnesthesiaTime: 0,
      avgClosingTime: 0,
      avgEmergenceTime: 0,
    }),
    getKPIStatus: () => 'good',
  }
})

vi.mock('@/lib/hooks/useAnalyticsConfig', () => ({
  useAnalyticsConfig: () => ({
    config: {
      orHourlyRate: 2500,
      fcotsTargetPercent: 90,
      utilizationTargetPercent: 80,
      cancellationTargetPercent: 5,
      turnoverThresholdMinutes: 30,
      sameRoomTurnoverTarget: 45,
      flipRoomTurnoverTarget: 15,
      nonOpWarnMinutes: 30,
      nonOpBadMinutes: 60,
      operatingDays: [1, 2, 3, 4, 5],
    },
    loading: false,
  }),
}))

vi.mock('@/lib/insightsEngine', () => ({
  generateInsights: () => [],
}))

vi.mock('@/lib/insightExports', () => ({
  exportInsightPanel: vi.fn(),
}))

vi.mock('@/lib/date-utils', () => ({
  getLocalDateString: () => '2026-03-04',
}))

// Proxy-based supabase mock — handles any query chain
vi.mock('@/lib/supabase', () => {
  function createProxy(): unknown {
    const handler: ProxyHandler<() => unknown> = {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (v: { data: unknown[]; error: null }) => void) =>
            resolve({ data: [], error: null })
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          return () => Promise.resolve({ data: { timezone: 'America/New_York' }, error: null })
        }
        return (..._args: unknown[]) => createProxy()
      },
      apply() {
        return createProxy()
      },
    }
    return new Proxy(function () {}, handler)
  }

  return {
    createClient: () => ({
      from: () => createProxy(),
      rpc: () => ({ data: [], error: null }),
    }),
  }
})

vi.mock('@/components/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}))

vi.mock('@/components/ui/AccessDenied', () => ({
  default: () => <div data-testid="access-denied">Access Denied</div>,
}))

vi.mock('@/components/ui/Container', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/DateFilter', () => ({
  default: () => null,
}))

vi.mock('@/components/ui/Sparkline', () => ({
  default: () => null,
  dailyDataToSparkline: () => [],
}))

vi.mock('@/components/ui/DeltaBadge', () => ({
  DeltaBadge: () => null,
}))

vi.mock('@/components/analytics/InsightSlideOver', () => ({
  default: () => null,
}))

vi.mock('lucide-react', () => ({
  ArrowRight: () => null,
  BarChart3: () => null,
  ChevronRight: () => null,
  Download: () => null,
  Check: () => null,
}))

// Mock FeatureGate to test gating behavior
vi.mock('@/components/FeatureGate', () => ({
  FeatureGate: ({ children, requires, mode }: { children: React.ReactNode; requires?: string; mode?: string }) => {
    const hasAccess = requires ? mockIsTierAtLeast(requires) : true

    if (hasAccess) return <>{children}</>

    if (mode === 'blur') {
      return (
        <div data-testid={`blurred-${requires}`} className="blur-[6px]">
          {children}
          <div data-testid="upgrade-prompt">Upgrade to {requires}</div>
        </div>
      )
    }

    return null
  },
}))

vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

// ============================================
// Tests
// ============================================

describe('KPIAnalyticsPage — Phase 10 Tier Gating', () => {
  beforeEach(() => {
    mockIsTierAtLeast = () => true
    mockCan = () => true
  })

  // ---- Unit: Blur states ----

  describe('Essential tier blur gating', () => {
    it('blurs Layer 3 and Layer 4 for Essential tier', async () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'

      render(<KPIAnalyticsPage />)

      // Wait for async data fetching to complete and loading to resolve
      await waitFor(() => {
        const blurred = screen.getAllByTestId('blurred-professional')
        expect(blurred.length).toBe(2) // Layer 3 + Layer 4
      })

      const prompts = screen.getAllByTestId('upgrade-prompt')
      expect(prompts.length).toBe(2)
    })

    it('does NOT blur any sections for Professional tier', async () => {
      mockIsTierAtLeast = (tier) => tier === 'professional' || tier === 'essential'

      render(<KPIAnalyticsPage />)

      // Wait for content to load past the spinner
      await waitFor(() => {
        expect(screen.queryByText('Calculating metrics...')).toBeNull()
      })

      expect(screen.queryByTestId('blurred-professional')).toBeNull()
      expect(screen.queryByTestId('upgrade-prompt')).toBeNull()
    })
  })

  // ---- Integration: Permission guard ----

  describe('Permission guard', () => {
    it('shows AccessDenied when analytics.view permission is denied', () => {
      mockCan = () => false

      render(<KPIAnalyticsPage />)
      expect(screen.getByTestId('access-denied')).toBeDefined()
    })
  })

  // ---- Workflow: Essential sees basic KPIs only ----

  describe('Workflow: Essential user sees basic KPIs with upgrade prompts', () => {
    it('Essential user sees KPI cards + blur overlays on advanced sections', async () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'

      render(<KPIAnalyticsPage />)

      // Dashboard layout renders
      expect(screen.getByTestId('dashboard-layout')).toBeDefined()

      // Wait for loading to complete, then check blurred sections
      await waitFor(() => {
        expect(screen.getAllByTestId('blurred-professional')).toHaveLength(2)
      })
      expect(screen.getAllByTestId('upgrade-prompt')).toHaveLength(2)
    })
  })
})
