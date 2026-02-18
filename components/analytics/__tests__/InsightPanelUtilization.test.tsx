/**
 * components/analytics/__tests__/InsightPanelUtilization.test.tsx
 *
 * Tests for the utilization drill-through panel (Phase 4).
 *
 * 1. Unit: Room cards render with correct utilization %, bars, and target lines; rooms sorted lowest-first
 * 2. Integration: Both insight click and KPI card click open the same utilization panel
 * 3. Workflow: Rooms using default hours are flagged; empty state handled
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import InsightPanelUtilization from '../InsightPanelUtilization'
import InsightSlideOver from '../InsightSlideOver'
import type {
  ORUtilizationResult,
  RoomUtilizationDetail,
  FacilityAnalyticsConfig,
  AnalyticsOverview,
  FCOTSResult,
  KPIResult,
  CaseVolumeResult,
  CancellationResult,
} from '@/lib/analyticsV2'
import { ANALYTICS_CONFIG_DEFAULTS } from '@/lib/analyticsV2'
import type { Insight } from '@/lib/insightsEngine'

// ============================================
// HELPERS
// ============================================

function makeRoom(overrides: Partial<RoomUtilizationDetail> = {}): RoomUtilizationDetail {
  return {
    roomId: 'room-1',
    roomName: 'OR-1',
    utilization: 65,
    usedMinutes: 3900,
    availableHours: 10,
    caseCount: 42,
    daysActive: 18,
    usingRealHours: true,
    ...overrides,
  }
}

function makeORUtilResult(rooms: RoomUtilizationDetail[]): ORUtilizationResult {
  return {
    value: rooms.length > 0 ? Math.round(rooms.reduce((s, r) => s + r.utilization, 0) / rooms.length) : 0,
    displayValue: rooms.length > 0 ? `${Math.round(rooms.reduce((s, r) => s + r.utilization, 0) / rooms.length)}%` : '0%',
    subtitle: `${rooms.length} rooms`,
    target: 75,
    targetMet: false,
    dailyData: [],
    roomBreakdown: rooms,
    roomsWithRealHours: rooms.filter(r => r.usingRealHours).length,
    roomsWithDefaultHours: rooms.filter(r => !r.usingRealHours).length,
  }
}

const defaultConfig: FacilityAnalyticsConfig = {
  ...ANALYTICS_CONFIG_DEFAULTS,
  utilizationTargetPercent: 75,
}

// ============================================
// UNIT: EMPTY STATE
// ============================================

describe('InsightPanelUtilization — empty state', () => {
  it('renders empty state when no rooms', () => {
    const result = makeORUtilResult([])
    render(<InsightPanelUtilization orUtilization={result} config={defaultConfig} />)
    expect(screen.getByText('No utilization data')).toBeDefined()
    expect(screen.getByText('No rooms with case data found in this period.')).toBeDefined()
  })
})

// ============================================
// UNIT: ROOM STATUS SUMMARY
// ============================================

describe('InsightPanelUtilization — room status summary', () => {
  it('correctly buckets rooms into above/near/below target', () => {
    const rooms = [
      makeRoom({ roomId: 'r1', roomName: 'OR-1', utilization: 80, usingRealHours: true }),  // above 75
      makeRoom({ roomId: 'r2', roomName: 'OR-2', utilization: 62, usingRealHours: true }),  // near (>= 60, < 75)
      makeRoom({ roomId: 'r3', roomName: 'OR-3', utilization: 55, usingRealHours: false }), // below 60
      makeRoom({ roomId: 'r4', roomName: 'OR-4', utilization: 44, usingRealHours: false }), // below 60
    ]
    const result = makeORUtilResult(rooms)
    render(<InsightPanelUtilization orUtilization={result} config={defaultConfig} />)

    // Above: 1, Near: 1, Below: 2
    const summaryCards = screen.getAllByText('Above Target')
    expect(summaryCards.length).toBe(1)

    // The "1" above target
    const container = summaryCards[0].closest('div')!.parentElement!
    expect(container.textContent).toContain('1')
  })

  it('shows correct "Below X%" label based on target', () => {
    const rooms = [makeRoom({ roomId: 'r1', utilization: 50 })]
    const result = makeORUtilResult(rooms)
    render(<InsightPanelUtilization orUtilization={result} config={defaultConfig} />)

    // 75 * 0.8 = 60
    expect(screen.getByText('Below 60%')).toBeDefined()
  })
})

// ============================================
// UNIT: ROOM CARDS SORTED LOWEST-FIRST
// ============================================

describe('InsightPanelUtilization — room card sorting', () => {
  it('sorts rooms by utilization ascending (lowest first)', () => {
    const rooms = [
      makeRoom({ roomId: 'r1', roomName: 'OR-1', utilization: 80 }),
      makeRoom({ roomId: 'r2', roomName: 'OR-2', utilization: 44 }),
      makeRoom({ roomId: 'r3', roomName: 'OR-3', utilization: 62 }),
    ]
    const result = makeORUtilResult(rooms)
    const { container } = render(<InsightPanelUtilization orUtilization={result} config={defaultConfig} />)

    // Find all room name elements
    const roomNames = container.querySelectorAll('.font-semibold.text-slate-900')
    const names = Array.from(roomNames).map(el => el.textContent)
    expect(names).toEqual(['OR-2', 'OR-3', 'OR-1'])
  })
})

// ============================================
// UNIT: ROOM CARDS CONTENT
// ============================================

describe('InsightPanelUtilization — room card details', () => {
  it('renders utilization percentage', () => {
    const rooms = [makeRoom({ roomId: 'r1', roomName: 'OR-1', utilization: 58 })]
    const result = makeORUtilResult(rooms)
    render(<InsightPanelUtilization orUtilization={result} config={defaultConfig} />)

    expect(screen.getByText('58%')).toBeDefined()
  })

  it('renders case count and days active', () => {
    const rooms = [makeRoom({ roomId: 'r1', caseCount: 42, daysActive: 18 })]
    const result = makeORUtilResult(rooms)
    render(<InsightPanelUtilization orUtilization={result} config={defaultConfig} />)

    expect(screen.getByText('42 cases')).toBeDefined()
    expect(screen.getByText('18 days active')).toBeDefined()
  })

  it('renders average hours per day', () => {
    // 3600 usedMinutes / 18 daysActive / 60 = 3.3h/day
    const rooms = [makeRoom({ roomId: 'r1', usedMinutes: 3600, daysActive: 18, availableHours: 10 })]
    const result = makeORUtilResult(rooms)
    render(<InsightPanelUtilization orUtilization={result} config={defaultConfig} />)

    expect(screen.getByText(/~3.3h avg\/day of 10h/)).toBeDefined()
  })

  it('flags rooms using default hours', () => {
    const rooms = [makeRoom({ roomId: 'r1', usingRealHours: false })]
    const result = makeORUtilResult(rooms)
    render(<InsightPanelUtilization orUtilization={result} config={defaultConfig} />)

    expect(screen.getByText('Default hours')).toBeDefined()
  })

  it('does not flag rooms with real hours', () => {
    const rooms = [makeRoom({ roomId: 'r1', usingRealHours: true })]
    const result = makeORUtilResult(rooms)
    render(<InsightPanelUtilization orUtilization={result} config={defaultConfig} />)

    expect(screen.queryByText('Default hours')).toBeNull()
  })
})

// ============================================
// UNIT: ROOM HOURS INFO STRING
// ============================================

describe('InsightPanelUtilization — room hours info', () => {
  it('shows mixed message when some rooms have real hours', () => {
    const rooms = [
      makeRoom({ roomId: 'r1', usingRealHours: true }),
      makeRoom({ roomId: 'r2', usingRealHours: false }),
    ]
    const result = makeORUtilResult(rooms)
    render(<InsightPanelUtilization orUtilization={result} config={defaultConfig} />)

    expect(screen.getByText(/1 room configured/)).toBeDefined()
    expect(screen.getByText(/1 using default/)).toBeDefined()
  })

  it('shows all-default message when no rooms have real hours', () => {
    const rooms = [
      makeRoom({ roomId: 'r1', usingRealHours: false }),
      makeRoom({ roomId: 'r2', usingRealHours: false }),
    ]
    const result = makeORUtilResult(rooms)
    render(<InsightPanelUtilization orUtilization={result} config={defaultConfig} />)

    expect(screen.getByText(/All rooms using default 10h/)).toBeDefined()
  })

  it('shows all-configured message when all rooms have real hours', () => {
    const rooms = [
      makeRoom({ roomId: 'r1', usingRealHours: true }),
      makeRoom({ roomId: 'r2', usingRealHours: true }),
    ]
    const result = makeORUtilResult(rooms)
    render(<InsightPanelUtilization orUtilization={result} config={defaultConfig} />)

    expect(screen.getByText(/All 2 rooms have configured hours/)).toBeDefined()
  })
})

// ============================================
// INTEGRATION: INSIDE SLIDE-OVER
// ============================================

describe('InsightPanelUtilization — integration with InsightSlideOver', () => {
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
    turnoverTime: { ...makeKPI(), details: [], compliantCount: 0, nonCompliantCount: 0, complianceRate: 0 },
    flipRoomTurnover: {
      value: 0,
      displayValue: '--',
      subtitle: 'No flip-room turnovers',
      details: [],
      compliantCount: 0,
      nonCompliantCount: 0,
      complianceRate: 0,
    },
    orUtilization: makeORUtilResult([
      makeRoom({ roomId: 'r1', roomName: 'OR-1', utilization: 58, caseCount: 42, daysActive: 18 }),
      makeRoom({ roomId: 'r2', roomName: 'OR-2', utilization: 44, usingRealHours: false, caseCount: 35, daysActive: 17 }),
    ]),
    caseVolume: {
      ...makeKPI({ value: 100, displayValue: '100' }),
      weeklyVolume: [],
    } as CaseVolumeResult,
    cancellationRate: {
      ...makeKPI({ value: 0, displayValue: '0%', target: 5, targetMet: true }),
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
  }

  it('renders utilization panel content (not placeholder) when drillThroughType is utilization', () => {
    const insight: Insight = {
      id: 'util-1',
      category: 'utilization_gap',
      severity: 'warning',
      title: 'Low Utilization',
      body: 'Utilization is below target.',
      action: 'Review rooms',
      drillThroughType: 'utilization',
      metadata: {},
    }
    render(
      <InsightSlideOver
        insight={insight}
        onClose={() => {}}
        analytics={mockAnalytics}
        config={defaultConfig}
      />
    )

    // Should show actual room data, not placeholder
    expect(screen.queryByText(/panel content coming in/i)).toBeNull()
    expect(screen.getByText('OR-1')).toBeDefined()
    expect(screen.getByText('OR-2')).toBeDefined()
    expect(screen.getByText('58%')).toBeDefined()
    expect(screen.getByText('44%')).toBeDefined()
  })

  it('renders utilization panel with KPI-click synthetic insight', () => {
    // Simulates the synthetic insight created by handleUtilizationClick
    const insight: Insight = {
      id: 'utilization-kpi-click',
      category: 'utilization_gap',
      severity: 'warning',
      title: 'OR Utilization by Room',
      body: 'Overall utilization is 51%.',
      action: 'Review room breakdown',
      drillThroughType: 'utilization',
      metadata: {},
    }
    render(
      <InsightSlideOver
        insight={insight}
        onClose={() => {}}
        analytics={mockAnalytics}
        config={defaultConfig}
      />
    )

    // Panel title from PANEL_TITLES map
    expect(screen.getAllByText('OR Utilization by Room').length).toBeGreaterThanOrEqual(1)
    // Room data renders
    expect(screen.getByText('42 cases')).toBeDefined()
    expect(screen.getByText('35 cases')).toBeDefined()
  })
})

// ============================================
// WORKFLOW: FULL SCENARIO
// ============================================

describe('InsightPanelUtilization — workflow', () => {
  it('full scenario: summary + sorted rooms + default hours flag', () => {
    const rooms = [
      makeRoom({ roomId: 'r1', roomName: 'OR-1', utilization: 80, usingRealHours: true, caseCount: 50, daysActive: 20 }),
      makeRoom({ roomId: 'r2', roomName: 'OR-2', utilization: 62, usingRealHours: true, caseCount: 38, daysActive: 19 }),
      makeRoom({ roomId: 'r3', roomName: 'OR-3', utilization: 44, usingRealHours: false, caseCount: 25, daysActive: 15 }),
    ]
    const result = makeORUtilResult(rooms)
    const { container } = render(
      <InsightPanelUtilization orUtilization={result} config={defaultConfig} />
    )

    // Summary: 1 above (80%), 1 near (62%), 1 below (44%)
    expect(screen.getByText('Above Target')).toBeDefined()
    expect(screen.getByText('Near Target')).toBeDefined()
    expect(screen.getByText('Below 60%')).toBeDefined()

    // Rooms sorted lowest first: OR-3, OR-2, OR-1
    const roomNames = container.querySelectorAll('.font-semibold.text-slate-900')
    const names = Array.from(roomNames).map(el => el.textContent)
    expect(names).toEqual(['OR-3', 'OR-2', 'OR-1'])

    // OR-3 flagged with default hours
    expect(screen.getByText('Default hours')).toBeDefined()

    // Stats visible for each room
    expect(screen.getByText('50 cases')).toBeDefined()
    expect(screen.getByText('38 cases')).toBeDefined()
    expect(screen.getByText('25 cases')).toBeDefined()
  })
})
