/**
 * Phase 4 tests: KPI page redesign — action items, insights integration,
 * sparkline data extraction, helper functions, and data flow.
 */
import { describe, it, expect } from 'vitest'
import {
  getKPIStatus,
  AnalyticsOverview,
  KPIResult,
  FCOTSResult,
  CaseVolumeResult,
  CancellationResult,
  ORUtilizationResult,
  SurgeonIdleSummary,
  ANALYTICS_CONFIG_DEFAULTS,
} from '@/lib/analyticsV2'
import { dailyDataToSparkline } from '@/components/ui/Sparkline'
import { generateInsights } from '@/lib/insightsEngine'

// ============================================
// HELPERS — Minimal analytics mock
// ============================================

function makeKPIResult(overrides: Partial<KPIResult> = {}): KPIResult {
  return {
    value: 0,
    displayValue: '0',
    subtitle: '',
    ...overrides,
  }
}

function makeSurgeonSummary(overrides: Partial<SurgeonIdleSummary> = {}): SurgeonIdleSummary {
  return {
    surgeonId: 'surg-1',
    surgeonName: 'Dr. Test',
    caseCount: 10,
    gapCount: 0,
    medianIdleTime: 0,
    hasFlipData: false,
    flipGapCount: 0,
    sameRoomGapCount: 0,
    medianFlipIdle: 0,
    medianSameRoomIdle: 0,
    medianCallbackDelta: 0,
    status: 'on_track',
    statusLabel: 'On Track',
    ...overrides,
  }
}

function makeAnalytics(overrides: Partial<AnalyticsOverview> = {}): AnalyticsOverview {
  return {
    totalCases: 100,
    completedCases: 80,
    cancelledCases: 0,
    fcots: {
      ...makeKPIResult({ value: 85, displayValue: '85%', target: 85, targetMet: true }),
      firstCaseDetails: [],
    } as FCOTSResult,
    sameRoomTurnover: { ...makeKPIResult({ value: 25, displayValue: '25 min', target: 30, targetMet: true }), details: [], compliantCount: 0, nonCompliantCount: 0, complianceRate: 0 },
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
      ...makeKPIResult({ value: 75, displayValue: '75%', target: 75, targetMet: true }),
      roomBreakdown: [],
      roomsWithRealHours: 0,
      roomsWithDefaultHours: 0,
    } as ORUtilizationResult,
    caseVolume: {
      ...makeKPIResult({ value: 100, displayValue: '100' }),
      weeklyVolume: [],
    } as CaseVolumeResult,
    cancellationRate: {
      ...makeKPIResult({ value: 0, displayValue: '0%', target: 5, targetMet: true }),
      sameDayCount: 0,
      sameDayRate: 0,
      totalCancelledCount: 0,
      details: [],
    } as CancellationResult,
    cumulativeTardiness: makeKPIResult(),
    nonOperativeTime: makeKPIResult({ value: 20, displayValue: '20 min' }),
    surgeonIdleTime: makeKPIResult({ value: 10, displayValue: '10 min' }),
    surgeonIdleFlip: makeKPIResult({ value: 5, displayValue: '5 min' }),
    surgeonIdleSameRoom: makeKPIResult({ value: 15, displayValue: '15 min' }),
    sameRoomSurgicalTurnover: makeKPIResult({ value: 40, displayValue: '40 min', target: 45, targetMet: true }),
    flipRoomSurgicalTurnover: makeKPIResult({ value: 12, displayValue: '12 min', target: 15, targetMet: true }),
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
// toSignedDelta (helper from page)
// ============================================

// Replicate the page helper to test independently
function toSignedDelta(kpi: KPIResult): number {
  if (!kpi.delta || !kpi.deltaType || kpi.deltaType === 'unchanged') return 0
  return kpi.deltaType === 'decrease' ? -kpi.delta : kpi.delta
}

describe('toSignedDelta', () => {
  it('returns 0 for unchanged', () => {
    expect(toSignedDelta(makeKPIResult({ delta: 5, deltaType: 'unchanged' }))).toBe(0)
  })

  it('returns 0 when delta is undefined', () => {
    expect(toSignedDelta(makeKPIResult())).toBe(0)
  })

  it('returns positive for increase', () => {
    expect(toSignedDelta(makeKPIResult({ delta: 15, deltaType: 'increase' }))).toBe(15)
  })

  it('returns negative for decrease', () => {
    expect(toSignedDelta(makeKPIResult({ delta: 33, deltaType: 'decrease' }))).toBe(-33)
  })
})

// ============================================
// Action Items Logic
// ============================================

// Replicate the action items logic from the page
function computeActionItems(analytics: AnalyticsOverview): Array<{ text: string; status: 'good' | 'warn' | 'bad' }> {
  const items: Array<{ text: string; status: 'good' | 'warn' | 'bad' }> = []
  if (!analytics.fcots.targetMet) {
    items.push({ text: `First case on-time at ${analytics.fcots.displayValue}`, status: 'bad' })
  }
  if (!analytics.orUtilization.targetMet) {
    items.push({ text: `OR utilization at ${analytics.orUtilization.displayValue}`, status: 'bad' })
  }
  const callSoonerCount = analytics.surgeonIdleSummaries.filter(s => s.status === 'call_sooner').length
  if (callSoonerCount > 0) {
    items.push({ text: `${callSoonerCount} surgeon${callSoonerCount > 1 ? 's' : ''} need earlier callbacks`, status: 'warn' })
  }
  if (analytics.cancellationRate.sameDayCount === 0) {
    items.push({ text: 'Zero same-day cancellations', status: 'good' })
  }
  return items
}

describe('Action Items', () => {
  it('returns empty array when all metrics on target and cancellations exist', () => {
    const analytics = makeAnalytics({
      cancellationRate: {
        ...makeKPIResult({ value: 2, displayValue: '2%', target: 5, targetMet: true }),
        sameDayCount: 1,
        sameDayRate: 2,
        totalCancelledCount: 1,
        details: [],
      } as CancellationResult,
    })
    const items = computeActionItems(analytics)
    expect(items).toHaveLength(0)
  })

  it('includes FCOTS when target not met', () => {
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPIResult({ value: 31, displayValue: '31%', target: 85, targetMet: false }),
        firstCaseDetails: [],
      } as FCOTSResult,
    })
    const items = computeActionItems(analytics)
    expect(items).toContainEqual({ text: 'First case on-time at 31%', status: 'bad' })
  })

  it('includes OR utilization when target not met', () => {
    const analytics = makeAnalytics({
      orUtilization: {
        ...makeKPIResult({ value: 42, displayValue: '42%', target: 75, targetMet: false }),
        roomBreakdown: [],
        roomsWithRealHours: 0,
        roomsWithDefaultHours: 0,
      } as ORUtilizationResult,
    })
    const items = computeActionItems(analytics)
    expect(items).toContainEqual({ text: 'OR utilization at 42%', status: 'bad' })
  })

  it('includes callback optimization when surgeons need earlier callbacks', () => {
    const analytics = makeAnalytics({
      surgeonIdleSummaries: [
        makeSurgeonSummary({ status: 'call_sooner', hasFlipData: true }),
        makeSurgeonSummary({ surgeonId: 'surg-2', status: 'call_sooner', hasFlipData: true }),
      ],
    })
    const items = computeActionItems(analytics)
    expect(items).toContainEqual({ text: '2 surgeons need earlier callbacks', status: 'warn' })
  })

  it('includes singular form for 1 surgeon', () => {
    const analytics = makeAnalytics({
      surgeonIdleSummaries: [
        makeSurgeonSummary({ status: 'call_sooner', hasFlipData: true }),
      ],
    })
    const items = computeActionItems(analytics)
    expect(items).toContainEqual({ text: '1 surgeon need earlier callbacks', status: 'warn' })
  })

  it('includes zero cancellation streak', () => {
    const items = computeActionItems(makeAnalytics())
    expect(items).toContainEqual({ text: 'Zero same-day cancellations', status: 'good' })
  })

  it('generates all items for worst-case scenario', () => {
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPIResult({ value: 31, displayValue: '31%', target: 85, targetMet: false }),
        firstCaseDetails: [],
      } as FCOTSResult,
      orUtilization: {
        ...makeKPIResult({ value: 42, displayValue: '42%', target: 75, targetMet: false }),
        roomBreakdown: [],
        roomsWithRealHours: 0,
        roomsWithDefaultHours: 0,
      } as ORUtilizationResult,
      surgeonIdleSummaries: [
        makeSurgeonSummary({ status: 'call_sooner', hasFlipData: true }),
      ],
    })
    const items = computeActionItems(analytics)
    expect(items).toHaveLength(4) // FCOTS + utilization + callback + zero cancellations
    expect(items[0].status).toBe('bad')
    expect(items[1].status).toBe('bad')
    expect(items[2].status).toBe('warn')
    expect(items[3].status).toBe('good')
  })
})

// ============================================
// Health Status Computation
// ============================================

describe('Health Status', () => {
  it('computes correct statuses for all-good scenario', () => {
    const analytics = makeAnalytics()
    expect(getKPIStatus(analytics.fcots.value, analytics.fcots.target ?? 85)).toBe('good')
    expect(getKPIStatus(analytics.orUtilization.value, analytics.orUtilization.target ?? 75)).toBe('good')
    expect(getKPIStatus(analytics.cancellationRate.value, analytics.cancellationRate.target ?? 5, true)).toBe('good')
  })

  it('computes bad for FCOTS well below target', () => {
    expect(getKPIStatus(31, 85)).toBe('bad')
  })

  it('computes warn for FCOTS near target', () => {
    expect(getKPIStatus(65, 85)).toBe('warn') // 65/85 ≈ 0.76
  })

  it('computes good for 0% cancellation rate (inverse)', () => {
    expect(getKPIStatus(0, 5, true)).toBe('good')
  })

  it('computes bad for high cancellation rate (inverse)', () => {
    expect(getKPIStatus(15, 5, true)).toBe('bad') // 5/15 ≈ 0.33
  })
})

// ============================================
// Sparkline Data Extraction
// ============================================

describe('Sparkline Data Extraction', () => {
  it('extracts numeric values from dailyData', () => {
    const dailyData = [
      { date: '2025-02-01', color: 'green' as const, tooltip: '', numericValue: 85 },
      { date: '2025-02-02', color: 'red' as const, tooltip: '', numericValue: 31 },
      { date: '2025-02-03', color: 'green' as const, tooltip: '', numericValue: 90 },
    ]
    const sparkline = dailyDataToSparkline(dailyData)
    expect(sparkline).toEqual([85, 31, 90])
  })

  it('returns empty array for undefined dailyData', () => {
    expect(dailyDataToSparkline(undefined)).toEqual([])
  })

  it('returns empty array for empty dailyData', () => {
    expect(dailyDataToSparkline([])).toEqual([])
  })

  it('extracts weekly volume for case volume sparkline', () => {
    const caseVolume: CaseVolumeResult = {
      ...makeKPIResult({ value: 127, displayValue: '127' }),
      weeklyVolume: [
        { week: '2025-W05', count: 28 },
        { week: '2025-W06', count: 32 },
        { week: '2025-W07', count: 35 },
        { week: '2025-W08', count: 32 },
      ],
    }
    const sparkline = caseVolume.weeklyVolume.map(w => w.count)
    expect(sparkline).toEqual([28, 32, 35, 32])
    expect(sparkline).toHaveLength(4)
  })
})

// ============================================
// Insights Integration
// ============================================

describe('Insights Integration', () => {
  it('generates insights for analytics with issues', () => {
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPIResult({
          value: 31,
          displayValue: '31%',
          target: 85,
          targetMet: false,
          subtitle: '11 late of 16 first cases (wheels-in, 2 min grace)',
          delta: 33,
          deltaType: 'decrease',
        }),
        firstCaseDetails: [],
      } as FCOTSResult,
    })
    const insights = generateInsights(analytics)
    expect(insights.length).toBeGreaterThan(0)
    // FCOTS below 50% should generate critical insight
    const fcotsInsight = insights.find(i => i.category === 'first_case_delays')
    expect(fcotsInsight).toBeDefined()
    expect(fcotsInsight?.severity).toBe('critical')
  })

  it('returns empty array for healthy analytics', () => {
    const analytics = makeAnalytics()
    const insights = generateInsights(analytics)
    // With all metrics on target and no data to analyze patterns, should be minimal
    // Some positive insights might still generate (e.g., FCOTS on target)
    const criticalOrWarning = insights.filter(i => i.severity === 'critical' || i.severity === 'warning')
    expect(criticalOrWarning).toHaveLength(0)
  })

  it('respects maxInsights config', () => {
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPIResult({ value: 31, displayValue: '31%', target: 85, targetMet: false, subtitle: '11 late of 16 first cases' }),
        firstCaseDetails: [],
      } as FCOTSResult,
      orUtilization: {
        ...makeKPIResult({ value: 42, displayValue: '42%', target: 75, targetMet: false }),
        roomBreakdown: [{ roomId: 'r1', roomName: 'OR-1', utilization: 42, usedMinutes: 1000, availableHours: 10, caseCount: 20, daysActive: 10, usingRealHours: false }],
        roomsWithRealHours: 0,
        roomsWithDefaultHours: 1,
      } as ORUtilizationResult,
    })
    const insights = generateInsights(analytics, { maxInsights: 2 })
    expect(insights.length).toBeLessThanOrEqual(2)
  })

  it('sorts insights by severity: critical first', () => {
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPIResult({ value: 31, displayValue: '31%', target: 85, targetMet: false, subtitle: '11 late of 16 first cases' }),
        firstCaseDetails: [],
      } as FCOTSResult,
      cancellationRate: {
        ...makeKPIResult({ value: 0, displayValue: '0%', target: 5, targetMet: true, dailyData: Array.from({ length: 22 }, (_, i) => ({ date: `2025-02-${String(i + 1).padStart(2, '0')}`, color: 'green' as const, tooltip: '', numericValue: 0 })) }),
        sameDayCount: 0,
        sameDayRate: 0,
        totalCancelledCount: 0,
        details: [],
      } as CancellationResult,
    })
    const insights = generateInsights(analytics)
    if (insights.length >= 2) {
      const severityOrder = { critical: 0, warning: 1, positive: 2, info: 3 }
      for (let i = 1; i < insights.length; i++) {
        expect(severityOrder[insights[i].severity]).toBeGreaterThanOrEqual(severityOrder[insights[i - 1].severity])
      }
    }
  })
})

// ============================================
// KPI Card Data Composition
// ============================================

describe('KPI Card Data', () => {
  it('computes correct status for each KPI', () => {
    // FCOTS below target
    expect(getKPIStatus(31, 85)).toBe('bad')
    // OR utilization below target
    expect(getKPIStatus(42, 75)).toBe('bad')
    // Cancellation at 0 with target 5 (inverse)
    expect(getKPIStatus(0, 5, true)).toBe('good')
  })

  it('turnover statuses use inverse (lower is better)', () => {
    // 40 min vs 30 min target (above target; inverse ratio 30/40 = 0.75 → warn)
    expect(getKPIStatus(40, 30, true)).toBe('warn')
    // 25 min vs 30 min target (below target = good for inverse)
    expect(getKPIStatus(25, 30, true)).toBe('good')
    // 12 min vs 15 min target (below target = good)
    expect(getKPIStatus(12, 15, true)).toBe('good')
  })

  it('handles edge case where target is 0', () => {
    // Should not throw, returns based on ratio
    const status = getKPIStatus(50, 0)
    expect(['good', 'warn', 'bad']).toContain(status)
  })
})

// ============================================
// Surgeon Split Logic
// ============================================

describe('Surgeon Split Logic', () => {
  it('splits surgeons into flip and same-room-only correctly', () => {
    const summaries: SurgeonIdleSummary[] = [
      makeSurgeonSummary({ surgeonId: '1', hasFlipData: true, status: 'on_track' }),
      makeSurgeonSummary({ surgeonId: '2', hasFlipData: false, status: 'turnover_only' }),
      makeSurgeonSummary({ surgeonId: '3', hasFlipData: true, status: 'call_sooner' }),
    ]

    const flipSurgeons = summaries.filter(s => s.hasFlipData)
    const sameRoomOnly = summaries.filter(s => !s.hasFlipData)

    expect(flipSurgeons).toHaveLength(2)
    expect(sameRoomOnly).toHaveLength(1)
    expect(flipSurgeons[0].surgeonId).toBe('1')
    expect(flipSurgeons[1].surgeonId).toBe('3')
    expect(sameRoomOnly[0].surgeonId).toBe('2')
  })

  it('handles empty surgeon list', () => {
    const summaries: SurgeonIdleSummary[] = []
    expect(summaries.filter(s => s.hasFlipData)).toHaveLength(0)
    expect(summaries.filter(s => !s.hasFlipData)).toHaveLength(0)
  })
})

// ============================================
// Non-Operative Time Status Heuristic
// ============================================

describe('Non-Operative Time Status (config-driven)', () => {
  const cfg = ANALYTICS_CONFIG_DEFAULTS

  it('returns good for value <= nonOpWarnMinutes', () => {
    const value = 18
    const status = value > cfg.nonOpBadMinutes ? 'bad' : value > cfg.nonOpWarnMinutes ? 'warn' : 'good'
    expect(status).toBe('good')
  })

  it('returns warn for value between nonOpWarnMinutes and nonOpBadMinutes', () => {
    const value = 27
    const status = value > cfg.nonOpBadMinutes ? 'bad' : value > cfg.nonOpWarnMinutes ? 'warn' : 'good'
    expect(status).toBe('warn')
  })

  it('returns bad for value > nonOpBadMinutes', () => {
    const value = 35
    const status = value > cfg.nonOpBadMinutes ? 'bad' : value > cfg.nonOpWarnMinutes ? 'warn' : 'good'
    expect(status).toBe('bad')
  })

  it('uses custom config thresholds correctly', () => {
    // Custom config with wider warning range
    const customCfg = { nonOpWarnMinutes: 15, nonOpBadMinutes: 25 }
    const value = 20
    const status = value > customCfg.nonOpBadMinutes ? 'bad' : value > customCfg.nonOpWarnMinutes ? 'warn' : 'good'
    expect(status).toBe('warn') // 20 > 15 warn threshold
  })
})

// ============================================
// Phase 3: Config-Driven Targets
// ============================================

describe('Config-driven KPI target fallbacks', () => {
  const cfg = ANALYTICS_CONFIG_DEFAULTS

  it('KPI status uses config.fcotsTargetPercent as fallback', () => {
    // When analytics.fcots.target is undefined, the page falls back to config
    const value = 80
    const status = getKPIStatus(value, cfg.fcotsTargetPercent)
    expect(status).toBe('warn') // 80/85 ≈ 0.94 → within 0.8-1.0 range
  })

  it('KPI status uses config.utilizationTargetPercent as fallback', () => {
    const value = 75
    const status = getKPIStatus(value, cfg.utilizationTargetPercent)
    expect(status).toBe('good') // 75/75 = 1.0 → good
  })

  it('KPI status uses config.cancellationTargetPercent as fallback (inverse)', () => {
    const value = 3
    const status = getKPIStatus(value, cfg.cancellationTargetPercent, true)
    expect(status).toBe('good') // 5/3 = 1.67 → good (inverse)
  })

  it('turnover status uses config.turnoverThresholdMinutes as fallback', () => {
    const value = 25
    const status = getKPIStatus(value, cfg.turnoverThresholdMinutes, true)
    expect(status).toBe('good') // 30/25 = 1.2 → good (inverse: below target)
  })

  it('turnover status uses config.sameRoomTurnoverTarget as fallback', () => {
    const value = 50
    const status = getKPIStatus(value, cfg.sameRoomTurnoverTarget, true)
    expect(status).toBe('warn') // 45/50 = 0.9 → warn (inverse: above target but within 20%)
  })

  it('turnover status uses config.flipRoomTurnoverTarget as fallback', () => {
    const value = 12
    const status = getKPIStatus(value, cfg.flipRoomTurnoverTarget, true)
    expect(status).toBe('good') // 15/12 = 1.25 → good (inverse: below target)
  })
})

describe('OR Utilization modal config-driven thresholds', () => {
  const cfg = ANALYTICS_CONFIG_DEFAULTS
  const nearTarget = cfg.utilizationTargetPercent * 0.8

  it('rooms above target are counted correctly', () => {
    const rooms = [
      { utilization: 80 },
      { utilization: 70 },
      { utilization: 50 },
    ]
    const aboveTarget = rooms.filter(r => r.utilization >= cfg.utilizationTargetPercent).length
    expect(aboveTarget).toBe(1) // Only 80% >= 75%
  })

  it('rooms near target are counted correctly', () => {
    const rooms = [
      { utilization: 80 },
      { utilization: 70 },
      { utilization: 50 },
    ]
    const nearCount = rooms.filter(r => r.utilization >= nearTarget && r.utilization < cfg.utilizationTargetPercent).length
    expect(nearCount).toBe(1) // 70% is between 60% and 75%
  })

  it('rooms below near-target threshold are counted correctly', () => {
    const rooms = [
      { utilization: 80 },
      { utilization: 70 },
      { utilization: 50 },
    ]
    const belowCount = rooms.filter(r => r.utilization < nearTarget).length
    expect(belowCount).toBe(1) // 50% < 60%
  })

  it('with custom utilization target (90%), thresholds adjust correctly', () => {
    const customTarget = 90
    const customNearTarget = customTarget * 0.8 // 72
    const rooms = [
      { utilization: 80 }, // near target (72-90)
      { utilization: 70 }, // below near target (<72)
      { utilization: 95 }, // above target (>=90)
    ]
    expect(rooms.filter(r => r.utilization >= customTarget).length).toBe(1)
    expect(rooms.filter(r => r.utilization >= customNearTarget && r.utilization < customTarget).length).toBe(1)
    expect(rooms.filter(r => r.utilization < customNearTarget).length).toBe(1)
  })
})

describe('Revenue config integration', () => {
  it('converts orHourlyRate to revenuePerORMinute correctly', () => {
    // Page does: config.orHourlyRate / 60
    const hourlyRate = 2160 // $2160/hr = $36/min
    const perMinute = hourlyRate / 60
    expect(perMinute).toBe(36)
  })

  it('uses default $36/min when orHourlyRate is null', () => {
    const orHourlyRate: number | null = null
    const perMinute = orHourlyRate ? orHourlyRate / 60 : 36
    expect(perMinute).toBe(36)
  })

  it('uses custom rate when orHourlyRate is set', () => {
    const orHourlyRate: number | null = 3000 // $50/min
    const perMinute = orHourlyRate ? orHourlyRate / 60 : 36
    expect(perMinute).toBe(50)
  })
})
