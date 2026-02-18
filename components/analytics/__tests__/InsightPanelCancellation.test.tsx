/**
 * InsightPanelCancellation tests
 *
 * Unit: cancellation summary renders correctly, detail table renders all cases, type badges correct
 * Integration: clicking cancellation insight opens panel with correct cancellation data
 * Workflow: same-day cancellations separated from other types, zero-day streak displayed
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import InsightPanelCancellation from '../InsightPanelCancellation'
import type { CancellationResult, CancellationDetail, FacilityAnalyticsConfig } from '@/lib/analyticsV2'
import { ANALYTICS_CONFIG_DEFAULTS } from '@/lib/analyticsV2'

// ============================================
// HELPERS
// ============================================

function makeCancellationResult(details: CancellationDetail[], overrides?: Partial<CancellationResult>): CancellationResult {
  const sameDayCount = details.filter(d => d.cancellationType === 'same_day').length

  return {
    value: 4.2,
    displayValue: '4.2%',
    subtitle: `${sameDayCount} same-day of ${details.length} total cancellations`,
    target: 5,
    targetMet: true,
    sameDayCount,
    sameDayRate: 4.2,
    totalCancelledCount: details.length,
    details,
    ...overrides,
  }
}

function makeDetail(overrides?: Partial<CancellationDetail>): CancellationDetail {
  return {
    caseId: 'c1',
    caseNumber: 'C001',
    date: '2025-02-03',
    roomName: 'OR-1',
    surgeonName: 'John Martinez',
    scheduledStart: '07:30:00',
    cancellationType: 'same_day',
    ...overrides,
  }
}

const defaultConfig: FacilityAnalyticsConfig = {
  ...ANALYTICS_CONFIG_DEFAULTS,
}

// ============================================
// UNIT TESTS
// ============================================

describe('InsightPanelCancellation', () => {
  it('renders cancellation summary cards', () => {
    const details = [
      makeDetail({ cancellationType: 'same_day' }),
      makeDetail({ caseId: 'c2', caseNumber: 'C002', cancellationType: 'prior_day' }),
    ]

    render(
      <InsightPanelCancellation
        cancellationRate={makeCancellationResult(details, { sameDayCount: 1, sameDayRate: 2.1 })}
        config={defaultConfig}
      />
    )

    // Same-day count
    expect(screen.getByText('1')).toBeDefined()
    // Rate
    expect(screen.getByText('2.1%')).toBeDefined()
    // Target
    expect(screen.getByText('<5%')).toBeDefined()
  })

  it('renders same-day cancellation table separately', () => {
    const details = [
      makeDetail({ caseId: 'c1', caseNumber: 'C001', cancellationType: 'same_day' }),
      makeDetail({ caseId: 'c2', caseNumber: 'C002', cancellationType: 'prior_day' }),
    ]

    render(
      <InsightPanelCancellation
        cancellationRate={makeCancellationResult(details)}
        config={defaultConfig}
      />
    )

    expect(screen.getByText('Same-Day Cancellations')).toBeDefined()
    expect(screen.getByText('Other Cancellations')).toBeDefined()
  })

  it('renders empty state when no cancellations', () => {
    render(
      <InsightPanelCancellation
        cancellationRate={makeCancellationResult([])}
        config={defaultConfig}
      />
    )

    expect(screen.getByText('No Cancellations')).toBeDefined()
  })

  it('renders type badges correctly', () => {
    const details = [
      makeDetail({ caseId: 'c1', cancellationType: 'same_day' }),
      makeDetail({ caseId: 'c2', caseNumber: 'C002', cancellationType: 'prior_day' }),
    ]

    render(
      <InsightPanelCancellation
        cancellationRate={makeCancellationResult(details)}
        config={defaultConfig}
      />
    )

    // "Same-Day" appears in both the summary card label and as a type badge
    expect(screen.getAllByText('Same-Day').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Prior Day')).toBeDefined()
  })

  it('shows positive trend when zero-day streak is 5 or more', () => {
    const details = [
      makeDetail({ cancellationType: 'same_day' }),
    ]

    // Build dailyData with 5+ zero-cancellation days at the end
    const dailyData = Array.from({ length: 7 }, (_, i) => ({
      date: `2025-02-${String(i + 10).padStart(2, '0')}`,
      color: 'green' as const,
      tooltip: '',
      numericValue: 0,
    }))

    render(
      <InsightPanelCancellation
        cancellationRate={makeCancellationResult(details, { dailyData })}
        config={defaultConfig}
      />
    )

    expect(screen.getByText('Positive Trend')).toBeDefined()
    expect(screen.getByText(/7 consecutive days/)).toBeDefined()
  })

  it('does not show positive trend when streak is under 5', () => {
    const details = [
      makeDetail({ cancellationType: 'same_day' }),
    ]

    const dailyData = [
      { date: '2025-02-01', color: 'red' as const, tooltip: '', numericValue: 1 },
      { date: '2025-02-02', color: 'green' as const, tooltip: '', numericValue: 0 },
      { date: '2025-02-03', color: 'green' as const, tooltip: '', numericValue: 0 },
    ]

    render(
      <InsightPanelCancellation
        cancellationRate={makeCancellationResult(details, { dailyData })}
        config={defaultConfig}
      />
    )

    expect(screen.queryByText('Positive Trend')).toBeNull()
  })

  it('renders surgeon name and room for each cancellation', () => {
    const details = [
      makeDetail({
        caseId: 'c1',
        surgeonName: 'Sarah Williams',
        roomName: 'OR-3',
        cancellationType: 'same_day',
      }),
    ]

    render(
      <InsightPanelCancellation
        cancellationRate={makeCancellationResult(details)}
        config={defaultConfig}
      />
    )

    expect(screen.getByText('Sarah Williams')).toBeDefined()
    expect(screen.getByText('OR-3')).toBeDefined()
  })
})
