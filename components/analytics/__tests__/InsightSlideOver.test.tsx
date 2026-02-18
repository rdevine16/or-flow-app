/**
 * components/analytics/__tests__/InsightSlideOver.test.tsx
 *
 * Unit tests for the InsightSlideOver component.
 *
 * Covers:
 * 1. Hidden when insight is null (closed state)
 * 2. Hidden when insight has drillThroughType = null (no panel)
 * 3. Visible when open — title, severity badge, close button rendered
 * 4. Panel title derived from drillThroughType, not raw insight.title
 * 5. Severity badge label text reflects insight severity
 * 6. onClose called when close button is clicked
 * 7. Placeholder content rendered for each non-callback panel type
 * 8. Callback panel renders actual content (not placeholder)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InsightSlideOver from '../InsightSlideOver'
import type { Insight } from '@/lib/insightsEngine'
import type {
  AnalyticsOverview,
  FCOTSResult,
  KPIResult,
  ORUtilizationResult,
  CaseVolumeResult,
  CancellationResult,
  FacilityAnalyticsConfig,
} from '@/lib/analyticsV2'
import { ANALYTICS_CONFIG_DEFAULTS } from '@/lib/analyticsV2'

// ============================================
// HELPERS
// ============================================

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: 'test-insight',
    category: 'first_case_delays',
    severity: 'warning',
    title: 'Test Insight Title',
    body: 'This is the body text.',
    action: 'View details →',
    drillThroughType: 'fcots',
    metadata: {},
    ...overrides,
  }
}

function makeKPI(overrides: Partial<KPIResult> = {}): KPIResult {
  return { value: 0, displayValue: '0', subtitle: '', ...overrides }
}

const mockAnalytics: AnalyticsOverview = {
  totalCases: 100,
  completedCases: 80,
  cancelledCases: 0,
  fcots: {
    ...makeKPI({ value: 85, displayValue: '85%', target: 85, targetMet: true }),
    firstCaseDetails: [],
  } as FCOTSResult,
  turnoverTime: makeKPI(),
  orUtilization: {
    ...makeKPI({ value: 75, displayValue: '75%', target: 75, targetMet: true }),
    roomBreakdown: [],
    roomsWithRealHours: 0,
    roomsWithDefaultHours: 0,
  } as ORUtilizationResult,
  caseVolume: {
    ...makeKPI({ value: 100, displayValue: '100' }),
    weeklyVolume: [],
  } as CaseVolumeResult,
  cancellationRate: {
    ...makeKPI({ value: 0, displayValue: '0%', target: 5, targetMet: true }),
    sameDayCount: 0,
    sameDayRate: 0,
    totalCancelledCount: 0,
  } as CancellationResult,
  cumulativeTardiness: makeKPI(),
  nonOperativeTime: makeKPI(),
  surgeonIdleTime: makeKPI(),
  surgeonIdleFlip: makeKPI(),
  surgeonIdleSameRoom: makeKPI(),
  standardSurgicalTurnover: makeKPI(),
  flipRoomTime: makeKPI(),
  flipRoomAnalysis: [],
  surgeonIdleSummaries: [],
  avgTotalCaseTime: 120,
  avgSurgicalTime: 60,
  avgPreOpTime: 20,
  avgAnesthesiaTime: 80,
  avgClosingTime: 15,
  avgEmergenceTime: 10,
}

const mockConfig: FacilityAnalyticsConfig = ANALYTICS_CONFIG_DEFAULTS

/** Shared props for InsightSlideOver in tests */
const baseProps = { analytics: mockAnalytics, config: mockConfig }

// ============================================
// CLOSED STATE
// ============================================

describe('InsightSlideOver — closed state', () => {
  it('renders nothing visible when insight is null', () => {
    render(<InsightSlideOver insight={null} onClose={() => {}} {...baseProps} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'First Case On-Time Detail' })).toBeNull()
  })

  it('does not open when drillThroughType is null (positive insight)', () => {
    const insight = makeInsight({ drillThroughType: null, severity: 'positive' })
    render(<InsightSlideOver insight={insight} onClose={() => {}} {...baseProps} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

// ============================================
// OPEN STATE
// ============================================

describe('InsightSlideOver — open state', () => {
  it('renders the dialog when insight has a drillThroughType', () => {
    const insight = makeInsight({ drillThroughType: 'fcots' })
    render(<InsightSlideOver insight={insight} onClose={() => {}} {...baseProps} />)
    expect(screen.getByRole('dialog')).toBeDefined()
  })

  it('displays the panel title in the dialog header (Dialog.Title h2)', () => {
    const insight = makeInsight({
      drillThroughType: 'fcots',
      title: 'Raw Insight Title That Should Not Appear As Panel Header',
    })
    render(<InsightSlideOver insight={insight} onClose={() => {}} {...baseProps} />)
    const headings = screen.getAllByText('First Case On-Time Detail')
    expect(headings.length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Raw Insight Title That Should Not Appear As Panel Header')).toBeNull()
  })

  it('displays severity badge with correct label', () => {
    const insight = makeInsight({ severity: 'critical', drillThroughType: 'fcots' })
    render(<InsightSlideOver insight={insight} onClose={() => {}} {...baseProps} />)
    expect(screen.getByText('critical')).toBeDefined()
  })

  it('renders warning severity badge', () => {
    const insight = makeInsight({ severity: 'warning', drillThroughType: 'turnover' })
    render(<InsightSlideOver insight={insight} onClose={() => {}} {...baseProps} />)
    expect(screen.getByText('warning')).toBeDefined()
  })

  it('renders info severity badge', () => {
    const insight = makeInsight({ severity: 'info', drillThroughType: 'callback' })
    render(<InsightSlideOver insight={insight} onClose={() => {}} {...baseProps} />)
    expect(screen.getByText('info')).toBeDefined()
  })

  it('renders a close button', () => {
    const insight = makeInsight({ drillThroughType: 'utilization' })
    render(<InsightSlideOver insight={insight} onClose={() => {}} {...baseProps} />)
    const closeBtn = screen.getByRole('button', { name: /close panel/i })
    expect(closeBtn).toBeDefined()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    const insight = makeInsight({ drillThroughType: 'fcots' })
    render(<InsightSlideOver insight={insight} onClose={onClose} {...baseProps} />)
    const closeBtn = screen.getByRole('button', { name: /close panel/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders "Supporting data for this insight" subheader', () => {
    const insight = makeInsight({ drillThroughType: 'fcots' })
    render(<InsightSlideOver insight={insight} onClose={() => {}} {...baseProps} />)
    expect(screen.getByText('Supporting data for this insight')).toBeDefined()
  })
})

// ============================================
// PANEL TYPE TITLES
// ============================================

describe('InsightSlideOver — panel title per drillThroughType', () => {
  const cases: Array<[Insight['drillThroughType'], string]> = [
    ['callback', 'Callback / Idle Time Detail'],
    ['fcots', 'First Case On-Time Detail'],
    ['utilization', 'OR Utilization by Room'],
    ['turnover', 'Turnover Detail'],
    ['cancellation', 'Cancellation Detail'],
    ['non_op_time', 'Non-Operative Time Breakdown'],
    ['scheduling', 'Scheduling & Volume Detail'],
  ]

  for (const [type, expectedTitle] of cases) {
    it(`shows "${expectedTitle}" for type="${type}"`, () => {
      const insight = makeInsight({ drillThroughType: type })
      render(<InsightSlideOver insight={insight} onClose={() => {}} {...baseProps} />)
      const matches = screen.getAllByText(expectedTitle)
      expect(matches.length).toBeGreaterThanOrEqual(1)
    })
  }
})

// ============================================
// PLACEHOLDER CONTENT (non-callback panels)
// ============================================

describe('InsightSlideOver — placeholder content', () => {
  it('renders FCOTS panel content (not placeholder) for fcots type', () => {
    const insight = makeInsight({ drillThroughType: 'fcots' })
    render(<InsightSlideOver insight={insight} onClose={() => {}} {...baseProps} />)
    // With empty firstCaseDetails, shows empty state
    expect(screen.getByText('No First Case Data')).toBeDefined()
    // Should NOT show placeholder
    expect(screen.queryByText(/panel content coming in/i)).toBeNull()
  })

  it('renders callback panel content (not placeholder) for callback type', () => {
    const insight = makeInsight({ drillThroughType: 'callback' })
    render(<InsightSlideOver insight={insight} onClose={() => {}} {...baseProps} />)
    // With empty surgeonIdleSummaries, shows empty state
    expect(screen.getByText('No Surgeon Idle Data')).toBeDefined()
    // Should NOT show placeholder
    expect(screen.queryByText(/panel content coming in/i)).toBeNull()
  })
})
