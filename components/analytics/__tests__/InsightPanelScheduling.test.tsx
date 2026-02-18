/**
 * components/analytics/__tests__/InsightPanelScheduling.test.tsx
 *
 * Tests for the Scheduling & Volume drill-through panel (Phase 5).
 *
 * 1. Unit: Weekly chart shows trend, summary renders correct values
 * 2. Integration: Scheduling insight click opens correct panel with live data
 * 3. Workflow: Volume-vs-utilization divergence insight shows comparison
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import InsightPanelScheduling from '../InsightPanelScheduling'
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
    totalCases: 96,
    completedCases: 90,
    cancelledCases: 6,
    fcots: { ...makeKPI(), firstCaseDetails: [] } as FCOTSResult,
    turnoverTime: { ...makeKPI(), details: [], compliantCount: 0, nonCompliantCount: 0, complianceRate: 0 },
    orUtilization: {
      ...makeKPI({ value: 65, displayValue: '65%', target: 75, targetMet: false, delta: 10, deltaType: 'decrease' }),
      roomBreakdown: [],
      roomsWithRealHours: 0,
      roomsWithDefaultHours: 0,
    } as ORUtilizationResult,
    caseVolume: {
      ...makeKPI({ value: 96, displayValue: '96', delta: 15, deltaType: 'increase' }),
      weeklyVolume: [
        { week: '2024-01-29', count: 20 },
        { week: '2024-02-05', count: 22 },
        { week: '2024-02-12', count: 26 },
        { week: '2024-02-19', count: 28 },
      ],
    } as CaseVolumeResult,
    cancellationRate: {
      ...makeKPI(),
      sameDayCount: 0,
      sameDayRate: 0,
      totalCancelledCount: 0,
      details: [],
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
    ...overrides,
  }
}

// ============================================
// UNIT: EMPTY STATE
// ============================================

describe('InsightPanelScheduling — empty state', () => {
  it('renders empty state when no weekly volume data', () => {
    const analytics = makeAnalytics({
      caseVolume: {
        ...makeKPI({ value: 0, displayValue: '0' }),
        weeklyVolume: [],
      } as CaseVolumeResult,
    })
    render(<InsightPanelScheduling analytics={analytics} />)
    expect(screen.getByText('No Scheduling Data')).toBeDefined()
  })
})

// ============================================
// UNIT: SUMMARY STRIP
// ============================================

describe('InsightPanelScheduling — summary strip', () => {
  it('displays total cases, completed, avg/week, and trend', () => {
    const analytics = makeAnalytics()
    render(<InsightPanelScheduling analytics={analytics} />)

    // Total = 96
    expect(screen.getByText('96')).toBeDefined()
    // Completed = 90
    expect(screen.getByText('90')).toBeDefined()
    // Avg/week = (20+22+26+28)/4 = 24
    expect(screen.getByText('24')).toBeDefined()
    // Trend = +15%
    expect(screen.getByText('+15%')).toBeDefined()
  })

  it('shows negative trend correctly', () => {
    const analytics = makeAnalytics({
      caseVolume: {
        ...makeKPI({ value: 80, displayValue: '80', delta: 20, deltaType: 'decrease' }),
        weeklyVolume: [{ week: '2024-02-05', count: 40 }, { week: '2024-02-12', count: 40 }],
      } as CaseVolumeResult,
    })
    render(<InsightPanelScheduling analytics={analytics} />)
    expect(screen.getByText('-20%')).toBeDefined()
  })
})

// ============================================
// UNIT: WEEKLY VOLUME CHART
// ============================================

describe('InsightPanelScheduling — weekly volume chart', () => {
  it('renders all week bars with count labels', () => {
    const analytics = makeAnalytics()
    render(<InsightPanelScheduling analytics={analytics} />)

    expect(screen.getByText('20')).toBeDefined()
    expect(screen.getByText('22')).toBeDefined()
    expect(screen.getByText('26')).toBeDefined()
    expect(screen.getByText('28')).toBeDefined()
  })

  it('renders week labels in chart', () => {
    const analytics = makeAnalytics()
    render(<InsightPanelScheduling analytics={analytics} />)

    // Week labels: "Jan 29", "Feb 5", "Feb 12", "Feb 19"
    expect(screen.getByText('Jan 29')).toBeDefined()
    expect(screen.getByText('Feb 5')).toBeDefined()
    expect(screen.getByText('Feb 12')).toBeDefined()
    expect(screen.getByText('Feb 19')).toBeDefined()
  })

  it('shows trend description when volume is increasing', () => {
    const analytics = makeAnalytics()
    render(<InsightPanelScheduling analytics={analytics} />)

    // First half avg = (20+22)/2 = 21, second half avg = (26+28)/2 = 27
    expect(screen.getByText('increasing')).toBeDefined()
  })

  it('shows trend description when volume is decreasing', () => {
    const analytics = makeAnalytics({
      caseVolume: {
        ...makeKPI({ value: 96, displayValue: '96', delta: 10, deltaType: 'decrease' }),
        weeklyVolume: [
          { week: '2024-01-29', count: 30 },
          { week: '2024-02-05', count: 28 },
          { week: '2024-02-12', count: 20 },
          { week: '2024-02-19', count: 18 },
        ],
      } as CaseVolumeResult,
    })
    render(<InsightPanelScheduling analytics={analytics} />)

    expect(screen.getByText('decreasing')).toBeDefined()
  })
})

// ============================================
// INTEGRATION: VOLUME VS UTILIZATION
// ============================================

describe('InsightPanelScheduling — volume vs utilization', () => {
  it('renders volume vs utilization section when delta data is available', () => {
    const analytics = makeAnalytics()
    render(<InsightPanelScheduling analytics={analytics} />)

    expect(screen.getByText('Volume vs Utilization')).toBeDefined()
    expect(screen.getByText('Case Volume')).toBeDefined()
    expect(screen.getByText('OR Utilization')).toBeDefined()
  })

  it('shows divergence warning when volume up but utilization down', () => {
    const analytics = makeAnalytics() // volume +15%, utilization -10%
    render(<InsightPanelScheduling analytics={analytics} />)

    expect(screen.getByText(/More cases are being scheduled but rooms are used less efficiently/)).toBeDefined()
  })

  it('shows positive pattern when both trending up', () => {
    const analytics = makeAnalytics({
      orUtilization: {
        ...makeKPI({ value: 80, displayValue: '80%', delta: 5, deltaType: 'increase' }),
        roomBreakdown: [],
        roomsWithRealHours: 0,
        roomsWithDefaultHours: 0,
      } as ORUtilizationResult,
    })
    render(<InsightPanelScheduling analytics={analytics} />)

    expect(screen.getByText(/Both volume and utilization are trending up/)).toBeDefined()
  })

  it('does not show volume vs utilization when no delta data', () => {
    const analytics = makeAnalytics({
      caseVolume: {
        ...makeKPI({ value: 96, displayValue: '96' }),
        weeklyVolume: [{ week: '2024-02-05', count: 48 }, { week: '2024-02-12', count: 48 }],
      } as CaseVolumeResult,
      orUtilization: {
        ...makeKPI({ value: 75, displayValue: '75%' }),
        roomBreakdown: [],
        roomsWithRealHours: 0,
        roomsWithDefaultHours: 0,
      } as ORUtilizationResult,
    })
    render(<InsightPanelScheduling analytics={analytics} />)

    expect(screen.queryByText('Volume vs Utilization')).toBeNull()
  })
})

// ============================================
// WORKFLOW: FULL SCENARIO
// ============================================

describe('InsightPanelScheduling — workflow', () => {
  it('full divergence scenario: volume up, utilization down', () => {
    const analytics = makeAnalytics() // volume +15%, utilization -10%
    render(<InsightPanelScheduling analytics={analytics} />)

    // Summary present
    expect(screen.getByText('96')).toBeDefined()
    expect(screen.getByText('+15%')).toBeDefined()

    // Weekly chart
    expect(screen.getByText('Weekly Volume Trend')).toBeDefined()
    expect(screen.getByText('28')).toBeDefined() // Highest week

    // Volume vs utilization
    expect(screen.getByText('Volume vs Utilization')).toBeDefined()
    expect(screen.getByText(/More cases are being scheduled/)).toBeDefined()
  })

  it('declining volume scenario', () => {
    const analytics = makeAnalytics({
      totalCases: 60,
      completedCases: 55,
      caseVolume: {
        ...makeKPI({ value: 60, displayValue: '60', delta: 25, deltaType: 'decrease' }),
        weeklyVolume: [
          { week: '2024-01-29', count: 20 },
          { week: '2024-02-05', count: 18 },
          { week: '2024-02-12', count: 12 },
          { week: '2024-02-19', count: 10 },
        ],
      } as CaseVolumeResult,
      orUtilization: {
        ...makeKPI({ value: 55, displayValue: '55%', delta: 15, deltaType: 'decrease' }),
        roomBreakdown: [],
        roomsWithRealHours: 0,
        roomsWithDefaultHours: 0,
      } as ORUtilizationResult,
    })
    render(<InsightPanelScheduling analytics={analytics} />)

    // Summary
    expect(screen.getByText('60')).toBeDefined()
    expect(screen.getByText('-25%')).toBeDefined()

    // Declining trend
    expect(screen.getByText('decreasing')).toBeDefined()

    // Both declining pattern
    expect(screen.getByText(/Both volume and utilization are declining/)).toBeDefined()
  })
})
