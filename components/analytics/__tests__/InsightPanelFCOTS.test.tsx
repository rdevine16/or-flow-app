/**
 * components/analytics/__tests__/InsightPanelFCOTS.test.tsx
 *
 * Tests for the FCOTS drill-through panel (Phase 3).
 *
 * 1. Unit: Summary strip computes correctly, detail table renders all cases, pattern detection finds repeat offenders
 * 2. Integration: FCOTS insight click opens panel with correct case data
 * 3. Workflow: Panel pattern box highlights surgeon/room with worst on-time rate
 */

import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import InsightPanelFCOTS from '../InsightPanelFCOTS'
import type { FCOTSResult, FCOTSDetail } from '@/lib/analyticsV2'

// ============================================
// HELPERS
// ============================================

function makeDetail(overrides: Partial<FCOTSDetail> = {}): FCOTSDetail {
  return {
    caseId: 'case-1',
    caseNumber: '1001',
    scheduledDate: '2024-02-03',
    roomName: 'OR-1',
    surgeonName: 'Dr. Martinez',
    scheduledStart: '07:30',
    actualStart: '07:32',
    delayMinutes: 2,
    isOnTime: true,
    ...overrides,
  }
}

function makeFCOTSResult(details: FCOTSDetail[]): FCOTSResult {
  const total = details.length
  const onTimeCount = details.filter(d => d.isOnTime).length
  const rate = total > 0 ? Math.round((onTimeCount / total) * 100) : 0
  const lateCount = total - onTimeCount

  return {
    value: rate,
    displayValue: `${rate}%`,
    subtitle: `${lateCount} late of ${total} first cases (wheels-in, 2 min grace)`,
    target: 85,
    targetMet: rate >= 85,
    dailyData: [],
    firstCaseDetails: details,
  }
}

const defaultProps = {
  graceMinutes: 2,
  targetPercent: 85,
}

// ============================================
// UNIT: EMPTY STATE
// ============================================

describe('InsightPanelFCOTS — empty state', () => {
  it('renders empty state when no first case data', () => {
    const fcots = makeFCOTSResult([])
    render(<InsightPanelFCOTS fcots={fcots} {...defaultProps} />)
    expect(screen.getByText('No First Case Data')).toBeDefined()
  })
})

// ============================================
// UNIT: SUMMARY STRIP
// ============================================

describe('InsightPanelFCOTS — summary strip', () => {
  it('computes on-time rate correctly', () => {
    const details = [
      makeDetail({ caseId: '1', isOnTime: true }),
      makeDetail({ caseId: '2', isOnTime: true }),
      makeDetail({ caseId: '3', isOnTime: false, delayMinutes: 10 }),
      makeDetail({ caseId: '4', isOnTime: false, delayMinutes: 20 }),
    ]
    const fcots = makeFCOTSResult(details)
    render(<InsightPanelFCOTS fcots={fcots} {...defaultProps} />)

    // 2 of 4 on time = 50%
    expect(screen.getByText('50%')).toBeDefined()
    // 2 late
    expect(screen.getByText('2')).toBeDefined()
    // 4 total
    expect(screen.getByText('4')).toBeDefined()
  })

  it('computes average delay from late cases only', () => {
    const details = [
      makeDetail({ caseId: '1', isOnTime: true, delayMinutes: 0 }),
      makeDetail({ caseId: '2', isOnTime: false, delayMinutes: 10 }),
      makeDetail({ caseId: '3', isOnTime: false, delayMinutes: 20 }),
    ]
    const fcots = makeFCOTSResult(details)
    render(<InsightPanelFCOTS fcots={fcots} {...defaultProps} />)

    // Avg delay of late: (10 + 20) / 2 = 15m
    expect(screen.getByText('15m')).toBeDefined()
  })
})

// ============================================
// UNIT: DETAIL TABLE
// ============================================

describe('InsightPanelFCOTS — detail table', () => {
  it('renders all cases in the table', () => {
    const details = [
      makeDetail({ caseId: '1', surgeonName: 'Dr. Martinez', roomName: 'OR-1' }),
      makeDetail({ caseId: '2', surgeonName: 'Dr. Williams', roomName: 'OR-2', isOnTime: false, delayMinutes: 18 }),
      makeDetail({ caseId: '3', surgeonName: 'Dr. Chen', roomName: 'OR-3', isOnTime: false, delayMinutes: 14 }),
    ]
    const fcots = makeFCOTSResult(details)
    render(<InsightPanelFCOTS fcots={fcots} {...defaultProps} />)

    expect(screen.getByText('Dr. Martinez')).toBeDefined()
    expect(screen.getByText('Dr. Williams')).toBeDefined()
    expect(screen.getByText('Dr. Chen')).toBeDefined()
  })

  it('shows delay with plus sign for late cases', () => {
    const details = [
      makeDetail({ caseId: '1', isOnTime: false, delayMinutes: 18 }),
    ]
    const fcots = makeFCOTSResult(details)
    render(<InsightPanelFCOTS fcots={fcots} {...defaultProps} />)

    expect(screen.getByText('+18m')).toBeDefined()
  })

  it('shows "On Time" and "Late" status badges', () => {
    const details = [
      makeDetail({ caseId: '1', isOnTime: true }),
      makeDetail({ caseId: '2', isOnTime: false, delayMinutes: 12 }),
    ]
    const fcots = makeFCOTSResult(details)
    render(<InsightPanelFCOTS fcots={fcots} {...defaultProps} />)

    expect(screen.getByText('On Time')).toBeDefined()
    expect(screen.getByText('Late')).toBeDefined()
  })

  it('sorts late cases first, then by delay descending', () => {
    const details = [
      makeDetail({ caseId: '1', isOnTime: true, delayMinutes: 0, surgeonName: 'Dr. A' }),
      makeDetail({ caseId: '2', isOnTime: false, delayMinutes: 10, surgeonName: 'Dr. B' }),
      makeDetail({ caseId: '3', isOnTime: false, delayMinutes: 25, surgeonName: 'Dr. C' }),
    ]
    const fcots = makeFCOTSResult(details)
    const { container } = render(<InsightPanelFCOTS fcots={fcots} {...defaultProps} />)

    // Get all surgeon name text nodes — late (biggest delay first) should come before on-time
    const surgeonCells = container.querySelectorAll('.truncate')
    const names = Array.from(surgeonCells).map(el => el.textContent)
    expect(names).toEqual(['Dr. C', 'Dr. B', 'Dr. A'])
  })
})

// ============================================
// UNIT: PATTERN DETECTION
// ============================================

describe('InsightPanelFCOTS — pattern detection', () => {
  it('detects surgeon with >50% late rate', () => {
    // Dr. Williams: 3/3 late (>50%)
    const details = [
      makeDetail({ caseId: '1', surgeonName: 'Dr. Williams', scheduledDate: '2024-02-03', isOnTime: false, delayMinutes: 18 }),
      makeDetail({ caseId: '2', surgeonName: 'Dr. Williams', scheduledDate: '2024-02-05', isOnTime: false, delayMinutes: 25 }),
      makeDetail({ caseId: '3', surgeonName: 'Dr. Williams', scheduledDate: '2024-02-07', isOnTime: false, delayMinutes: 32 }),
      makeDetail({ caseId: '4', surgeonName: 'Dr. Martinez', scheduledDate: '2024-02-03', isOnTime: true }),
      makeDetail({ caseId: '5', surgeonName: 'Dr. Martinez', scheduledDate: '2024-02-05', isOnTime: true }),
    ]
    const fcots = makeFCOTSResult(details)
    render(<InsightPanelFCOTS fcots={fcots} {...defaultProps} />)

    expect(screen.getByText('Pattern Detected')).toBeDefined()
    expect(screen.getByText(/Dr\. Williams was late for 3 of 3/)).toBeDefined()
  })

  it('detects room with >50% late rate', () => {
    // OR-2: 3/3 late
    const details = [
      makeDetail({ caseId: '1', roomName: 'OR-2', surgeonName: 'Dr. A', scheduledDate: '2024-02-03', isOnTime: false, delayMinutes: 15 }),
      makeDetail({ caseId: '2', roomName: 'OR-2', surgeonName: 'Dr. B', scheduledDate: '2024-02-05', isOnTime: false, delayMinutes: 20 }),
      makeDetail({ caseId: '3', roomName: 'OR-2', surgeonName: 'Dr. C', scheduledDate: '2024-02-07', isOnTime: false, delayMinutes: 10 }),
      makeDetail({ caseId: '4', roomName: 'OR-1', surgeonName: 'Dr. A', scheduledDate: '2024-02-03', isOnTime: true }),
      makeDetail({ caseId: '5', roomName: 'OR-1', surgeonName: 'Dr. B', scheduledDate: '2024-02-05', isOnTime: true }),
    ]
    const fcots = makeFCOTSResult(details)
    render(<InsightPanelFCOTS fcots={fcots} {...defaultProps} />)

    expect(screen.getByText(/OR-2 had the most delays/)).toBeDefined()
  })

  it('does not show pattern box when no patterns found', () => {
    // All on time — no patterns
    const details = [
      makeDetail({ caseId: '1', isOnTime: true }),
      makeDetail({ caseId: '2', isOnTime: true }),
    ]
    const fcots = makeFCOTSResult(details)
    render(<InsightPanelFCOTS fcots={fcots} {...defaultProps} />)

    expect(screen.queryByText('Pattern Detected')).toBeNull()
  })

  it('includes actionable recommendation when surgeon pattern found', () => {
    const details = [
      makeDetail({ caseId: '1', surgeonName: 'Dr. Williams', scheduledDate: '2024-02-03', isOnTime: false, delayMinutes: 18 }),
      makeDetail({ caseId: '2', surgeonName: 'Dr. Williams', scheduledDate: '2024-02-05', isOnTime: false, delayMinutes: 25 }),
    ]
    const fcots = makeFCOTSResult(details)
    render(<InsightPanelFCOTS fcots={fcots} {...defaultProps} />)

    expect(screen.getByText(/Consider scheduling Dr\. Williams/)).toBeDefined()
  })
})

// ============================================
// INTEGRATION: FCOTS OPENS WITH CORRECT DATA
// ============================================

describe('InsightPanelFCOTS — integration with slide-over', () => {
  it('renders within InsightSlideOver when drillThroughType is fcots', async () => {
    // This is tested in InsightSlideOver.test.tsx — verify the panel renders its content
    const details = [
      makeDetail({ caseId: '1', surgeonName: 'Dr. Martinez', isOnTime: true }),
      makeDetail({ caseId: '2', surgeonName: 'Dr. Williams', isOnTime: false, delayMinutes: 18, actualStart: '07:48' }),
    ]
    const fcots = makeFCOTSResult(details)
    render(<InsightPanelFCOTS fcots={fcots} {...defaultProps} />)

    // Verify actual data appears
    expect(screen.getByText('Dr. Martinez')).toBeDefined()
    expect(screen.getByText('07:48')).toBeDefined()
    expect(screen.getByText('+18m')).toBeDefined()
  })

  it('uses correct target percent for on-time rate color', () => {
    // 80% on-time against 85% target = below target (red)
    const details = [
      makeDetail({ caseId: '1', isOnTime: true }),
      makeDetail({ caseId: '2', isOnTime: true }),
      makeDetail({ caseId: '3', isOnTime: true }),
      makeDetail({ caseId: '4', isOnTime: true }),
      makeDetail({ caseId: '5', isOnTime: false, delayMinutes: 10 }),
    ]
    const fcots = makeFCOTSResult(details)
    const { container } = render(<InsightPanelFCOTS fcots={fcots} {...defaultProps} />)

    // 80% on-time — below 85% target, should have text-red-500 class
    const rateEl = screen.getByText('80%')
    expect(rateEl.className).toContain('text-red-500')
  })
})

// ============================================
// WORKFLOW: FULL SCENARIO
// ============================================

describe('InsightPanelFCOTS — workflow', () => {
  it('full scenario: summary + table + pattern for multi-surgeon late data', () => {
    // Simulate realistic data: 3 surgeons, mix of on-time and late
    const details = [
      // Dr. Martinez: 2/3 on time
      makeDetail({ caseId: '1', surgeonName: 'Dr. Martinez', roomName: 'OR-1', scheduledDate: '2024-02-03', isOnTime: true }),
      makeDetail({ caseId: '2', surgeonName: 'Dr. Martinez', roomName: 'OR-1', scheduledDate: '2024-02-05', isOnTime: true }),
      makeDetail({ caseId: '3', surgeonName: 'Dr. Martinez', roomName: 'OR-1', scheduledDate: '2024-02-07', isOnTime: false, delayMinutes: 8 }),
      // Dr. Williams: 0/3 on time — should trigger pattern
      makeDetail({ caseId: '4', surgeonName: 'Dr. Williams', roomName: 'OR-2', scheduledDate: '2024-02-03', isOnTime: false, delayMinutes: 18 }),
      makeDetail({ caseId: '5', surgeonName: 'Dr. Williams', roomName: 'OR-2', scheduledDate: '2024-02-05', isOnTime: false, delayMinutes: 25 }),
      makeDetail({ caseId: '6', surgeonName: 'Dr. Williams', roomName: 'OR-2', scheduledDate: '2024-02-07', isOnTime: false, delayMinutes: 32 }),
      // Dr. Chen: 1/2 on time
      makeDetail({ caseId: '7', surgeonName: 'Dr. Chen', roomName: 'OR-3', scheduledDate: '2024-02-03', isOnTime: true }),
      makeDetail({ caseId: '8', surgeonName: 'Dr. Chen', roomName: 'OR-3', scheduledDate: '2024-02-05', isOnTime: false, delayMinutes: 14 }),
    ]
    const fcots = makeFCOTSResult(details)
    render(<InsightPanelFCOTS fcots={fcots} {...defaultProps} />)

    // Summary: 3/8 on time = 38%, 5 late
    expect(screen.getByText('38%')).toBeDefined()

    // All surgeons visible (some appear multiple times in table)
    expect(screen.getAllByText('Dr. Martinez').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Dr. Williams').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Dr. Chen').length).toBeGreaterThanOrEqual(1)

    // Pattern: Dr. Williams is the worst offender
    expect(screen.getByText('Pattern Detected')).toBeDefined()
    expect(screen.getByText(/Dr\. Williams was late for 3 of 3/)).toBeDefined()

    // OR-2 had 3/3 late as well
    expect(screen.getByText(/OR-2 had the most delays \(3 of 3/)).toBeDefined()

    // Recommendation present
    expect(screen.getByText(/Consider scheduling Dr\. Williams/)).toBeDefined()
  })

  it('100% on-time shows all green with no pattern box', () => {
    const details = [
      makeDetail({ caseId: '1', isOnTime: true, delayMinutes: 0 }),
      makeDetail({ caseId: '2', isOnTime: true, delayMinutes: 1 }),
      makeDetail({ caseId: '3', isOnTime: true, delayMinutes: 2 }),
    ]
    const fcots = makeFCOTSResult(details)
    const { container } = render(<InsightPanelFCOTS fcots={fcots} {...defaultProps} />)

    // 100% on-time
    expect(screen.getByText('100%')).toBeDefined()
    // 0 late
    const summaryCards = container.querySelectorAll('.bg-slate-50\\/80')
    const lateCard = Array.from(summaryCards).find(el => el.textContent?.includes('Late Cases'))
    expect(lateCard?.textContent).toContain('0')
    // No pattern
    expect(screen.queryByText('Pattern Detected')).toBeNull()
    // Avg delay should be 0m (no late cases) — appears in summary and in table rows
    const zeroDelays = screen.getAllByText('0m')
    expect(zeroDelays.length).toBeGreaterThanOrEqual(1)
  })
})
