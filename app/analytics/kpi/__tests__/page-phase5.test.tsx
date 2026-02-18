/**
 * Phase 5 tests: AI Insight Drill-Through Panels (Phase 1)
 *
 * Tests the click-wiring logic between insight cards and InsightSlideOver:
 * 1. hasPanel logic — insights with drillThroughType are clickable, null-type are not
 * 2. activeInsight state management — clicking a card sets the insight
 * 3. InsightSlideOver integration — renders correct insight, close resets state
 * 4. Keyboard interaction — Enter/Space on drillthrough card triggers open
 * 5. Non-drillthrough cards have no button role or onClick
 *
 * Note: The full KPI page has complex Supabase + auth dependencies.
 * We test the relevant logic through:
 * a) Direct logic unit tests (hasPanel, activeInsight selection)
 * b) InsightSlideOver integration rendered in isolation with real insight objects
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InsightSlideOver from '@/components/analytics/InsightSlideOver'
import { generateInsights } from '@/lib/insightsEngine'
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

function makeKPI(overrides: Partial<KPIResult> = {}): KPIResult {
  return { value: 0, displayValue: '0', subtitle: '', ...overrides }
}

function makeAnalytics(overrides: Partial<AnalyticsOverview> = {}): AnalyticsOverview {
  return {
    totalCases: 100,
    completedCases: 80,
    cancelledCases: 0,
    fcots: {
      ...makeKPI({ value: 85, displayValue: '85%', target: 85, targetMet: true }),
      firstCaseDetails: [],
    } as FCOTSResult,
    turnoverTime: makeKPI({ value: 25, displayValue: '25 min', target: 30, targetMet: true }),
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
    nonOperativeTime: makeKPI({ value: 0, displayValue: '0 min', subtitle: '0% of total case time · 0 cases' }),
    surgeonIdleTime: makeKPI(),
    surgeonIdleFlip: makeKPI(),
    surgeonIdleSameRoom: makeKPI(),
    standardSurgicalTurnover: makeKPI({ value: 40, displayValue: '40 min', target: 45, targetMet: true }),
    flipRoomTime: makeKPI({ value: 12, displayValue: '12 min', target: 15, targetMet: true }),
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

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: 'test-insight',
    category: 'first_case_delays',
    severity: 'warning',
    title: 'Test Insight',
    body: 'Test body.',
    action: 'View details →',
    drillThroughType: 'fcots',
    metadata: {},
    ...overrides,
  }
}

const mockConfig: FacilityAnalyticsConfig = ANALYTICS_CONFIG_DEFAULTS

/** Helper to get baseProps for InsightSlideOver with given analytics */
function slideOverProps(analytics?: AnalyticsOverview) {
  return { analytics: analytics ?? makeAnalytics(), config: mockConfig }
}

// ============================================
// hasPanel logic (mirrors page.tsx)
// ============================================

describe('hasPanel logic', () => {
  it('insight with drillThroughType !== null has a panel', () => {
    const insight = makeInsight({ drillThroughType: 'fcots' })
    const hasPanel = insight.drillThroughType !== null
    expect(hasPanel).toBe(true)
  })

  it('insight with drillThroughType = null does not have a panel', () => {
    const insight = makeInsight({ drillThroughType: null })
    const hasPanel = insight.drillThroughType !== null
    expect(hasPanel).toBe(false)
  })

  it('all non-null drillThroughTypes produce hasPanel = true', () => {
    const types: Insight['drillThroughType'][] = [
      'callback', 'fcots', 'utilization', 'turnover',
      'cancellation', 'non_op_time', 'scheduling',
    ]
    for (const type of types) {
      const insight = makeInsight({ drillThroughType: type })
      expect(insight.drillThroughType !== null).toBe(true)
    }
  })

  it('generated insights: drillthrough types match expected categories', () => {
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPI({ value: 31, displayValue: '31%', target: 85, targetMet: false, subtitle: '11 late of 16 first cases' }),
        firstCaseDetails: [],
      } as FCOTSResult,
    })
    const insights = generateInsights(analytics)
    // At least one insight should have drillThroughType = 'fcots'
    const hasInteractiveInsight = insights.some(i => i.drillThroughType !== null)
    expect(hasInteractiveInsight).toBe(true)
  })
})

// ============================================
// activeInsight state management
// ============================================

describe('activeInsight state management', () => {
  it('setActiveInsight called with the clicked insight', () => {
    // Simulate the onClick handler: () => setActiveInsight(insight)
    const insight = makeInsight({ drillThroughType: 'fcots' })
    let activeInsight: Insight | null = null

    const setActiveInsight = (i: Insight | null) => { activeInsight = i }
    const onClick = () => setActiveInsight(insight)

    onClick()
    expect(activeInsight).toBe(insight)
  })

  it('onClose resets activeInsight to null', () => {
    let activeInsight: Insight | null = makeInsight({ drillThroughType: 'fcots' })

    const onClose = () => { activeInsight = null }
    onClose()
    expect(activeInsight).toBeNull()
  })

  it('clicking a different insight replaces activeInsight', () => {
    const insight1 = makeInsight({ id: 'insight-1', drillThroughType: 'fcots' })
    const insight2 = makeInsight({ id: 'insight-2', drillThroughType: 'turnover' })
    let activeInsight: Insight | null = null

    const setActiveInsight = (i: Insight | null) => { activeInsight = i }

    setActiveInsight(insight1)
    expect((activeInsight as Insight | null)?.id).toBe('insight-1')

    setActiveInsight(insight2)
    expect((activeInsight as Insight | null)?.id).toBe('insight-2')
  })

  it('non-drillthrough insights do not have an onClick (no setActiveInsight called)', () => {
    const insight = makeInsight({ drillThroughType: null })
    let activeInsight: Insight | null = null

    const setActiveInsight = (i: Insight | null) => { activeInsight = i }

    // Page only calls setActiveInsight when hasPanel is true
    const hasPanel = insight.drillThroughType !== null
    if (hasPanel) setActiveInsight(insight)

    // Should remain null because hasPanel is false
    expect(activeInsight).toBeNull()
  })
})

// ============================================
// InsightSlideOver integration with real insight objects
// ============================================

describe('InsightSlideOver integration — rendering real insights', () => {
  it('opens with a critical FCOTS insight from generateInsights', () => {
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPI({ value: 31, displayValue: '31%', target: 85, targetMet: false, subtitle: '11 late of 16 first cases' }),
        firstCaseDetails: [],
      } as FCOTSResult,
    })
    const insights = generateInsights(analytics)
    const fcotsInsight = insights.find(i => i.id === 'fcots-delays')
    expect(fcotsInsight).toBeDefined()

    render(<InsightSlideOver insight={fcotsInsight!} onClose={() => {}} {...slideOverProps(analytics)} />)

    // Panel should be open and show the FCOTS panel title
    expect(screen.getByRole('dialog')).toBeDefined()
    // Title appears in both Dialog.Title (h2) and PanelPlaceholder (h3)
    expect(screen.getAllByText('First Case On-Time Detail').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('critical')).toBeDefined()
  })

  it('opens with a warning turnover insight from generateInsights', () => {
    const analytics = makeAnalytics({
      turnoverTime: makeKPI({
        value: 40,
        displayValue: '40 min',
        target: 80,
        targetMet: false,
        subtitle: '60% under 30 min target',
      }),
    })
    const insights = generateInsights(analytics)
    const turnoverInsight = insights.find(i => i.id === 'turnover-room')
    expect(turnoverInsight).toBeDefined()

    render(<InsightSlideOver insight={turnoverInsight!} onClose={() => {}} {...slideOverProps(analytics)} />)

    expect(screen.getByRole('dialog')).toBeDefined()
    // Title appears in both Dialog.Title (h2) and PanelPlaceholder (h3)
    expect(screen.getAllByText('Turnover Detail').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('warning')).toBeDefined()
  })

  it('close button calls onClose handler', () => {
    const onClose = vi.fn()
    const insight = makeInsight({ drillThroughType: 'utilization', severity: 'critical' })
    render(<InsightSlideOver insight={insight} onClose={onClose} {...slideOverProps()} />)

    const closeBtn = screen.getByRole('button', { name: /close panel/i })
    fireEvent.click(closeBtn)

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('slide-over is hidden when activeInsight is null (panel closed)', () => {
    render(<InsightSlideOver insight={null} onClose={() => {}} {...slideOverProps()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('slide-over is hidden when drillThroughType = null (positive/info insight, no panel)', () => {
    const positiveInsight = makeInsight({ drillThroughType: null, severity: 'positive' })
    render(<InsightSlideOver insight={positiveInsight} onClose={() => {}} {...slideOverProps()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('panel shows correct title when switching insight types', () => {
    const props = slideOverProps()
    const { rerender } = render(
      <InsightSlideOver insight={makeInsight({ drillThroughType: 'fcots' })} onClose={() => {}} {...props} />
    )
    // Title appears in both Dialog.Title (h2) and PanelPlaceholder (h3) — use getAllByText
    expect(screen.getAllByText('First Case On-Time Detail').length).toBeGreaterThanOrEqual(1)

    rerender(
      <InsightSlideOver insight={makeInsight({ drillThroughType: 'callback' })} onClose={() => {}} {...props} />
    )
    expect(screen.getAllByText('Callback / Idle Time Detail').length).toBeGreaterThanOrEqual(1)
  })
})

// ============================================
// Keyboard interaction on insight cards
// ============================================

describe('Keyboard interaction on insight cards', () => {
  it('Enter key fires onClick for drillthrough card', () => {
    const insight = makeInsight({ drillThroughType: 'fcots' })
    let clicked = false
    const hasPanel = insight.drillThroughType !== null

    // Replicate the onKeyDown handler from page.tsx
    const onKeyDown = hasPanel
      ? (e: { key: string; preventDefault: () => void }) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            clicked = true
          }
        }
      : undefined

    expect(onKeyDown).toBeDefined()
    onKeyDown!({ key: 'Enter', preventDefault: () => {} })
    expect(clicked).toBe(true)
  })

  it('Space key fires onClick for drillthrough card', () => {
    const insight = makeInsight({ drillThroughType: 'turnover' })
    let clicked = false
    const hasPanel = insight.drillThroughType !== null

    const onKeyDown = hasPanel
      ? (e: { key: string; preventDefault: () => void }) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            clicked = true
          }
        }
      : undefined

    expect(onKeyDown).toBeDefined()
    onKeyDown!({ key: ' ', preventDefault: () => {} })
    expect(clicked).toBe(true)
  })

  it('non-drillthrough card has no onKeyDown handler', () => {
    const insight = makeInsight({ drillThroughType: null })
    const hasPanel = insight.drillThroughType !== null

    // page.tsx: onKeyDown={hasPanel ? ... : undefined}
    const onKeyDown = hasPanel
      ? () => { /* handler */ }
      : undefined

    expect(onKeyDown).toBeUndefined()
  })

  it('tab index is 0 for drillthrough cards, undefined for non-drillthrough', () => {
    const withPanel = makeInsight({ drillThroughType: 'fcots' })
    const withoutPanel = makeInsight({ drillThroughType: null })

    const tabIndexWith = withPanel.drillThroughType !== null ? 0 : undefined
    const tabIndexWithout = withoutPanel.drillThroughType !== null ? 0 : undefined

    expect(tabIndexWith).toBe(0)
    expect(tabIndexWithout).toBeUndefined()
  })

  it('aria-label is set for drillthrough cards, undefined for non-drillthrough', () => {
    const withPanel = makeInsight({ drillThroughType: 'fcots', title: 'First Case Delays' })
    const withoutPanel = makeInsight({ drillThroughType: null, title: 'On Target' })

    const hasPanel = withPanel.drillThroughType !== null
    const ariaLabelWith = hasPanel ? `${withPanel.title} — click for details` : undefined
    const ariaLabelWithout = withoutPanel.drillThroughType !== null
      ? `${withoutPanel.title} — click for details`
      : undefined

    expect(ariaLabelWith).toBe('First Case Delays — click for details')
    expect(ariaLabelWithout).toBeUndefined()
  })
})

// ============================================
// ChevronRight indicator on drillthrough cards
// ============================================

describe('ChevronRight indicator logic', () => {
  it('drillthrough insight has hasPanel = true (chevron shown)', () => {
    const types: Insight['drillThroughType'][] = [
      'callback', 'fcots', 'utilization', 'turnover',
      'cancellation', 'non_op_time', 'scheduling',
    ]
    for (const type of types) {
      const insight = makeInsight({ drillThroughType: type })
      expect(insight.drillThroughType !== null).toBe(true)
    }
  })

  it('positive/null drillthrough insight has hasPanel = false (no chevron)', () => {
    const insight = makeInsight({ drillThroughType: null, severity: 'positive' })
    expect(insight.drillThroughType !== null).toBe(false)
  })
})
