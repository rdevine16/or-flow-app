// app/dashboard/__tests__/PageClient-tier-gating.test.tsx
// Phase 9: Test tier-based dashboard widget gating

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DashboardPage from '../PageClient'
import type { DashboardAlert } from '@/lib/hooks/useDashboardAlerts'

// ============================================
// Mocks
// ============================================

// Mock UserContext with controllable tier
let mockIsTierAtLeast: (tier: string) => boolean = () => true
let mockTierLoading = false

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    userData: {
      firstName: 'Test',
      lastName: 'User',
      facilityName: 'Test Facility',
    },
    isTierAtLeast: mockIsTierAtLeast,
    tierLoading: mockTierLoading,
  }),
}))

// Mock dashboard hooks with sample data
const mockAlerts: DashboardAlert[] = [
  {
    id: 'behind-1',
    type: 'behind_schedule',
    priority: 'high',
    title: '2 rooms behind schedule',
    description: 'OR 1 and OR 2',
    count: 2,
    linkTo: '/rooms',
  },
  {
    id: 'stale-1',
    type: 'stale_cases',
    priority: 'low',
    title: '3 stale cases',
    description: 'Past date, still scheduled',
    count: 3,
    linkTo: '/cases?filter=stale',
  },
  {
    id: 'validation-1',
    type: 'validation',
    priority: 'medium',
    title: '5 cases need validation',
    description: 'Completed but unvalidated',
    count: 5,
    linkTo: '/cases?filter=needs_validation',
  },
  {
    id: 'missing-1',
    type: 'missing_milestones',
    priority: 'medium',
    title: '4 cases with missing milestones',
    description: 'In-progress with gaps',
    count: 4,
    linkTo: '/cases?filter=missing',
  },
]

// Mutable alerts config to allow runtime overrides
const alertsConfig = {
  data: mockAlerts,
  loading: false,
  error: null,
}

vi.mock('@/lib/hooks/useDashboardAlerts', () => ({
  useDashboardAlerts: () => alertsConfig,
}))

vi.mock('@/lib/hooks/useDashboardKPIs', () => ({
  useDashboardKPIs: () => ({
    data: {
      utilization: {
        scheduledValue: 85.3,
        actualValue: 78.2,
        delta: -5.1,
        deltaType: 'decrease',
        target: 80,
        dailyData: [{ numericValue: 78 }, { numericValue: 80 }, { numericValue: 78.2 }],
      },
      casesCompleted: 12,
      casesScheduled: 14,
      medianTurnover: {
        value: 22,
        delta: 2.1,
        deltaType: 'increase',
        target: 25,
        dailyData: [{ numericValue: 20 }, { numericValue: 23 }, { numericValue: 22 }],
      },
      onTimeStartPct: {
        value: 92.3,
        delta: 3.2,
        deltaType: 'increase',
        target: 90,
        dailyData: [{ numericValue: 89 }, { numericValue: 91 }, { numericValue: 92.3 }],
      },
      facilityScore: 82.5,
    },
    loading: false,
    error: null,
  }),
}))

vi.mock('@/lib/hooks/useTodayStatus', () => ({
  useTodayStatus: () => ({
    data: {
      rooms: [
        { roomId: 'r1', name: 'OR 1', status: 'in-progress', caseNumber: 'C-001' },
        { roomId: 'r2', name: 'OR 2', status: 'turnover', caseNumber: 'C-002' },
      ],
      surgeons: [
        { surgeonId: 's1', name: 'Dr. Smith', casesCompleted: 2, casesTotal: 3 },
      ],
    },
    loading: false,
    error: null,
  }),
}))

vi.mock('@/lib/hooks/useScheduleTimeline', () => ({
  useScheduleTimeline: () => ({
    data: [],
    loading: false,
    error: null,
  }),
}))

vi.mock('@/hooks/useLookups', () => ({
  useProcedureCategories: () => ({
    data: [{ id: 'cat1', name: 'Cardiology' }],
    loading: false,
  }),
}))

// Mock child components to isolate page-level logic
vi.mock('@/components/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
}))

vi.mock('@/components/dashboard/LivePulseBanner', () => ({
  LivePulseBanner: () => <div data-testid="live-pulse-banner">Live Pulse</div>,
}))

vi.mock('@/components/dashboard/DashboardKpiCard', () => ({
  DashboardKpiCard: ({ title }: { title: string }) => <div data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>{title}</div>,
}))

vi.mock('@/components/dashboard/FacilityScoreMini', () => ({
  FacilityScoreMini: ({ score }: { score: number | null }) => (
    <div data-testid="facility-score-mini">Facility Score: {score ?? 'N/A'}</div>
  ),
}))

vi.mock('@/components/dashboard/ScheduleAdherenceTimeline', () => ({
  ScheduleAdherenceTimeline: () => <div data-testid="schedule-timeline">Timeline</div>,
}))

vi.mock('@/components/dashboard/NeedsAttention', () => ({
  NeedsAttention: ({ alerts }: { alerts: DashboardAlert[] }) => (
    <div data-testid="needs-attention">
      <div data-testid="alert-count">{alerts.length} alerts</div>
      {alerts.map((a) => (
        <div key={a.id} data-testid={`alert-${a.type}`}>
          {a.title}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('@/components/dashboard/InsightsSection', () => ({
  InsightsSection: () => <div data-testid="insights-section">Insights</div>,
}))

vi.mock('@/components/dashboard/RoomStatusCard', () => ({
  RoomStatusCard: ({ room }: { room: { name: string } }) => <div>{room.name}</div>,
  RoomStatusCardSkeleton: () => <div>Loading room...</div>,
}))

vi.mock('@/components/dashboard/TodaysSurgeons', () => ({
  TodaysSurgeons: () => <div data-testid="todays-surgeons">Surgeons</div>,
}))

vi.mock('@/components/dashboard/TrendChart', () => ({
  TrendChart: () => <div data-testid="trend-chart">Trend Chart</div>,
}))

vi.mock('@/components/dashboard/QuickAccessCards', () => ({
  QuickAccessCards: () => <div data-testid="quick-access">Quick Access</div>,
}))

vi.mock('@/components/cases/CaseDrawer', () => ({
  default: () => null,
}))

// Mock FeatureGate to test actual gating behavior
vi.mock('@/components/FeatureGate', () => ({
  FeatureGate: ({ children, requires, mode }: { children: React.ReactNode; requires: string; mode: string }) => {
    const isTierAtLeast = mockIsTierAtLeast
    const hasAccess = isTierAtLeast(requires)

    if (hasAccess) return <>{children}</>

    // Simulate blur mode (what Phase 9 uses)
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

// ============================================
// Tests
// ============================================

describe('DashboardPage — Phase 9 Tier Gating', () => {
  beforeEach(() => {
    mockIsTierAtLeast = () => true
    mockTierLoading = false
    // Reset alerts to default
    alertsConfig.data = mockAlerts
    alertsConfig.loading = false
    alertsConfig.error = null
  })

  // ============================================
  // UNIT: Alert Filtering Logic
  // ============================================

  describe('Alert filtering (Essential tier)', () => {
    it('filters out validation and missing_milestones alerts for Essential tier', () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'

      render(<DashboardPage />)

      // Should show operational alerts
      expect(screen.getByTestId('alert-behind_schedule')).toBeDefined()
      expect(screen.getByTestId('alert-stale_cases')).toBeDefined()

      // Should NOT show DQ/flag alerts
      expect(screen.queryByTestId('alert-validation')).toBeNull()
      expect(screen.queryByTestId('alert-missing_milestones')).toBeNull()

      // Alert count should be 2 (not 4)
      expect(screen.getByTestId('alert-count')).toHaveTextContent('2 alerts')
    })

    it('shows all alerts for Professional tier', () => {
      mockIsTierAtLeast = (tier) => tier === 'professional' || tier === 'essential'

      render(<DashboardPage />)

      // Should show all 4 alert types
      expect(screen.getByTestId('alert-behind_schedule')).toBeDefined()
      expect(screen.getByTestId('alert-stale_cases')).toBeDefined()
      expect(screen.getByTestId('alert-validation')).toBeDefined()
      expect(screen.getByTestId('alert-missing_milestones')).toBeDefined()

      expect(screen.getByTestId('alert-count')).toHaveTextContent('4 alerts')
    })

    it('shows all alerts for Enterprise tier', () => {
      mockIsTierAtLeast = () => true // Enterprise has access to everything

      render(<DashboardPage />)

      expect(screen.getByTestId('alert-count')).toHaveTextContent('4 alerts')
      expect(screen.getByTestId('alert-validation')).toBeDefined()
      expect(screen.getByTestId('alert-missing_milestones')).toBeDefined()
    })
  })

  // ============================================
  // UNIT: Widget Gating
  // ============================================

  describe('FacilityScoreMini gating', () => {
    it('renders FacilityScoreMini for Professional tier', () => {
      mockIsTierAtLeast = (tier) => tier === 'professional' || tier === 'essential'

      render(<DashboardPage />)

      const scoreWidget = screen.getByTestId('facility-score-mini')
      expect(scoreWidget).toBeDefined()
      expect(scoreWidget).toHaveTextContent('Facility Score: 82.5')

      // Should NOT be blurred
      expect(screen.queryByTestId('blurred-professional')).toBeNull()
    })

    it('blurs FacilityScoreMini for Essential tier', () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'

      render(<DashboardPage />)

      // Should render blurred versions (FacilityScore + Insights = 2)
      const blurred = screen.getAllByTestId('blurred-professional')
      expect(blurred).toHaveLength(2)

      const upgrades = screen.getAllByTestId('upgrade-prompt')
      expect(upgrades).toHaveLength(2)
      expect(upgrades[0]).toHaveTextContent('Upgrade to professional')

      // The widget itself is still rendered (just blurred)
      expect(screen.getByTestId('facility-score-mini')).toBeDefined()
    })
  })

  describe('InsightsSection gating', () => {
    it('renders InsightsSection for Professional tier', () => {
      mockIsTierAtLeast = (tier) => tier === 'professional' || tier === 'essential'

      render(<DashboardPage />)

      const insights = screen.getByTestId('insights-section')
      expect(insights).toBeDefined()
      expect(insights).toHaveTextContent('Insights')

      // Should NOT be blurred
      expect(screen.queryByTestId('blurred-professional')).toBeNull()
    })

    it('blurs InsightsSection for Essential tier', () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'

      render(<DashboardPage />)

      // Should render blurred versions (FacilityScore + Insights = 2)
      const blurred = screen.getAllByTestId('blurred-professional')
      expect(blurred).toHaveLength(2)

      const upgrades = screen.getAllByTestId('upgrade-prompt')
      expect(upgrades).toHaveLength(2)

      // The widget itself is still rendered (just blurred)
      expect(screen.getByTestId('insights-section')).toBeDefined()
    })
  })

  // ============================================
  // INTEGRATION: Downstream Consumption
  // ============================================

  describe('Integration: NeedsAttention consumes filtered alerts', () => {
    it('NeedsAttention receives pre-filtered alerts for Essential tier', () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'

      render(<DashboardPage />)

      // The NeedsAttention component should receive exactly 2 alerts
      // (behind_schedule + stale_cases), not the full 4
      const alertCount = screen.getByTestId('alert-count')
      expect(alertCount).toHaveTextContent('2 alerts')

      // Verify the correct alerts are shown
      expect(screen.getByText('2 rooms behind schedule')).toBeDefined()
      expect(screen.getByText('3 stale cases')).toBeDefined()

      // Verify DQ alerts are NOT passed to NeedsAttention
      expect(screen.queryByText('5 cases need validation')).toBeNull()
      expect(screen.queryByText('4 cases with missing milestones')).toBeNull()
    })

    it('NeedsAttention receives all alerts for Professional tier', () => {
      mockIsTierAtLeast = (tier) => tier === 'professional' || tier === 'essential'

      render(<DashboardPage />)

      const alertCount = screen.getByTestId('alert-count')
      expect(alertCount).toHaveTextContent('4 alerts')

      // All 4 alerts should be visible
      expect(screen.getByText('2 rooms behind schedule')).toBeDefined()
      expect(screen.getByText('3 stale cases')).toBeDefined()
      expect(screen.getByText('5 cases need validation')).toBeDefined()
      expect(screen.getByText('4 cases with missing milestones')).toBeDefined()
    })
  })

  // ============================================
  // WORKFLOW: User Journey
  // ============================================

  describe('Workflow: Essential user sees operational alerts only', () => {
    it('Essential tier user flow: dashboard loads → sees operational widgets + filtered alerts', async () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'

      render(<DashboardPage />)

      // 1. Page renders with greeting
      await waitFor(() => {
        expect(screen.getByText(/Good (morning|afternoon|evening), Test/)).toBeDefined()
      })

      // 2. All non-gated widgets are visible
      expect(screen.getByTestId('kpi-or-utilization')).toBeDefined()
      expect(screen.getByTestId('kpi-cases')).toBeDefined()
      expect(screen.getByTestId('kpi-median-turnover')).toBeDefined()
      expect(screen.getByTestId('kpi-on-time-starts')).toBeDefined()
      expect(screen.getByTestId('schedule-timeline')).toBeDefined()
      expect(screen.getByTestId('todays-surgeons')).toBeDefined()
      expect(screen.getByTestId('trend-chart')).toBeDefined()
      expect(screen.getByTestId('quick-access')).toBeDefined()

      // 3. FacilityScore and Insights are BLURRED (upgrade prompts visible)
      expect(screen.getAllByTestId('blurred-professional')).toHaveLength(2)
      expect(screen.getAllByTestId('upgrade-prompt')).toHaveLength(2)

      // 4. NeedsAttention shows ONLY operational alerts (2 out of 4)
      const alertCount = screen.getByTestId('alert-count')
      expect(alertCount).toHaveTextContent('2 alerts')
      expect(screen.getByTestId('alert-behind_schedule')).toBeDefined()
      expect(screen.getByTestId('alert-stale_cases')).toBeDefined()
      expect(screen.queryByTestId('alert-validation')).toBeNull()
      expect(screen.queryByTestId('alert-missing_milestones')).toBeNull()
    })
  })

  describe('Workflow: Professional user sees full dashboard', () => {
    it('Professional tier user flow: dashboard loads → sees all widgets and alerts', async () => {
      mockIsTierAtLeast = (tier) => tier === 'professional' || tier === 'essential'

      render(<DashboardPage />)

      // 1. Page renders
      await waitFor(() => {
        expect(screen.getByText(/Good (morning|afternoon|evening), Test/)).toBeDefined()
      })

      // 2. All widgets are visible AND not blurred
      expect(screen.getByTestId('kpi-or-utilization')).toBeDefined()
      expect(screen.getByTestId('facility-score-mini')).toHaveTextContent('Facility Score: 82.5')
      expect(screen.getByTestId('insights-section')).toHaveTextContent('Insights')

      // 3. NO upgrade prompts visible
      expect(screen.queryByTestId('upgrade-prompt')).toBeNull()

      // 4. NeedsAttention shows ALL 4 alerts
      expect(screen.getByTestId('alert-count')).toHaveTextContent('4 alerts')
      expect(screen.getByTestId('alert-behind_schedule')).toBeDefined()
      expect(screen.getByTestId('alert-stale_cases')).toBeDefined()
      expect(screen.getByTestId('alert-validation')).toBeDefined()
      expect(screen.getByTestId('alert-missing_milestones')).toBeDefined()
    })
  })

  describe('Workflow: Time range toggle does not affect gating', () => {
    it('changing time range preserves tier-based alert filtering', async () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'
      const user = userEvent.setup()

      render(<DashboardPage />)

      // Initial state: Essential tier sees 2 alerts
      expect(screen.getByTestId('alert-count')).toHaveTextContent('2 alerts')

      // Click time range toggle (This Week)
      const weekButton = screen.getByRole('button', { name: 'This Week' })
      await user.click(weekButton)

      // Alert filtering should remain consistent
      await waitFor(() => {
        expect(screen.getByTestId('alert-count')).toHaveTextContent('2 alerts')
        expect(screen.getByTestId('alert-behind_schedule')).toBeDefined()
        expect(screen.getByTestId('alert-stale_cases')).toBeDefined()
        expect(screen.queryByTestId('alert-validation')).toBeNull()
      })

      // Click time range toggle (This Month)
      const monthButton = screen.getByRole('button', { name: 'This Month' })
      await user.click(monthButton)

      // Alert filtering should STILL remain consistent
      await waitFor(() => {
        expect(screen.getByTestId('alert-count')).toHaveTextContent('2 alerts')
      })
    })
  })

  // ============================================
  // EDGE CASES
  // ============================================

  describe('Edge cases', () => {
    it('handles empty alerts array for Essential tier', () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'

      // Override alerts to empty array
      alertsConfig.data = []

      render(<DashboardPage />)

      // filteredAlerts should be an empty array, not crash
      expect(screen.getByTestId('alert-count')).toHaveTextContent('0 alerts')
    })

    it('handles null alerts for Essential tier', () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'

      // Override alerts to null
      alertsConfig.data = null as unknown as DashboardAlert[]

      render(<DashboardPage />)

      // Should handle gracefully (useMemo returns [] when alerts is null)
      expect(screen.getByTestId('alert-count')).toHaveTextContent('0 alerts')
    })

    it('all alert types pass through for Professional when only DQ alerts exist', () => {
      mockIsTierAtLeast = (tier) => tier === 'professional' || tier === 'essential'

      // Override alerts to have ONLY DQ alerts (no operational ones)
      const dqOnlyAlerts: DashboardAlert[] = [
        mockAlerts[2], // validation
        mockAlerts[3], // missing_milestones
      ]
      alertsConfig.data = dqOnlyAlerts

      render(<DashboardPage />)

      // Professional tier should see both DQ alerts
      expect(screen.getByTestId('alert-count')).toHaveTextContent('2 alerts')
      expect(screen.getByTestId('alert-validation')).toBeDefined()
      expect(screen.getByTestId('alert-missing_milestones')).toBeDefined()
    })

    it('Essential tier sees zero alerts when only DQ alerts exist', () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'

      // Override alerts to have ONLY DQ alerts (no operational ones)
      const dqOnlyAlerts: DashboardAlert[] = [
        mockAlerts[2], // validation
        mockAlerts[3], // missing_milestones
      ]
      alertsConfig.data = dqOnlyAlerts

      render(<DashboardPage />)

      // Essential tier filters out all DQ alerts → sees 0
      expect(screen.getByTestId('alert-count')).toHaveTextContent('0 alerts')
      expect(screen.queryByTestId('alert-validation')).toBeNull()
      expect(screen.queryByTestId('alert-missing_milestones')).toBeNull()
    })
  })
})
