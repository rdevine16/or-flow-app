/**
 * components/analytics/__tests__/InsightPanelNonOpTime.test.tsx
 *
 * Tests for the Non-Operative Time drill-through panel (Phase 5).
 *
 * 1. Unit: Time breakdown bars render with correct proportions
 * 2. Integration: Non-op insight click opens correct panel with live data
 * 3. Workflow: Analysis box shows when non-op percent is high
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import InsightPanelNonOpTime from '../InsightPanelNonOpTime'
import type {
  AnalyticsOverview,
  FCOTSResult,
  KPIResult,
  ORUtilizationResult,
  CaseVolumeResult,
  CancellationResult,
} from '@/lib/analyticsV2'

// ============================================
// HELPERS
// ============================================

function makeKPI(overrides: Partial<KPIResult> = {}): KPIResult {
  return { value: 0, displayValue: '0', subtitle: '', ...overrides }
}

function makeAnalytics(overrides: Partial<AnalyticsOverview> = {}): AnalyticsOverview {
  return {
    totalCases: 50,
    completedCases: 49,
    cancelledCases: 1,
    fcots: { ...makeKPI(), firstCaseDetails: [] } as FCOTSResult,
    turnoverTime: makeKPI(),
    orUtilization: {
      ...makeKPI(),
      roomBreakdown: [],
      roomsWithRealHours: 0,
      roomsWithDefaultHours: 0,
    } as ORUtilizationResult,
    caseVolume: { ...makeKPI(), weeklyVolume: [] } as CaseVolumeResult,
    cancellationRate: {
      ...makeKPI(),
      sameDayCount: 0,
      sameDayRate: 0,
      totalCancelledCount: 0,
    } as CancellationResult,
    cumulativeTardiness: makeKPI(),
    nonOperativeTime: makeKPI({ value: 32, displayValue: '32 min', subtitle: '38% of total case time · 49 cases' }),
    surgeonIdleTime: makeKPI(),
    surgeonIdleFlip: makeKPI(),
    surgeonIdleSameRoom: makeKPI(),
    standardSurgicalTurnover: makeKPI(),
    flipRoomTime: makeKPI(),
    flipRoomAnalysis: [],
    surgeonIdleSummaries: [],
    avgTotalCaseTime: 110,
    avgSurgicalTime: 52,
    avgPreOpTime: 32,
    avgAnesthesiaTime: 8,
    avgClosingTime: 12,
    avgEmergenceTime: 6,
    ...overrides,
  }
}

// ============================================
// UNIT: EMPTY STATE
// ============================================

describe('InsightPanelNonOpTime — empty state', () => {
  it('renders empty state when no completed cases', () => {
    const analytics = makeAnalytics({
      completedCases: 0,
      avgTotalCaseTime: 0,
      avgSurgicalTime: 0,
      avgPreOpTime: 0,
      avgAnesthesiaTime: 0,
      avgClosingTime: 0,
      avgEmergenceTime: 0,
    })
    render(<InsightPanelNonOpTime analytics={analytics} />)
    expect(screen.getByText('No Time Data')).toBeDefined()
  })

  it('renders empty state when all avg times are zero', () => {
    const analytics = makeAnalytics({
      avgTotalCaseTime: 0,
      avgSurgicalTime: 0,
      avgPreOpTime: 0,
      avgAnesthesiaTime: 0,
      avgClosingTime: 0,
      avgEmergenceTime: 0,
    })
    render(<InsightPanelNonOpTime analytics={analytics} />)
    expect(screen.getByText('No Time Data')).toBeDefined()
  })
})

// ============================================
// UNIT: SUMMARY STRIP
// ============================================

describe('InsightPanelNonOpTime — summary strip', () => {
  it('displays non-op time, percent, avg case time, and case count', () => {
    const analytics = makeAnalytics()
    render(<InsightPanelNonOpTime analytics={analytics} />)

    // Non-op = 32 + 12 + 6 = 50 min → 50m
    expect(screen.getByText('50m')).toBeDefined()
    // Percent = 50/110 = 45%
    expect(screen.getByText('45%')).toBeDefined()
    // Avg case time = 110m
    expect(screen.getByText('110m')).toBeDefined()
    // Case count
    expect(screen.getByText('49')).toBeDefined()
  })
})

// ============================================
// UNIT: TIME BREAKDOWN BARS
// ============================================

describe('InsightPanelNonOpTime — time breakdown bars', () => {
  it('renders all five phase labels', () => {
    const analytics = makeAnalytics()
    render(<InsightPanelNonOpTime analytics={analytics} />)

    expect(screen.getByText('Pre-Op')).toBeDefined()
    expect(screen.getByText('Anesthesia')).toBeDefined()
    expect(screen.getByText('Surgical')).toBeDefined()
    expect(screen.getByText('Closing')).toBeDefined()
    expect(screen.getByText('Emergence')).toBeDefined()
  })

  it('displays correct minute values for each phase', () => {
    const analytics = makeAnalytics()
    render(<InsightPanelNonOpTime analytics={analytics} />)

    expect(screen.getByText('32 min')).toBeDefined()
    expect(screen.getByText('8 min')).toBeDefined()
    expect(screen.getByText('52 min')).toBeDefined()
    expect(screen.getByText('12 min')).toBeDefined()
    expect(screen.getByText('6 min')).toBeDefined()
  })

  it('skips phases with zero time', () => {
    const analytics = makeAnalytics({
      avgEmergenceTime: 0,
      avgTotalCaseTime: 104, // 32 + 8 + 52 + 12
    })
    render(<InsightPanelNonOpTime analytics={analytics} />)

    expect(screen.queryByText('Emergence')).toBeNull()
  })
})

// ============================================
// UNIT: OPERATIVE VS NON-OPERATIVE SPLIT
// ============================================

describe('InsightPanelNonOpTime — time split', () => {
  it('shows operative and non-operative percentages', () => {
    const analytics = makeAnalytics()
    render(<InsightPanelNonOpTime analytics={analytics} />)

    // Operative = surgical (52) + anesthesia (8) = 60 → 55%
    // Non-op = pre-op (32) + closing (12) + emergence (6) = 50 → 45%
    expect(screen.getByText(/Operative: 55% \(60m\)/)).toBeDefined()
    expect(screen.getByText(/Non-operative: 45% \(50m\)/)).toBeDefined()
  })
})

// ============================================
// INTEGRATION: ANALYSIS BOX
// ============================================

describe('InsightPanelNonOpTime — analysis box', () => {
  it('shows analysis box when non-op percent > 25%', () => {
    const analytics = makeAnalytics() // 45% non-op
    render(<InsightPanelNonOpTime analytics={analytics} />)

    expect(screen.getByText('Non-Operative Time Analysis')).toBeDefined()
    expect(screen.getByText(/Non-operative time accounts for 45% of total case time/)).toBeDefined()
  })

  it('identifies pre-op as dominant contributor', () => {
    const analytics = makeAnalytics() // pre-op = 32, closing = 12, emergence = 6
    render(<InsightPanelNonOpTime analytics={analytics} />)

    expect(screen.getByText(/Pre-op \(32 min\) is the largest/)).toBeDefined()
  })

  it('shows reduction suggestion when non-op > 35%', () => {
    const analytics = makeAnalytics() // 45% non-op, pre-op = 32 min
    render(<InsightPanelNonOpTime analytics={analytics} />)

    // 20% of 32 = 6.4 → ~6 min saved
    expect(screen.getByText(/Reducing pre-op time by 20% would save ~6 min per case/)).toBeDefined()
  })

  it('does not show analysis box when non-op percent <= 25%', () => {
    // Surgical = 80, pre-op = 5, closing = 3, emergence = 2 → non-op = 10/100 = 10%
    const analytics = makeAnalytics({
      avgTotalCaseTime: 100,
      avgSurgicalTime: 80,
      avgAnesthesiaTime: 10,
      avgPreOpTime: 5,
      avgClosingTime: 3,
      avgEmergenceTime: 2,
    })
    render(<InsightPanelNonOpTime analytics={analytics} />)

    expect(screen.queryByText('Non-Operative Time Analysis')).toBeNull()
  })
})

// ============================================
// WORKFLOW: FULL SCENARIO
// ============================================

describe('InsightPanelNonOpTime — workflow', () => {
  it('full scenario: summary + bars + split + analysis for high non-op data', () => {
    const analytics = makeAnalytics({
      completedCases: 30,
      avgTotalCaseTime: 85,
      avgSurgicalTime: 35,
      avgPreOpTime: 25,
      avgAnesthesiaTime: 10,
      avgClosingTime: 10,
      avgEmergenceTime: 5,
    })
    render(<InsightPanelNonOpTime analytics={analytics} />)

    // Summary: non-op = 25 + 10 + 5 = 40m, 47%
    expect(screen.getByText('40m')).toBeDefined()
    expect(screen.getByText('47%')).toBeDefined()

    // Bars
    expect(screen.getByText('Pre-Op')).toBeDefined()
    expect(screen.getByText('25 min')).toBeDefined()
    expect(screen.getByText('35 min')).toBeDefined()

    // Split
    expect(screen.getByText(/Operative: 53% \(45m\)/)).toBeDefined()
    expect(screen.getByText(/Non-operative: 47% \(40m\)/)).toBeDefined()

    // Analysis
    expect(screen.getByText('Non-Operative Time Analysis')).toBeDefined()
    expect(screen.getByText(/Pre-op \(25 min\) is the largest/)).toBeDefined()
  })

  it('low non-op scenario: summary + bars rendered, no analysis box', () => {
    const analytics = makeAnalytics({
      completedCases: 50,
      avgTotalCaseTime: 150,
      avgSurgicalTime: 100,
      avgPreOpTime: 15,
      avgAnesthesiaTime: 20,
      avgClosingTime: 10,
      avgEmergenceTime: 5,
    })
    render(<InsightPanelNonOpTime analytics={analytics} />)

    // Summary: non-op = 15 + 10 + 5 = 30m, 20%
    expect(screen.getByText('30m')).toBeDefined()
    expect(screen.getByText('20%')).toBeDefined()

    // Bars present
    expect(screen.getByText('Pre-Op')).toBeDefined()
    expect(screen.getByText('Surgical')).toBeDefined()

    // No analysis box (20% <= 25%)
    expect(screen.queryByText('Non-Operative Time Analysis')).toBeNull()
  })
})
