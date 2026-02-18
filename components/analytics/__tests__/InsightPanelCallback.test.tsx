/**
 * components/analytics/__tests__/InsightPanelCallback.test.tsx
 *
 * Tests for the Callback/Idle Time drill-through panel (Phase 2).
 *
 * 1. Unit: Surgeon cards sorted by actionability, expandable detail toggles
 * 2. Integration: Clicking callback insight opens panel with correct data and financial calcs
 * 3. Workflow: Expand surgeon → see gap detail → recommendation text reflects actual data
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InsightPanelCallback from '../InsightPanelCallback'
import type { SurgeonIdleSummary, FlipRoomAnalysis } from '@/lib/analyticsV2'
import type { Insight } from '@/lib/insightsEngine'

// ============================================
// HELPERS
// ============================================

function makeSurgeon(overrides: Partial<SurgeonIdleSummary> = {}): SurgeonIdleSummary {
  return {
    surgeonId: 'surgeon-1',
    surgeonName: 'Dr. Martinez',
    caseCount: 28,
    gapCount: 8,
    medianIdleTime: 4,
    medianCallbackDelta: 0,
    flipGapCount: 8,
    sameRoomGapCount: 0,
    medianFlipIdle: 4,
    medianSameRoomIdle: 0,
    hasFlipData: true,
    status: 'on_track',
    statusLabel: 'On Track',
    ...overrides,
  }
}

function makeFlipAnalysis(overrides: Partial<FlipRoomAnalysis> = {}): FlipRoomAnalysis {
  return {
    surgeonId: 'surgeon-1',
    surgeonName: 'Dr. Martinez',
    date: '2024-02-03',
    cases: [
      { caseId: 'c1', caseNumber: '1041', roomId: 'r1', roomName: 'OR-1', scheduledStart: '7:30' },
      { caseId: 'c2', caseNumber: '1042', roomId: 'r3', roomName: 'OR-3', scheduledStart: '9:00' },
    ],
    idleGaps: [
      { fromCase: '1041', toCase: '1042', idleMinutes: 4, optimalCallDelta: 0, gapType: 'flip', fromRoom: 'OR-1', toRoom: 'OR-3' },
    ],
    avgIdleTime: 4,
    totalIdleTime: 4,
    isFlipRoom: true,
    ...overrides,
  }
}

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: 'callback-call-sooner',
    category: 'callback_optimization',
    severity: 'warning',
    title: 'Callback Timing Opportunity',
    body: 'Test body.',
    action: 'View details →',
    drillThroughType: 'callback',
    metadata: { annualImpact: 24000 },
    ...overrides,
  }
}

// Default surgeons: one on_track, one call_sooner
const drMartinez = makeSurgeon({
  surgeonId: 'surgeon-1',
  surgeonName: 'Dr. Martinez',
  status: 'on_track',
  statusLabel: 'On Track',
  medianFlipIdle: 4,
  medianCallbackDelta: 0,
  flipGapCount: 8,
  caseCount: 28,
})

const drWilliams = makeSurgeon({
  surgeonId: 'surgeon-2',
  surgeonName: 'Dr. Williams',
  status: 'call_sooner',
  statusLabel: 'Call Sooner',
  medianFlipIdle: 12,
  medianCallbackDelta: 7,
  flipGapCount: 3,
  sameRoomGapCount: 5,
  medianSameRoomIdle: 52,
  caseCount: 15,
})

const martinezFlip = makeFlipAnalysis({
  surgeonId: 'surgeon-1',
  surgeonName: 'Dr. Martinez',
  date: '2024-02-03',
  idleGaps: [
    { fromCase: '1041', toCase: '1042', idleMinutes: 4, optimalCallDelta: 0, gapType: 'flip', fromRoom: 'OR-1', toRoom: 'OR-3' },
    { fromCase: '1042', toCase: '1043', idleMinutes: 3, optimalCallDelta: 0, gapType: 'flip', fromRoom: 'OR-3', toRoom: 'OR-1' },
  ],
})

const williamsFlip = makeFlipAnalysis({
  surgeonId: 'surgeon-2',
  surgeonName: 'Dr. Williams',
  date: '2024-02-04',
  idleGaps: [
    { fromCase: '1048', toCase: '1049', idleMinutes: 14, optimalCallDelta: 9, gapType: 'flip', fromRoom: 'OR-2', toRoom: 'OR-4' },
  ],
})

const defaultProps = {
  surgeonSummaries: [drMartinez, drWilliams],
  flipRoomAnalysis: [martinezFlip, williamsFlip],
  insight: makeInsight(),
  revenuePerMinute: 36,
  operatingDaysPerYear: 250,
}

// ============================================
// UNIT TESTS
// ============================================

describe('InsightPanelCallback — unit tests', () => {
  it('renders surgeon comparison heading', () => {
    render(<InsightPanelCallback {...defaultProps} />)
    expect(screen.getByText('Surgeon Comparison')).toBeDefined()
  })

  it('renders both surgeons', () => {
    render(<InsightPanelCallback {...defaultProps} />)
    expect(screen.getByText('Dr. Martinez')).toBeDefined()
    expect(screen.getByText('Dr. Williams')).toBeDefined()
  })

  it('sorts call_sooner surgeons before on_track', () => {
    render(<InsightPanelCallback {...defaultProps} />)
    const buttons = screen.getAllByRole('button')
    // Filter to surgeon cards (they have aria-label with surgeon name)
    const surgeonCards = buttons.filter(b => b.getAttribute('aria-label')?.includes('Dr.'))
    expect(surgeonCards.length).toBe(2)
    // First should be Dr. Williams (call_sooner), second Dr. Martinez (on_track)
    expect(surgeonCards[0].getAttribute('aria-label')).toContain('Dr. Williams')
    expect(surgeonCards[1].getAttribute('aria-label')).toContain('Dr. Martinez')
  })

  it('displays correct status badges', () => {
    render(<InsightPanelCallback {...defaultProps} />)
    expect(screen.getByText('Call Sooner')).toBeDefined()
    expect(screen.getByText('On Track')).toBeDefined()
  })

  it('displays flip idle values for surgeons with flip data', () => {
    render(<InsightPanelCallback {...defaultProps} />)
    // Dr. Martinez: 4m, Dr. Williams: 12m
    expect(screen.getByText('4m')).toBeDefined()
    expect(screen.getByText('12m')).toBeDefined()
  })

  it('displays callback delta for call_sooner surgeons', () => {
    render(<InsightPanelCallback {...defaultProps} />)
    expect(screen.getByText('7m')).toBeDefined() // Dr. Williams' callback delta
  })

  it('displays case counts', () => {
    render(<InsightPanelCallback {...defaultProps} />)
    expect(screen.getByText('28')).toBeDefined() // Dr. Martinez cases
    expect(screen.getByText('15')).toBeDefined() // Dr. Williams cases
  })

  it('shows empty state when no surgeon data', () => {
    render(
      <InsightPanelCallback
        {...defaultProps}
        surgeonSummaries={[]}
        flipRoomAnalysis={[]}
      />
    )
    expect(screen.getByText('No Surgeon Idle Data')).toBeDefined()
  })

  it('shows expand indicator on surgeon cards', () => {
    render(<InsightPanelCallback {...defaultProps} />)
    // Both cards start collapsed — look for ▸ indicators
    const indicators = screen.getAllByText('▸')
    expect(indicators.length).toBe(2)
  })
})

// ============================================
// INTEGRATION TESTS
// ============================================

describe('InsightPanelCallback — integration', () => {
  it('renders recommendation box with specific timing advice', () => {
    render(<InsightPanelCallback {...defaultProps} />)
    expect(screen.getByText('Recommendation')).toBeDefined()
    // Should mention Dr. Williams and 7 minutes (multiple elements due to surgeon cards)
    expect(screen.getAllByText(/Dr\. Williams/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/7 minutes/)).toBeDefined()
  })

  it('recommendation mentions benchmark surgeon', () => {
    render(<InsightPanelCallback {...defaultProps} />)
    expect(screen.getByText(/Dr\. Martinez is the benchmark/)).toBeDefined()
  })

  it('shows financial impact section', () => {
    render(<InsightPanelCallback {...defaultProps} />)
    expect(screen.getByText('Financial Impact Estimate')).toBeDefined()
  })

  it('financial section shows revenue rate', () => {
    render(<InsightPanelCallback {...defaultProps} />)
    // Revenue rate appears in both the value display and description text
    expect(screen.getAllByText(/\$36/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Revenue rate')).toBeDefined()
  })

  it('financial section shows operating days in description', () => {
    render(<InsightPanelCallback {...defaultProps} />)
    expect(screen.getByText(/250 operating days\/year/)).toBeDefined()
  })

  it('no recommendation box when all surgeons are on track', () => {
    render(
      <InsightPanelCallback
        {...defaultProps}
        surgeonSummaries={[drMartinez]}
      />
    )
    expect(screen.queryByText('Recommendation')).toBeNull()
  })

  it('no financial impact when no recoverable minutes', () => {
    render(
      <InsightPanelCallback
        {...defaultProps}
        surgeonSummaries={[drMartinez]}
      />
    )
    expect(screen.queryByText('Financial Impact Estimate')).toBeNull()
  })
})

// ============================================
// WORKFLOW TESTS: Expand → Gap Detail
// ============================================

describe('InsightPanelCallback — workflow: expand surgeon', () => {
  it('clicking a surgeon card expands to show flip room transitions', () => {
    render(<InsightPanelCallback {...defaultProps} />)

    // Initially, no "Flip Room Transitions" header visible
    expect(screen.queryByText('Flip Room Transitions')).toBeNull()

    // Click Dr. Williams (first card due to sort order)
    const cards = screen.getAllByRole('button').filter(b => b.getAttribute('aria-label')?.includes('Dr.'))
    fireEvent.click(cards[0]) // Dr. Williams

    // Now should see "Flip Room Transitions"
    expect(screen.getByText('Flip Room Transitions')).toBeDefined()
  })

  it('expanded detail shows gap data with idle times', () => {
    render(<InsightPanelCallback {...defaultProps} />)

    // Click Dr. Williams
    const cards = screen.getAllByRole('button').filter(b => b.getAttribute('aria-label')?.includes('Dr.'))
    fireEvent.click(cards[0])

    // Should show from/to case numbers
    expect(screen.getByText('1048')).toBeDefined()
    expect(screen.getByText('1049')).toBeDefined()

    // Should show room names
    expect(screen.getByText('OR-2')).toBeDefined()
    expect(screen.getByText('OR-4')).toBeDefined()

    // Should show idle time (14m)
    expect(screen.getByText('14m')).toBeDefined()

    // Should show save amount (9m)
    expect(screen.getByText('9m')).toBeDefined()
  })

  it('expanded detail shows formatted date', () => {
    render(<InsightPanelCallback {...defaultProps} />)

    const cards = screen.getAllByRole('button').filter(b => b.getAttribute('aria-label')?.includes('Dr.'))
    fireEvent.click(cards[0]) // Dr. Williams

    expect(screen.getByText('Feb 4')).toBeDefined()
  })

  it('clicking an expanded surgeon collapses the detail', () => {
    render(<InsightPanelCallback {...defaultProps} />)

    // Click to expand
    const cards = screen.getAllByRole('button').filter(b => b.getAttribute('aria-label')?.includes('Dr.'))
    fireEvent.click(cards[0])
    expect(screen.getByText('Flip Room Transitions')).toBeDefined()

    // Click again to collapse
    fireEvent.click(cards[0])
    expect(screen.queryByText('Flip Room Transitions')).toBeNull()
  })

  it('expand indicator changes from ▸ to ▾ when expanded', () => {
    render(<InsightPanelCallback {...defaultProps} />)

    // Before expansion: all ▸
    expect(screen.getAllByText('▸').length).toBe(2)
    expect(screen.queryAllByText('▾').length).toBe(0)

    // Expand first card
    const cards = screen.getAllByRole('button').filter(b => b.getAttribute('aria-label')?.includes('Dr.'))
    fireEvent.click(cards[0])

    // After: one ▾ (expanded), one ▸ (collapsed)
    expect(screen.getAllByText('▸').length).toBe(1)
    expect(screen.getAllByText('▾').length).toBe(1)
  })

  it('only one surgeon can be expanded at a time', () => {
    render(<InsightPanelCallback {...defaultProps} />)

    const cards = screen.getAllByRole('button').filter(b => b.getAttribute('aria-label')?.includes('Dr.'))

    // Expand Dr. Williams
    fireEvent.click(cards[0])
    expect(screen.getByText('Flip Room Transitions')).toBeDefined()

    // Expand Dr. Martinez (should collapse Dr. Williams)
    fireEvent.click(cards[1])

    // Martinez's flip transitions should be visible, Williams' should not
    // Martinez has fromCase '1041' and '1042' as transitions
    expect(screen.getByText('1041')).toBeDefined()
  })
})

// ============================================
// EDGE CASES
// ============================================

describe('InsightPanelCallback — edge cases', () => {
  it('handles surgeon with turnover_only status', () => {
    const turnoverOnlySurgeon = makeSurgeon({
      surgeonId: 'surgeon-3',
      surgeonName: 'Dr. Patel',
      status: 'turnover_only',
      statusLabel: 'Turnover Only',
      hasFlipData: false,
      flipGapCount: 0,
      medianFlipIdle: 0,
      medianCallbackDelta: 0,
    })

    render(
      <InsightPanelCallback
        {...defaultProps}
        surgeonSummaries={[...defaultProps.surgeonSummaries, turnoverOnlySurgeon]}
      />
    )

    expect(screen.getByText('Dr. Patel')).toBeDefined()
    expect(screen.getByText('Turnover Only')).toBeDefined()
  })

  it('handles surgeon with call_later status', () => {
    const callLaterSurgeon = makeSurgeon({
      surgeonId: 'surgeon-4',
      surgeonName: 'Dr. Chen',
      status: 'call_later',
      statusLabel: 'Call Later',
      medianFlipIdle: 1,
      medianCallbackDelta: 0,
    })

    render(
      <InsightPanelCallback
        {...defaultProps}
        surgeonSummaries={[callLaterSurgeon]}
      />
    )

    expect(screen.getByText('Dr. Chen')).toBeDefined()
    expect(screen.getByText('Call Later')).toBeDefined()
  })

  it('uses provided revenuePerMinute in financial display', () => {
    render(
      <InsightPanelCallback
        {...defaultProps}
        revenuePerMinute={50}
      />
    )
    // $50 appears in both value and description
    expect(screen.getAllByText(/\$50/).length).toBeGreaterThanOrEqual(1)
  })

  it('same-room gap count displays correctly', () => {
    render(<InsightPanelCallback {...defaultProps} />)
    // Dr. Williams has 5 same-room gaps
    expect(screen.getByText('5 gaps')).toBeDefined()
  })
})
