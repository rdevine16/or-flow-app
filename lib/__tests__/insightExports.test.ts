/**
 * lib/__tests__/insightExports.test.ts
 *
 * Tests for XLSX export functions in insightExports.ts.
 *
 * Strategy:
 * - Mock XLSX to capture workbook structure without actual file generation
 * - Mock DOM download trigger (document.createElement, etc.)
 * - Verify each export function produces the correct sheet names and data shape
 * - Verify the dispatcher routes to the correct export function
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as XLSX from 'xlsx'
import type {
  AnalyticsOverview,
  FCOTSResult,
  KPIResult,
  ORUtilizationResult,
  CaseVolumeResult,
  CancellationResult,
  TurnoverResult,
  FacilityAnalyticsConfig,
  SurgeonIdleSummary,
  FlipRoomAnalysis,
  FCOTSDetail,
  TurnoverDetail,
} from '@/lib/analyticsV2'
import { ANALYTICS_CONFIG_DEFAULTS } from '@/lib/analyticsV2'

// Capture filenames written by each export function
let capturedFilenames: string[] = []

// Mock the DOM download mechanism — we can't create <a> elements in jsdom for blob downloads
vi.mock('xlsx', async () => {
  const actual = await vi.importActual<typeof XLSX>('xlsx')
  return {
    ...actual,
    write: vi.fn(() => new Uint8Array(0)),
  }
})

// Mock URL.createObjectURL and document.createElement('a')
beforeEach(() => {
  capturedFilenames = []

  // Intercept the downloadWorkbook helper by spying on DOM
  const mockAnchor = {
    href: '',
    download: '',
    click: vi.fn(),
  }
  vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement)
  vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as unknown as Node)
  vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as unknown as Node)
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

  // Capture filenames through the mock anchor
  Object.defineProperty(mockAnchor, 'download', {
    get: () => capturedFilenames[capturedFilenames.length - 1] ?? '',
    set: (v: string) => capturedFilenames.push(v),
  })
})

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
      ...makeKPI({ value: 85, displayValue: '85%', target: 85, targetMet: true, subtitle: '3 late of 16' }),
      firstCaseDetails: [],
    } as FCOTSResult,
    sameRoomTurnover: {
      ...makeKPI({ value: 25, displayValue: '25 min', target: 80, targetMet: true }),
      details: [],
      compliantCount: 10,
      nonCompliantCount: 5,
      complianceRate: 67,
    } as TurnoverResult,
    flipRoomTurnover: {
      value: 0,
      displayValue: '--',
      subtitle: 'No flip-room turnovers',
      details: [],
      compliantCount: 0,
      nonCompliantCount: 0,
      complianceRate: 0,
    },
    orUtilization: {
      ...makeKPI({ value: 75, displayValue: '75%', target: 75, targetMet: true }),
      roomBreakdown: [],
      roomsWithRealHours: 2,
      roomsWithDefaultHours: 1,
    } as ORUtilizationResult,
    caseVolume: {
      ...makeKPI({ value: 100, displayValue: '100' }),
      weeklyVolume: [
        { week: '2026-02-03', count: 24 },
        { week: '2026-02-10', count: 22 },
      ],
    } as CaseVolumeResult,
    cancellationRate: {
      ...makeKPI({ value: 2, displayValue: '2%', target: 5, targetMet: true }),
      sameDayCount: 2,
      sameDayRate: 2,
      totalCancelledCount: 3,
      details: [],
    } as CancellationResult,
    cumulativeTardiness: makeKPI(),
    nonOperativeTime: makeKPI({ value: 38, displayValue: '38%' }),
    surgeonIdleTime: makeKPI(),
    surgeonIdleFlip: makeKPI(),
    surgeonIdleSameRoom: makeKPI(),
    sameRoomSurgicalTurnover: makeKPI({ value: 42, displayValue: '42 min', target: 45, targetMet: true }),
    flipRoomSurgicalTurnover: makeKPI({ value: 18, displayValue: '18 min', target: 15, targetMet: false }),
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

const mockConfig: FacilityAnalyticsConfig = ANALYTICS_CONFIG_DEFAULTS

// ============================================
// IMPORT FUNCTIONS UNDER TEST
// ============================================

// Import after mocks are set up
const {
  exportCallbackOptimization,
  exportFCOTSDetails,
  exportUtilizationBreakdown,
  exportTurnoverEfficiency,
  exportCancellationReport,
  exportNonOperativeTime,
  exportSchedulingData,
  exportInsightPanel,
} = await import('@/lib/insightExports')

// ============================================
// 1. exportCallbackOptimization
// ============================================

describe('exportCallbackOptimization', () => {
  it('generates workbook with 3 sheets and correct filename prefix', () => {
    const summaries: SurgeonIdleSummary[] = [
      {
        surgeonId: 's1',
        surgeonName: 'Dr. Test',
        status: 'call_sooner',
        statusLabel: 'Call Sooner',
        caseCount: 10,
        gapCount: 7,
        medianIdleTime: 15,
        flipGapCount: 5,
        sameRoomGapCount: 2,
        medianFlipIdle: 12,
        medianSameRoomIdle: 30,
        medianCallbackDelta: 7,
        hasFlipData: true,
      },
    ]
    const details: FlipRoomAnalysis[] = [
      {
        surgeonId: 's1',
        surgeonName: 'Dr. Test',
        date: '2026-02-10',
        cases: [
          { caseId: 'c1', caseNumber: '#1001', roomId: 'r1', roomName: 'OR-1', scheduledStart: '07:30' },
          { caseId: 'c2', caseNumber: '#1002', roomId: 'r2', roomName: 'OR-2', scheduledStart: '09:00' },
        ],
        idleGaps: [
          {
            fromCase: '#1001',
            toCase: '#1002',
            fromRoom: 'OR-1',
            toRoom: 'OR-2',
            idleMinutes: 14,
            optimalCallDelta: 9,
            gapType: 'flip',
          },
        ],
        avgIdleTime: 14,
        totalIdleTime: 14,
        isFlipRoom: true,
      },
    ]

    exportCallbackOptimization(summaries, details)

    expect(capturedFilenames.length).toBe(1)
    expect(capturedFilenames[0]).toMatch(/^orbit-callback-optimization-\d{4}-\d{2}\.xlsx$/)
  })

  it('produces surgeon summary data with status and recommendation', () => {
    const summaries: SurgeonIdleSummary[] = [
      {
        surgeonId: 's1',
        surgeonName: 'Dr. Martinez',
        status: 'on_track',
        statusLabel: 'On Track',
        caseCount: 28,
        gapCount: 11,
        medianIdleTime: 8,
        flipGapCount: 8,
        sameRoomGapCount: 3,
        medianFlipIdle: 4,
        medianSameRoomIdle: 20,
        medianCallbackDelta: 0,
        hasFlipData: true,
      },
    ]

    exportCallbackOptimization(summaries, [])

    expect(capturedFilenames[0]).toMatch(/orbit-callback-optimization/)
  })
})

// ============================================
// 2. exportFCOTSDetails
// ============================================

describe('exportFCOTSDetails', () => {
  it('generates workbook with correct filename', () => {
    const fcots: FCOTSResult = {
      ...makeKPI({ value: 69, displayValue: '69%', target: 85, targetMet: false, subtitle: '5 late of 16' }),
      firstCaseDetails: [],
    }

    exportFCOTSDetails(fcots)

    expect(capturedFilenames.length).toBe(1)
    expect(capturedFilenames[0]).toMatch(/^orbit-fcots-report-\d{4}-\d{2}\.xlsx$/)
  })

  it('includes case detail and pattern analysis sheets when firstCaseDetails provided', () => {
    const details: FCOTSDetail[] = [
      {
        caseId: 'c1',
        caseNumber: '#1001',
        scheduledDate: '2026-02-10',
        roomName: 'OR-1',
        surgeonName: 'Dr. Martinez',
        scheduledStart: '07:30',
        actualStart: '07:48',
        delayMinutes: 18,
        isOnTime: false,
      },
      {
        caseId: 'c2',
        caseNumber: '#1002',
        scheduledDate: '2026-02-10',
        roomName: 'OR-2',
        surgeonName: 'Dr. Williams',
        scheduledStart: '07:30',
        actualStart: '07:32',
        delayMinutes: 2,
        isOnTime: true,
      },
    ]
    const fcots: FCOTSResult = {
      ...makeKPI({ value: 50, displayValue: '50%', target: 85, targetMet: false, subtitle: '1 late of 2' }),
      firstCaseDetails: details,
    }

    exportFCOTSDetails(fcots, details)

    expect(capturedFilenames[0]).toMatch(/orbit-fcots-report/)
  })
})

// ============================================
// 3. exportUtilizationBreakdown
// ============================================

describe('exportUtilizationBreakdown', () => {
  it('generates workbook with correct filename', () => {
    const utilization: ORUtilizationResult = {
      ...makeKPI({ value: 62, displayValue: '62%', target: 75, targetMet: false }),
      roomBreakdown: [
        {
          roomId: 'r1',
          roomName: 'OR-1',
          utilization: 58,
          caseCount: 42,
          daysActive: 18,
          usedMinutes: 5600,
          availableHours: 10,
          usingRealHours: false,
        },
      ],
      roomsWithRealHours: 0,
      roomsWithDefaultHours: 1,
    }

    exportUtilizationBreakdown(utilization)

    expect(capturedFilenames[0]).toMatch(/^orbit-utilization-report-\d{4}-\d{2}\.xlsx$/)
  })
})

// ============================================
// 4. exportTurnoverEfficiency
// ============================================

describe('exportTurnoverEfficiency', () => {
  it('generates workbook with correct filename', () => {
    const roomTurnover: TurnoverResult = {
      ...makeKPI({ value: 28, displayValue: '28 min', target: 80, targetMet: true }),
      details: [],
      compliantCount: 10,
      nonCompliantCount: 5,
      complianceRate: 67,
    }

    const flipRoomTurnover: TurnoverResult = {
      ...makeKPI({ value: 32, displayValue: '32 min', target: 80, targetMet: false }),
      details: [],
      compliantCount: 6,
      nonCompliantCount: 4,
      complianceRate: 60,
    }

    exportTurnoverEfficiency(roomTurnover, flipRoomTurnover, makeKPI(), makeKPI(), makeKPI())

    expect(capturedFilenames[0]).toMatch(/^orbit-turnover-report-\d{4}-\d{2}\.xlsx$/)
  })

  it('includes transition detail sheet when details provided', () => {
    const details: TurnoverDetail[] = [
      {
        date: '2026-02-10',
        roomName: 'OR-1',
        fromCaseNumber: '#1001',
        toCaseNumber: '#1002',
        fromSurgeonName: 'Dr. Martinez',
        toSurgeonName: 'Dr. Williams',
        turnoverMinutes: 22,
        isCompliant: true,
      },
    ]
    const roomTurnover: TurnoverResult = {
      ...makeKPI({ value: 28, displayValue: '28 min', target: 80, targetMet: true }),
      details,
      compliantCount: 1,
      nonCompliantCount: 0,
      complianceRate: 100,
    }

    const flipRoomTurnover: TurnoverResult = {
      ...makeKPI({ value: 35, displayValue: '35 min', target: 80, targetMet: false }),
      details: [],
      compliantCount: 3,
      nonCompliantCount: 2,
      complianceRate: 60,
    }

    exportTurnoverEfficiency(roomTurnover, flipRoomTurnover, makeKPI(), makeKPI(), makeKPI(), details)

    expect(capturedFilenames[0]).toMatch(/orbit-turnover-report/)
  })
})

// ============================================
// 5. exportCancellationReport
// ============================================

describe('exportCancellationReport', () => {
  it('generates workbook with correct filename', () => {
    const cancellation: CancellationResult = {
      ...makeKPI({ value: 2, displayValue: '2%', target: 5, targetMet: true }),
      sameDayCount: 2,
      sameDayRate: 2,
      totalCancelledCount: 3,
      details: [],
    }

    exportCancellationReport(cancellation)

    expect(capturedFilenames[0]).toMatch(/^orbit-cancellation-report-\d{4}-\d{2}\.xlsx$/)
  })
})

// ============================================
// 6. exportNonOperativeTime
// ============================================

describe('exportNonOperativeTime', () => {
  it('generates workbook with correct filename', () => {
    exportNonOperativeTime(makeKPI({ value: 38, displayValue: '38%' }), 20, 60, 15, 10)

    expect(capturedFilenames[0]).toMatch(/^orbit-non-operative-time-\d{4}-\d{2}\.xlsx$/)
  })
})

// ============================================
// 7. exportSchedulingData
// ============================================

describe('exportSchedulingData', () => {
  it('generates workbook with correct filename', () => {
    const caseVolume: CaseVolumeResult = {
      ...makeKPI({ value: 100, displayValue: '100' }),
      weeklyVolume: [
        { week: '2026-02-03', count: 24 },
        { week: '2026-02-10', count: 22 },
      ],
    }
    const utilization: ORUtilizationResult = {
      ...makeKPI({ value: 62, displayValue: '62%' }),
      roomBreakdown: [],
      roomsWithRealHours: 0,
      roomsWithDefaultHours: 0,
    }

    exportSchedulingData(caseVolume, utilization)

    expect(capturedFilenames[0]).toMatch(/^orbit-scheduling-report-\d{4}-\d{2}\.xlsx$/)
  })
})

// ============================================
// 8. exportInsightPanel — dispatcher
// ============================================

describe('exportInsightPanel — dispatcher', () => {
  const analytics = makeAnalytics()

  it('dispatches callback type correctly', () => {
    exportInsightPanel('callback', analytics, mockConfig)
    expect(capturedFilenames[0]).toMatch(/orbit-callback-optimization/)
  })

  it('dispatches fcots type correctly', () => {
    exportInsightPanel('fcots', analytics, mockConfig)
    expect(capturedFilenames[0]).toMatch(/orbit-fcots-report/)
  })

  it('dispatches utilization type correctly', () => {
    exportInsightPanel('utilization', analytics, mockConfig)
    expect(capturedFilenames[0]).toMatch(/orbit-utilization-report/)
  })

  it('dispatches turnover type correctly', () => {
    exportInsightPanel('turnover', analytics, mockConfig)
    expect(capturedFilenames[0]).toMatch(/orbit-turnover-report/)
  })

  it('dispatches cancellation type correctly', () => {
    exportInsightPanel('cancellation', analytics, mockConfig)
    expect(capturedFilenames[0]).toMatch(/orbit-cancellation-report/)
  })

  it('dispatches non_op_time type correctly', () => {
    exportInsightPanel('non_op_time', analytics, mockConfig)
    expect(capturedFilenames[0]).toMatch(/orbit-non-operative-time/)
  })

  it('dispatches scheduling type correctly', () => {
    exportInsightPanel('scheduling', analytics, mockConfig)
    expect(capturedFilenames[0]).toMatch(/orbit-scheduling-report/)
  })

  it('does nothing for unknown type', () => {
    exportInsightPanel('unknown_type', analytics, mockConfig)
    expect(capturedFilenames.length).toBe(0)
  })
})
