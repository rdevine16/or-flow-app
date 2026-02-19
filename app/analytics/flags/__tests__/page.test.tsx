/**
 * app/analytics/flags/__tests__/page.test.tsx
 *
 * Integration tests for the Case Flag Analytics page (Phase 2).
 *
 * Strategy: The full page has deep auth + Supabase dependencies.
 * We test in two ways:
 *
 * A) Pure logic unit tests — page-level helper functions that don't
 *    require rendering (getFlagRateStatus, getDelayRateStatus thresholds).
 *
 * B) Component composition integration — render FlagKPICard + SeverityStrip
 *    together with realistic data the way the page assembles them, verifying
 *    that the page's data wiring produces the correct output.
 *
 * C) FlagsEmptyState — render the empty state sub-component in isolation to
 *    verify it renders all 4 KPI cards with zero values and the empty message.
 *
 * D) FlagsPageSkeleton — verify it renders exactly 4 skeleton KPI slots.
 *
 * Covers:
 * 1.  getFlagRateStatus: rate > 30 → "bad"
 * 2.  getFlagRateStatus: rate 21–30 → "neutral"
 * 3.  getFlagRateStatus: rate <= 20 → "good"
 * 4.  getDelayRateStatus: rate > 20 → "bad"
 * 5.  getDelayRateStatus: rate 16–20 → "neutral"
 * 6.  getDelayRateStatus: rate <= 15 → "good"
 * 7.  KPI strip renders 4 cards with correct labels when data has flags
 * 8.  SeverityStrip receives correct counts from summary data
 * 9.  Empty state: renders 4 KPI cards with "0" values
 * 10. Empty state: renders "No flags detected" message
 * 11. Empty state: renders suggestion to expand date range
 * 12. Loading skeleton: renders 4 skeleton card slots
 * 13. Integration: flagRate value formatted to 1 decimal place
 * 14. Integration: delayRate value formatted to 1 decimal place
 * 15. Integration: critical KPI card always has "bad" status (hard-coded in page)
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import FlagKPICard from '@/components/analytics/flags/FlagKPICard'
import SeverityStrip from '@/components/analytics/flags/SeverityStrip'
import type { FlagSummaryKPIs } from '@/types/flag-analytics'

// ============================================
// Extracted page-level helpers (mirror the page functions for testability)
// These are duplicated here because Next.js page files can't be imported
// directly in vitest without mocking the entire auth stack.
// ============================================

function getFlagRateStatus(rate: number): 'good' | 'neutral' | 'bad' {
  if (rate > 30) return 'bad'
  if (rate > 20) return 'neutral'
  return 'good'
}

function getDelayRateStatus(rate: number): 'good' | 'neutral' | 'bad' {
  if (rate > 20) return 'bad'
  if (rate > 15) return 'neutral'
  return 'good'
}

// ============================================
// Test data factory
// ============================================

function makeSummary(overrides: Partial<FlagSummaryKPIs> = {}): FlagSummaryKPIs {
  return {
    totalCases: 65,
    flaggedCases: 12,
    flagRate: 18.5,
    flagRateTrend: -2.1,
    delayedCases: 8,
    delayRate: 12.3,
    delayRateTrend: 1.5,
    criticalCount: 5,
    warningCount: 14,
    infoCount: 22,
    totalFlags: 41,
    avgFlagsPerCase: 3.4,
    ...overrides,
  }
}

// ============================================
// FlagsEmptyState — extracted and tested in isolation
// (duplicates the component from page.tsx without the DashboardLayout wrapper)
// ============================================

function FlagsEmptyStateTestHarness() {
  return (
    <div>
      <div data-testid="kpi-strip">
        <FlagKPICard label="Flagged Cases" value="0" unit="%" detail="0 of 0 cases" />
        <FlagKPICard label="Delay Rate" value="0" unit="%" detail="0 user-reported delays" />
        <FlagKPICard label="Critical Flags" value={0} detail="0 warnings · 0 info" />
        <FlagKPICard label="Total Flags" value={0} detail="0 avg per flagged case" />
      </div>
      <div data-testid="empty-message">
        <p>No flags detected for this period</p>
        <p>Try expanding the date range or check that cases have been completed and validated.</p>
      </div>
    </div>
  )
}

// ============================================
// FlagsPageSkeleton — extracted for skeleton tests
// ============================================

function FlagsPageSkeletonTestHarness() {
  return (
    <div className="space-y-6 animate-pulse" data-testid="skeleton">
      <div data-testid="skeleton-kpi-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} data-testid="skeleton-kpi-card" />
        ))}
      </div>
    </div>
  )
}

// ============================================
// KPI Strip — how the page renders it when data is present
// ============================================

function KPIStripTestHarness({ summary }: { summary: FlagSummaryKPIs }) {
  const sparklineData = {
    flagRate: [20, 19, 21, 18, summary.flagRate],
    delayRate: [15, 14, 13, 12, summary.delayRate],
  }

  return (
    <div data-testid="kpi-strip">
      <FlagKPICard
        label="Flagged Cases"
        value={summary.flagRate.toFixed(1)}
        unit="%"
        trend={summary.flagRateTrend}
        trendInverse
        sparkData={sparklineData.flagRate}
        sparkColor="#ef4444"
        status={getFlagRateStatus(summary.flagRate)}
        detail={`${summary.flaggedCases} of ${summary.totalCases} cases`}
      />
      <FlagKPICard
        label="Delay Rate"
        value={summary.delayRate.toFixed(1)}
        unit="%"
        trend={summary.delayRateTrend}
        trendInverse
        sparkData={sparklineData.delayRate}
        sparkColor="#f59e0b"
        status={getDelayRateStatus(summary.delayRate)}
        detail={`${summary.delayedCases} user-reported delays`}
      />
      <FlagKPICard
        label="Critical Flags"
        value={summary.criticalCount}
        status="bad"
        detail={`${summary.warningCount} warnings · ${summary.infoCount} info`}
      />
      <FlagKPICard
        label="Total Flags"
        value={summary.totalFlags}
        detail={`${summary.avgFlagsPerCase.toFixed(1)} avg per flagged case`}
      />
    </div>
  )
}

// ============================================
// Tests: Page helper functions
// ============================================

describe('CaseFlagsAnalyticsPage helper functions', () => {
  describe('getFlagRateStatus', () => {
    it('rate > 30 is "bad"', () => {
      expect(getFlagRateStatus(31)).toBe('bad')
      expect(getFlagRateStatus(50)).toBe('bad')
    })

    it('rate exactly 30 is "neutral" (boundary)', () => {
      expect(getFlagRateStatus(30)).toBe('neutral')
    })

    it('rate 21–30 is "neutral"', () => {
      expect(getFlagRateStatus(25)).toBe('neutral')
      expect(getFlagRateStatus(21)).toBe('neutral')
    })

    it('rate 20 is "good" (boundary)', () => {
      expect(getFlagRateStatus(20)).toBe('good')
    })

    it('rate <= 20 is "good"', () => {
      expect(getFlagRateStatus(10)).toBe('good')
      expect(getFlagRateStatus(0)).toBe('good')
    })
  })

  describe('getDelayRateStatus', () => {
    it('rate > 20 is "bad"', () => {
      expect(getDelayRateStatus(21)).toBe('bad')
      expect(getDelayRateStatus(35)).toBe('bad')
    })

    it('rate exactly 20 is "neutral" (boundary)', () => {
      expect(getDelayRateStatus(20)).toBe('neutral')
    })

    it('rate 16–20 is "neutral"', () => {
      expect(getDelayRateStatus(18)).toBe('neutral')
      expect(getDelayRateStatus(16)).toBe('neutral')
    })

    it('rate exactly 15 is "good" (boundary)', () => {
      expect(getDelayRateStatus(15)).toBe('good')
    })

    it('rate <= 15 is "good"', () => {
      expect(getDelayRateStatus(8)).toBe('good')
      expect(getDelayRateStatus(0)).toBe('good')
    })
  })
})

// ============================================
// Tests: KPI Strip integration
// ============================================

describe('CaseFlagsAnalyticsPage KPI strip integration', () => {
  it('renders all 4 KPI card labels', () => {
    render(<KPIStripTestHarness summary={makeSummary()} />)
    expect(screen.getByText('Flagged Cases')).toBeDefined()
    expect(screen.getByText('Delay Rate')).toBeDefined()
    expect(screen.getByText('Critical Flags')).toBeDefined()
    expect(screen.getByText('Total Flags')).toBeDefined()
  })

  it('formats flagRate to 1 decimal place', () => {
    render(<KPIStripTestHarness summary={makeSummary({ flagRate: 18.5 })} />)
    expect(screen.getByText('18.5')).toBeDefined()
  })

  it('formats delayRate to 1 decimal place', () => {
    render(<KPIStripTestHarness summary={makeSummary({ delayRate: 12.3 })} />)
    expect(screen.getByText('12.3')).toBeDefined()
  })

  it('formats avgFlagsPerCase to 1 decimal place in detail string', () => {
    render(<KPIStripTestHarness summary={makeSummary({ avgFlagsPerCase: 3.4 })} />)
    expect(screen.getByText('3.4 avg per flagged case')).toBeDefined()
  })

  it('critical KPI card has rose dot (hard-coded "bad" status)', () => {
    const { container } = render(<KPIStripTestHarness summary={makeSummary()} />)
    // "bad" status → bg-rose-500 dot
    const roseDots = container.querySelectorAll('.bg-rose-500')
    expect(roseDots.length).toBeGreaterThanOrEqual(1)
  })

  it('detail string for Critical Flags shows warning and info breakdown', () => {
    render(
      <KPIStripTestHarness
        summary={makeSummary({ warningCount: 14, infoCount: 22 })}
      />
    )
    expect(screen.getByText('14 warnings · 22 info')).toBeDefined()
  })

  it('detail string for Flagged Cases shows case count', () => {
    render(
      <KPIStripTestHarness
        summary={makeSummary({ flaggedCases: 12, totalCases: 65 })}
      />
    )
    expect(screen.getByText('12 of 65 cases')).toBeDefined()
  })

  it('flagRate 18.5 → "good" status (green dot)', () => {
    const { container } = render(
      <KPIStripTestHarness summary={makeSummary({ flagRate: 18.5 })} />
    )
    // "good" → bg-emerald-500 dot (on the Flagged Cases card)
    const greenDots = container.querySelectorAll('.bg-emerald-500')
    expect(greenDots.length).toBeGreaterThanOrEqual(1)
  })

  it('flagRate 35 → "bad" status (rose dot on Flagged Cases card)', () => {
    const { container } = render(
      <KPIStripTestHarness summary={makeSummary({ flagRate: 35 })} />
    )
    const roseDots = container.querySelectorAll('.bg-rose-500')
    // At least 2 rose dots: one from Flagged Cases (bad) + one from Critical Flags (hard-coded bad)
    expect(roseDots.length).toBeGreaterThanOrEqual(2)
  })
})

// ============================================
// Tests: SeverityStrip data wiring
// ============================================

describe('CaseFlagsAnalyticsPage SeverityStrip wiring', () => {
  it('passes correct counts from summary to SeverityStrip', () => {
    const summary = makeSummary({
      criticalCount: 5,
      warningCount: 14,
      infoCount: 22,
      totalFlags: 41,
    })
    render(
      <SeverityStrip
        criticalCount={summary.criticalCount}
        warningCount={summary.warningCount}
        infoCount={summary.infoCount}
        totalFlags={summary.totalFlags}
      />
    )
    // All three sections render with their counts
    expect(screen.getByText('5')).toBeDefined()
    expect(screen.getByText('14')).toBeDefined()
    expect(screen.getByText('22')).toBeDefined()
  })

  it('SeverityStrip is not rendered when totalFlags is 0 (matches page empty-state logic)', () => {
    const { container } = render(
      <SeverityStrip
        criticalCount={0}
        warningCount={0}
        infoCount={0}
        totalFlags={0}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('percentage for critical = round(criticalCount / totalFlags * 100)', () => {
    // 5 / 41 ≈ 12%
    render(
      <SeverityStrip
        criticalCount={5}
        warningCount={14}
        infoCount={22}
        totalFlags={41}
      />
    )
    expect(screen.getByText('12%')).toBeDefined()
  })
})

// ============================================
// Tests: Empty state component
// ============================================

describe('CaseFlagsAnalyticsPage empty state', () => {
  it('renders all 4 KPI cards in empty state', () => {
    render(<FlagsEmptyStateTestHarness />)
    expect(screen.getByText('Flagged Cases')).toBeDefined()
    expect(screen.getByText('Delay Rate')).toBeDefined()
    expect(screen.getByText('Critical Flags')).toBeDefined()
    expect(screen.getByText('Total Flags')).toBeDefined()
  })

  it('all KPI values show "0" in empty state', () => {
    const { container } = render(<FlagsEmptyStateTestHarness />)
    const zeroValues = container.querySelectorAll('.font-mono')
    // Each KPI card has one monospace value element
    expect(zeroValues.length).toBeGreaterThanOrEqual(4)
    const allZero = Array.from(zeroValues).every((el) => el.textContent === '0')
    expect(allZero).toBe(true)
  })

  it('renders "No flags detected for this period" heading', () => {
    render(<FlagsEmptyStateTestHarness />)
    expect(screen.getByText('No flags detected for this period')).toBeDefined()
  })

  it('renders suggestion to expand date range', () => {
    render(<FlagsEmptyStateTestHarness />)
    expect(
      screen.getByText(
        'Try expanding the date range or check that cases have been completed and validated.'
      )
    ).toBeDefined()
  })
})

// ============================================
// Tests: Loading skeleton
// ============================================

describe('CaseFlagsAnalyticsPage loading skeleton', () => {
  it('renders exactly 4 skeleton KPI card slots', () => {
    const { container } = render(<FlagsPageSkeletonTestHarness />)
    const skeletonCards = container.querySelectorAll('[data-testid="skeleton-kpi-card"]')
    expect(skeletonCards).toHaveLength(4)
  })

  it('skeleton container has animate-pulse class', () => {
    const { container } = render(<FlagsPageSkeletonTestHarness />)
    const skeleton = container.querySelector('[data-testid="skeleton"]')
    expect(skeleton?.className).toContain('animate-pulse')
  })
})

// ============================================
// Tests: Workflow — data present → renders KPI strip + SeverityStrip together
// ============================================

describe('CaseFlagsAnalyticsPage workflow: data-present render path', () => {
  it('full data-present render: KPI strip + SeverityStrip render together', () => {
    const summary = makeSummary()

    render(
      <div>
        <KPIStripTestHarness summary={summary} />
        <SeverityStrip
          criticalCount={summary.criticalCount}
          warningCount={summary.warningCount}
          infoCount={summary.infoCount}
          totalFlags={summary.totalFlags}
        />
      </div>
    )

    // KPI cards present
    expect(screen.getByText('Flagged Cases')).toBeDefined()
    expect(screen.getByText('Total Flags')).toBeDefined()

    // Severity strip present
    expect(screen.getByText('CRITICAL')).toBeDefined()
    expect(screen.getByText('WARNING')).toBeDefined()
    expect(screen.getByText('INFO')).toBeDefined()
  })

  it('edge case: single flag, critical only — SeverityStrip shows 100%', () => {
    const summary = makeSummary({
      criticalCount: 1,
      warningCount: 0,
      infoCount: 0,
      totalFlags: 1,
      flaggedCases: 1,
      totalCases: 10,
      flagRate: 10.0,
    })

    render(
      <SeverityStrip
        criticalCount={summary.criticalCount}
        warningCount={summary.warningCount}
        infoCount={summary.infoCount}
        totalFlags={summary.totalFlags}
      />
    )

    expect(screen.getByText('100%')).toBeDefined()
    expect(screen.getByText('1')).toBeDefined()
  })

  it('edge case: high flag rate triggers correct status colors', () => {
    const summary = makeSummary({ flagRate: 45.0 }) // > 30 → "bad"

    const { container } = render(<KPIStripTestHarness summary={summary} />)

    // Flagged Cases card + Critical Flags card both have "bad" → 2 rose dots minimum
    const roseDots = container.querySelectorAll('.bg-rose-500')
    expect(roseDots.length).toBeGreaterThanOrEqual(2)
  })
})
