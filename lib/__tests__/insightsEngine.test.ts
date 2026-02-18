/**
 * lib/__tests__/insightsEngine.test.ts
 *
 * Phase 4 coverage for insightsEngine.ts changes:
 * 1. orHourlyRate field on InsightsConfig → resolves to revenuePerORMinute
 * 2. operatingDaysPerYear threads through financial impact calculations
 * 3. Target-relative insight body text uses actual targets from analytics data
 * 4. ResolvedInsightsConfig correctly merges caller overrides with defaults
 */

import { describe, it, expect } from 'vitest'
import { generateInsights } from '@/lib/insightsEngine'
import type { InsightsConfig } from '@/lib/insightsEngine'
import type {
  AnalyticsOverview,
  FCOTSResult,
  CancellationResult,
  ORUtilizationResult,
  CaseVolumeResult,
  KPIResult,
} from '@/lib/analyticsV2'

// ============================================
// TEST HELPERS
// ============================================

function makeKPI(overrides: Partial<KPIResult> = {}): KPIResult {
  return {
    value: 0,
    displayValue: '0',
    subtitle: '',
    ...overrides,
  }
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
    sameRoomTurnover: { ...makeKPI({ value: 25, displayValue: '25 min', target: 30, targetMet: true }), details: [], compliantCount: 0, nonCompliantCount: 0, complianceRate: 0 },
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
      details: [],
    } as CancellationResult,
    cumulativeTardiness: makeKPI(),
    nonOperativeTime: makeKPI({ value: 0, displayValue: '0 min', subtitle: '0% of total case time · 0 cases' }),
    surgeonIdleTime: makeKPI(),
    surgeonIdleFlip: makeKPI(),
    surgeonIdleSameRoom: makeKPI(),
    sameRoomSurgicalTurnover: makeKPI({ value: 40, displayValue: '40 min', target: 45, targetMet: true }),
    flipRoomSurgicalTurnover: makeKPI({ value: 12, displayValue: '12 min', target: 15, targetMet: true }),
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
// orHourlyRate → revenuePerORMinute resolution
// ============================================

describe('InsightsConfig: orHourlyRate resolution', () => {
  it('uses orHourlyRate / 60 when provided, ignoring revenuePerORMinute', () => {
    // Set up analytics that will produce a financial impact where we can check
    // that the rate was applied. FCOTS below 50% triggers critical insight with
    // annual impact = lateRate * avgDelay * rooms * revenuePerORMinute * operatingDays.
    // We verify the financial impact string changes proportionally to the rate.
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPI({
          value: 31,
          displayValue: '31%',
          target: 85,
          targetMet: false,
          subtitle: '11 late of 16 first cases (wheels-in, 2 min grace)',
        }),
        firstCaseDetails: [],
      } as FCOTSResult,
    })

    // $7200/hr = $120/min — 3.33× the default $36/min
    const highRate: InsightsConfig = {
      orHourlyRate: 7200,
      operatingDaysPerYear: 250,
    }
    const lowRate: InsightsConfig = {
      orHourlyRate: 1080,  // $18/min — half default
      operatingDaysPerYear: 250,
    }

    const insightsHigh = generateInsights(analytics, highRate)
    const insightsLow = generateInsights(analytics, lowRate)

    const fcotsHigh = insightsHigh.find(i => i.id === 'fcots-delays')
    const fcotsLow = insightsLow.find(i => i.id === 'fcots-delays')

    // Both should generate a financial impact string
    expect(fcotsHigh?.financialImpact).toBeDefined()
    expect(fcotsLow?.financialImpact).toBeDefined()

    // High rate should produce a larger impact number than low rate
    const parseImpact = (s: string | undefined) => {
      if (!s) return 0
      const match = s.match(/\$([\d.]+)([KM]?)/)
      if (!match) return 0
      const num = parseFloat(match[1])
      return match[2] === 'M' ? num * 1_000_000 : match[2] === 'K' ? num * 1_000 : num
    }

    expect(parseImpact(fcotsHigh?.financialImpact)).toBeGreaterThan(
      parseImpact(fcotsLow?.financialImpact)
    )
  })

  it('uses default $36/min when orHourlyRate is null', () => {
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPI({
          value: 31,
          displayValue: '31%',
          target: 85,
          targetMet: false,
          subtitle: '11 late of 16 first cases',
        }),
        firstCaseDetails: [],
      } as FCOTSResult,
    })

    // null orHourlyRate → should fall through to default
    const configWithNull: InsightsConfig = { orHourlyRate: null, operatingDaysPerYear: 250 }
    const configDefault: InsightsConfig = { operatingDaysPerYear: 250 }

    const insightsNull = generateInsights(analytics, configWithNull)
    const insightsDefault = generateInsights(analytics, configDefault)

    const impactNull = insightsNull.find(i => i.id === 'fcots-delays')?.financialImpact
    const impactDefault = insightsDefault.find(i => i.id === 'fcots-delays')?.financialImpact

    // Both should produce identical financial impact since null falls back to default rate
    expect(impactNull).toBe(impactDefault)
  })

  it('orHourlyRate takes precedence over explicit revenuePerORMinute', () => {
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPI({
          value: 31,
          displayValue: '31%',
          target: 85,
          targetMet: false,
          subtitle: '11 late of 16 first cases',
        }),
        firstCaseDetails: [],
      } as FCOTSResult,
    })

    // If both are provided, orHourlyRate should win
    const configHourly: InsightsConfig = {
      orHourlyRate: 7200,           // $120/min
      revenuePerORMinute: 10,       // should be ignored
      operatingDaysPerYear: 250,
    }
    const configMinuteOnly: InsightsConfig = {
      revenuePerORMinute: 120,      // same effective rate without orHourlyRate
      operatingDaysPerYear: 250,
    }

    const insightsHourly = generateInsights(analytics, configHourly)
    const insightsMinute = generateInsights(analytics, configMinuteOnly)

    const impactHourly = insightsHourly.find(i => i.id === 'fcots-delays')?.financialImpact
    const impactMinute = insightsMinute.find(i => i.id === 'fcots-delays')?.financialImpact

    // Both should produce the same impact ($120/min × same days)
    expect(impactHourly).toBe(impactMinute)
  })
})

// ============================================
// operatingDaysPerYear threading
// ============================================

describe('InsightsConfig: operatingDaysPerYear threading', () => {
  it('higher operatingDaysPerYear produces proportionally larger annual impact', () => {
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPI({
          value: 31,
          displayValue: '31%',
          target: 85,
          targetMet: false,
          subtitle: '11 late of 16 first cases',
        }),
        firstCaseDetails: [],
      } as FCOTSResult,
    })

    const config250: InsightsConfig = { operatingDaysPerYear: 250 }
    const config500: InsightsConfig = { operatingDaysPerYear: 500 }

    const insights250 = generateInsights(analytics, config250)
    const insights500 = generateInsights(analytics, config500)

    const parseImpact = (s: string | undefined) => {
      if (!s) return 0
      const match = s.match(/\$([\d.]+)([KM]?)/)
      if (!match) return 0
      const num = parseFloat(match[1])
      return match[2] === 'M' ? num * 1_000_000 : match[2] === 'K' ? num * 1_000 : num
    }

    const impact250 = parseImpact(insights250.find(i => i.id === 'fcots-delays')?.financialImpact)
    const impact500 = parseImpact(insights500.find(i => i.id === 'fcots-delays')?.financialImpact)

    // 500 operating days should yield roughly 2× the impact
    // (subject to rounding, so use a tolerance range: > 1.5× and < 2.5×)
    expect(impact500).toBeGreaterThan(impact250 * 1.5)
    expect(impact500).toBeLessThan(impact250 * 2.5)
  })

  it('operatingDaysPerYear threads into utilization gap annual impact', () => {
    const analytics = makeAnalytics({
      orUtilization: {
        ...makeKPI({ value: 42, displayValue: '42%', target: 75, targetMet: false }),
        roomBreakdown: [
          {
            roomId: 'r1',
            roomName: 'OR-1',
            utilization: 42,
            usedMinutes: 2520,
            availableHours: 10,
            caseCount: 20,
            daysActive: 21,
            usingRealHours: true,
          },
        ],
        roomsWithRealHours: 1,
        roomsWithDefaultHours: 0,
      } as ORUtilizationResult,
    })

    const config100Days: InsightsConfig = { operatingDaysPerYear: 100 }
    const config300Days: InsightsConfig = { operatingDaysPerYear: 300 }

    const insights100 = generateInsights(analytics, config100Days)
    const insights300 = generateInsights(analytics, config300Days)

    const parseImpact = (s: string | undefined) => {
      if (!s) return 0
      const match = s.match(/\$([\d.]+)([KM]?)/)
      if (!match) return 0
      const num = parseFloat(match[1])
      return match[2] === 'M' ? num * 1_000_000 : match[2] === 'K' ? num * 1_000 : num
    }

    const util100 = insights100.find(i => i.id === 'utilization-below-target')
    const util300 = insights300.find(i => i.id === 'utilization-below-target')

    // If financial impact is defined for both, 300 days should be larger
    if (util100?.financialImpact && util300?.financialImpact) {
      expect(parseImpact(util300.financialImpact)).toBeGreaterThan(parseImpact(util100.financialImpact))
    }
  })
})

// ============================================
// Target-relative insight body text
// ============================================

describe('Target-relative insight body text', () => {
  it('FCOTS insight body references the actual target from analytics data', () => {
    // Target is 90 (not the hardcoded default)
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPI({
          value: 50,
          displayValue: '50%',
          target: 90,
          targetMet: false,
          subtitle: '8 late of 16 first cases',
        }),
        firstCaseDetails: [],
      } as FCOTSResult,
    })

    const insights = generateInsights(analytics)
    const fcotsInsight = insights.find(i => i.id === 'fcots-delays')

    expect(fcotsInsight).toBeDefined()
    // Body must reference the actual 90% target, not a hardcoded value
    expect(fcotsInsight?.body).toContain('90%')
  })

  it('turnover insight body references actual target from analytics data', () => {
    // Target compliance is 80%, threshold is 20 min (custom tight target)
    // Subtitle format matches calculateTurnoverTime: "X% under Y min target"
    const analytics = makeAnalytics({
      sameRoomTurnover: { ...makeKPI({
        value: 40,
        displayValue: '40 min',
        target: 80,
        targetMet: false,
        subtitle: '60% under 20 min target',
      }), details: [], compliantCount: 0, nonCompliantCount: 0, complianceRate: 0 },
    })

    const insights = generateInsights(analytics)
    const turnoverInsight = insights.find(i => i.id === 'turnover-room')

    expect(turnoverInsight).toBeDefined()
    // Body must reference the actual 20 min threshold from subtitle
    expect(turnoverInsight?.body).toContain('20 min target')
  })

  it('utilization insight body references actual target from analytics data', () => {
    // Target is 80% (not the default 75%)
    const analytics = makeAnalytics({
      orUtilization: {
        ...makeKPI({ value: 55, displayValue: '55%', target: 80, targetMet: false }),
        roomBreakdown: [
          {
            roomId: 'r1',
            roomName: 'OR-1',
            utilization: 55,
            usedMinutes: 3300,
            availableHours: 10,
            caseCount: 15,
            daysActive: 10,
            usingRealHours: true,
          },
        ],
        roomsWithRealHours: 1,
        roomsWithDefaultHours: 0,
      } as ORUtilizationResult,
    })

    const insights = generateInsights(analytics)
    const utilizationInsight = insights.find(i => i.id === 'utilization-below-target')

    expect(utilizationInsight).toBeDefined()
    // Body must reference the actual 80% target
    expect(utilizationInsight?.body).toContain('80%')
  })

  it('cancellation insight body references actual target from analytics data', () => {
    // Target is 3% (custom tight target)
    const analytics = makeAnalytics({
      cancellationRate: {
        ...makeKPI({
          value: 8,
          displayValue: '8%',
          target: 3,
          targetMet: false,
        }),
        sameDayCount: 4,
        sameDayRate: 8,
        totalCancelledCount: 4,
        details: [],
      } as CancellationResult,
    })

    const insights = generateInsights(analytics)
    const cancelInsight = insights.find(i => i.id === 'cancellation-rate')

    expect(cancelInsight).toBeDefined()
    // Body must reference the actual 3% target
    expect(cancelInsight?.body).toContain('3%')
  })

  it('surgical turnover comparison body references actual same-room target', () => {
    // Both same-room and flip-room above their targets
    const analytics = makeAnalytics({
      sameRoomSurgicalTurnover: makeKPI({
        value: 55,
        displayValue: '55 min',
        target: 40,
        targetMet: false,
        subtitle: '30 turnovers',
      }),
      flipRoomSurgicalTurnover: makeKPI({
        value: 22,
        displayValue: '22 min',
        target: 12,
        targetMet: false,
        subtitle: '10 flips',
      }),
    })

    const insights = generateInsights(analytics)
    const comparisonInsight = insights.find(i => i.id === 'turnover-surgical-comparison')

    expect(comparisonInsight).toBeDefined()
    // Body should reference the actual targets (40 and 12), not hardcoded 45/15
    expect(comparisonInsight?.body).toContain('40')
    expect(comparisonInsight?.body).toContain('12')
  })
})

// ============================================
// generateInsights: Config defaults and merging
// ============================================

describe('generateInsights: config defaults and merging', () => {
  it('runs without config argument (all defaults)', () => {
    const analytics = makeAnalytics()
    expect(() => generateInsights(analytics)).not.toThrow()
  })

  it('runs with empty config object', () => {
    const analytics = makeAnalytics()
    expect(() => generateInsights(analytics, {})).not.toThrow()
  })

  it('respects maxInsights from config', () => {
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPI({ value: 31, displayValue: '31%', target: 85, targetMet: false, subtitle: '11 late of 16 first cases' }),
        firstCaseDetails: [],
      } as FCOTSResult,
      orUtilization: {
        ...makeKPI({ value: 42, displayValue: '42%', target: 75, targetMet: false }),
        roomBreakdown: [{ roomId: 'r1', roomName: 'OR-1', utilization: 42, usedMinutes: 1000, availableHours: 10, caseCount: 20, daysActive: 10, usingRealHours: false }],
        roomsWithRealHours: 0,
        roomsWithDefaultHours: 1,
      } as ORUtilizationResult,
    })

    const insights1 = generateInsights(analytics, { maxInsights: 1 })
    const insights3 = generateInsights(analytics, { maxInsights: 3 })

    expect(insights1.length).toBeLessThanOrEqual(1)
    expect(insights3.length).toBeLessThanOrEqual(3)
  })

  it('sorts insights by severity: critical before warning before positive', () => {
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPI({
          value: 31,   // < 50 → critical
          displayValue: '31%',
          target: 85,
          targetMet: false,
          subtitle: '11 late of 16 first cases',
        }),
        firstCaseDetails: [],
      } as FCOTSResult,
    })

    const insights = generateInsights(analytics)
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, positive: 2, info: 3 }

    for (let i = 1; i < insights.length; i++) {
      expect(severityOrder[insights[i].severity]).toBeGreaterThanOrEqual(
        severityOrder[insights[i - 1].severity]
      )
    }
  })

  it('FCOTS < 50% generates critical severity insight', () => {
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPI({ value: 31, displayValue: '31%', target: 85, targetMet: false, subtitle: '11 late of 16 first cases' }),
        firstCaseDetails: [],
      } as FCOTSResult,
    })

    const insights = generateInsights(analytics)
    const fcotsInsight = insights.find(i => i.id === 'fcots-delays')

    expect(fcotsInsight?.severity).toBe('critical')
  })

  it('FCOTS between 50% and target generates warning severity insight', () => {
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPI({ value: 65, displayValue: '65%', target: 85, targetMet: false, subtitle: '5 late of 16 first cases' }),
        firstCaseDetails: [],
      } as FCOTSResult,
    })

    const insights = generateInsights(analytics)
    const fcotsInsight = insights.find(i => i.id === 'fcots-delays')

    expect(fcotsInsight?.severity).toBe('warning')
  })

  it('FCOTS on target generates positive insight', () => {
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPI({ value: 90, displayValue: '90%', target: 85, targetMet: true }),
        firstCaseDetails: [],
      } as FCOTSResult,
    })

    const insights = generateInsights(analytics)
    const fcotsInsight = insights.find(i => i.id === 'fcots-on-target')

    expect(fcotsInsight).toBeDefined()
    expect(fcotsInsight?.severity).toBe('positive')
    // Body should reference the actual target
    expect(fcotsInsight?.body).toContain('85%')
  })
})

// ============================================
// Phase 1: drillThroughType field on every insight
// ============================================

describe('Insight.drillThroughType field', () => {
  it('fcots-delays insight has drillThroughType = "fcots"', () => {
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPI({ value: 31, displayValue: '31%', target: 85, targetMet: false, subtitle: '11 late of 16 first cases' }),
        firstCaseDetails: [],
      } as FCOTSResult,
    })
    const insights = generateInsights(analytics)
    const insight = insights.find(i => i.id === 'fcots-delays')
    expect(insight).toBeDefined()
    expect(insight?.drillThroughType).toBe('fcots')
  })

  it('fcots-on-target insight has drillThroughType = null (no panel)', () => {
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPI({ value: 90, displayValue: '90%', target: 85, targetMet: true }),
        firstCaseDetails: [],
      } as FCOTSResult,
    })
    const insights = generateInsights(analytics)
    const insight = insights.find(i => i.id === 'fcots-on-target')
    expect(insight).toBeDefined()
    expect(insight?.drillThroughType).toBeNull()
  })

  it('turnover-room insight has drillThroughType = "turnover"', () => {
    const analytics = makeAnalytics({
      sameRoomTurnover: { ...makeKPI({
        value: 40,
        displayValue: '40 min',
        target: 80,
        targetMet: false,
        subtitle: '60% under 30 min target',
      }), details: [], compliantCount: 0, nonCompliantCount: 0, complianceRate: 0 },
    })
    const insights = generateInsights(analytics)
    const insight = insights.find(i => i.id === 'turnover-room')
    expect(insight).toBeDefined()
    expect(insight?.drillThroughType).toBe('turnover')
  })

  it('turnover-surgical-comparison insight has drillThroughType = "turnover"', () => {
    const analytics = makeAnalytics({
      sameRoomSurgicalTurnover: makeKPI({
        value: 55,
        displayValue: '55 min',
        target: 40,
        targetMet: false,
        subtitle: '30 turnovers',
      }),
      flipRoomSurgicalTurnover: makeKPI({
        value: 22,
        displayValue: '22 min',
        target: 12,
        targetMet: false,
        subtitle: '10 flips',
      }),
    })
    const insights = generateInsights(analytics)
    const insight = insights.find(i => i.id === 'turnover-surgical-comparison')
    expect(insight).toBeDefined()
    expect(insight?.drillThroughType).toBe('turnover')
  })

  it('callback-call-sooner insight has drillThroughType = "callback"', () => {
    const analytics = makeAnalytics({
      surgeonIdleSummaries: [
        {
          surgeonId: 'surg-1',
          surgeonName: 'Dr. A',
          caseCount: 10,
          gapCount: 5,
          medianIdleTime: 20,
          hasFlipData: true,
          flipGapCount: 5,
          sameRoomGapCount: 0,
          medianFlipIdle: 20,
          medianSameRoomIdle: 0,
          medianCallbackDelta: 15,
          status: 'call_sooner',
          statusLabel: 'Call Sooner',
        },
      ],
    })
    const insights = generateInsights(analytics)
    const insight = insights.find(i => i.id === 'callback-call-sooner')
    expect(insight).toBeDefined()
    expect(insight?.drillThroughType).toBe('callback')
  })

  it('callback-call-later insight has drillThroughType = "callback"', () => {
    const analytics = makeAnalytics({
      surgeonIdleSummaries: [
        {
          surgeonId: 'surg-2',
          surgeonName: 'Dr. B',
          caseCount: 8,
          gapCount: 4,
          medianIdleTime: 2,
          hasFlipData: true,
          flipGapCount: 4,
          sameRoomGapCount: 0,
          medianFlipIdle: 2,
          medianSameRoomIdle: 0,
          medianCallbackDelta: -5,
          status: 'call_later',
          statusLabel: 'Call Later',
        },
      ],
    })
    const insights = generateInsights(analytics)
    const insight = insights.find(i => i.id === 'callback-call-later')
    expect(insight).toBeDefined()
    expect(insight?.drillThroughType).toBe('callback')
  })

  it('callback-all-on-track insight has drillThroughType = null', () => {
    const analytics = makeAnalytics({
      surgeonIdleSummaries: [
        {
          surgeonId: 'surg-3',
          surgeonName: 'Dr. C',
          caseCount: 12,
          gapCount: 6,
          medianIdleTime: 4,
          hasFlipData: true,
          flipGapCount: 6,
          sameRoomGapCount: 0,
          medianFlipIdle: 4,
          medianSameRoomIdle: 0,
          medianCallbackDelta: 0,
          status: 'on_track',
          statusLabel: 'On Track',
        },
      ],
    })
    const insights = generateInsights(analytics)
    const insight = insights.find(i => i.id === 'callback-all-on-track')
    expect(insight).toBeDefined()
    expect(insight?.drillThroughType).toBeNull()
  })

  it('utilization-below-target insight has drillThroughType = "utilization"', () => {
    const analytics = makeAnalytics({
      orUtilization: {
        ...makeKPI({ value: 42, displayValue: '42%', target: 75, targetMet: false }),
        roomBreakdown: [
          {
            roomId: 'r1',
            roomName: 'OR-1',
            utilization: 42,
            usedMinutes: 2520,
            availableHours: 10,
            caseCount: 20,
            daysActive: 21,
            usingRealHours: true,
          },
        ],
        roomsWithRealHours: 1,
        roomsWithDefaultHours: 0,
      } as ORUtilizationResult,
    })
    const insights = generateInsights(analytics)
    const insight = insights.find(i => i.id === 'utilization-below-target')
    expect(insight).toBeDefined()
    expect(insight?.drillThroughType).toBe('utilization')
  })

  it('utilization-on-target insight has drillThroughType = null', () => {
    const analytics = makeAnalytics({
      orUtilization: {
        ...makeKPI({ value: 80, displayValue: '80%', target: 75, targetMet: true }),
        roomBreakdown: [
          {
            roomId: 'r1',
            roomName: 'OR-1',
            utilization: 80,
            usedMinutes: 4800,
            availableHours: 10,
            caseCount: 25,
            daysActive: 21,
            usingRealHours: true,
          },
        ],
        roomsWithRealHours: 1,
        roomsWithDefaultHours: 0,
      } as ORUtilizationResult,
    })
    const insights = generateInsights(analytics)
    const insight = insights.find(i => i.id === 'utilization-on-target')
    expect(insight).toBeDefined()
    expect(insight?.drillThroughType).toBeNull()
  })

  it('cancellation-rate insight has drillThroughType = "cancellation"', () => {
    const analytics = makeAnalytics({
      cancellationRate: {
        ...makeKPI({ value: 8, displayValue: '8%', target: 5, targetMet: false }),
        sameDayCount: 4,
        sameDayRate: 8,
        totalCancelledCount: 4,
        details: [],
      } as CancellationResult,
    })
    const insights = generateInsights(analytics)
    const insight = insights.find(i => i.id === 'cancellation-rate')
    expect(insight).toBeDefined()
    expect(insight?.drillThroughType).toBe('cancellation')
  })

  it('cancellation-streak insight has drillThroughType = null', () => {
    // Need 6+ consecutive green days in dailyData
    const greenDays = Array.from({ length: 10 }, (_, i) => ({
      date: `2025-02-${String(i + 1).padStart(2, '0')}`,
      color: 'green' as const,
      tooltip: '',
      numericValue: 0,
    }))
    const analytics = makeAnalytics({
      cancellationRate: {
        ...makeKPI({ value: 0, displayValue: '0%', target: 5, targetMet: true, dailyData: greenDays }),
        sameDayCount: 0,
        sameDayRate: 0,
        totalCancelledCount: 0,
        details: [],
      } as CancellationResult,
    })
    const insights = generateInsights(analytics)
    const insight = insights.find(i => i.id === 'cancellation-streak')
    expect(insight).toBeDefined()
    expect(insight?.drillThroughType).toBeNull()
  })

  it('non-op-time-high insight has drillThroughType = "non_op_time"', () => {
    const analytics = makeAnalytics({
      nonOperativeTime: makeKPI({
        value: 45,
        displayValue: '45 min',
        subtitle: '38% of total case time · 30 cases',
      }),
      completedCases: 30,
    })
    const insights = generateInsights(analytics)
    const insight = insights.find(i => i.id === 'non-op-time-high')
    expect(insight).toBeDefined()
    expect(insight?.drillThroughType).toBe('non_op_time')
  })

  it('scheduling-divergence insight has drillThroughType = "scheduling"', () => {
    const analytics = makeAnalytics({
      caseVolume: {
        ...makeKPI({ value: 120, displayValue: '120', delta: 15, deltaType: 'increase' }),
        weeklyVolume: [],
      } as CaseVolumeResult,
      orUtilization: {
        ...makeKPI({ value: 60, displayValue: '60%', target: 75, targetMet: false, delta: 10, deltaType: 'decrease' }),
        roomBreakdown: [],
        roomsWithRealHours: 0,
        roomsWithDefaultHours: 0,
      } as ORUtilizationResult,
    })
    const insights = generateInsights(analytics)
    const insight = insights.find(i => i.id === 'scheduling-divergence')
    expect(insight).toBeDefined()
    expect(insight?.drillThroughType).toBe('scheduling')
  })

  it('volume-declining insight has drillThroughType = "scheduling"', () => {
    const analytics = makeAnalytics({
      caseVolume: {
        ...makeKPI({ value: 70, displayValue: '70', delta: 30, deltaType: 'decrease' }),
        weeklyVolume: [],
      } as CaseVolumeResult,
    })
    const insights = generateInsights(analytics)
    const insight = insights.find(i => i.id === 'volume-declining')
    expect(insight).toBeDefined()
    expect(insight?.drillThroughType).toBe('scheduling')
  })

  it('every generated insight has drillThroughType defined (not undefined)', () => {
    // Run with multiple issues active so many insights generate
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPI({ value: 31, displayValue: '31%', target: 85, targetMet: false, subtitle: '11 late of 16 first cases' }),
        firstCaseDetails: [],
      } as FCOTSResult,
      sameRoomTurnover: { ...makeKPI({ value: 40, displayValue: '40 min', target: 80, targetMet: false, subtitle: '60% under 30 min target' }), details: [], compliantCount: 0, nonCompliantCount: 0, complianceRate: 0 },
      orUtilization: {
        ...makeKPI({ value: 42, displayValue: '42%', target: 75, targetMet: false }),
        roomBreakdown: [{ roomId: 'r1', roomName: 'OR-1', utilization: 42, usedMinutes: 2520, availableHours: 10, caseCount: 20, daysActive: 21, usingRealHours: true }],
        roomsWithRealHours: 1,
        roomsWithDefaultHours: 0,
      } as ORUtilizationResult,
    })
    const insights = generateInsights(analytics)
    // drillThroughType must be explicitly set (either a string or null — never undefined)
    for (const insight of insights) {
      expect(Object.prototype.hasOwnProperty.call(insight, 'drillThroughType')).toBe(true)
      expect(insight.drillThroughType === null || typeof insight.drillThroughType === 'string').toBe(true)
    }
  })
})

// ============================================
// KPI page integration: orHourlyRate + operatingDaysPerYear
// (Tests the exact call pattern used by app/analytics/kpi/page.tsx)
// ============================================

describe('KPI page call pattern: generateInsights({ orHourlyRate, operatingDaysPerYear })', () => {
  it('accepts the exact signature the KPI page uses', () => {
    const analytics = makeAnalytics()

    // This is exactly what page.tsx does:
    // generateInsights(analytics, { orHourlyRate: config.orHourlyRate, operatingDaysPerYear: config.operatingDaysPerYear })
    expect(() =>
      generateInsights(analytics, {
        orHourlyRate: 2160,
        operatingDaysPerYear: 250,
      })
    ).not.toThrow()
  })

  it('accepts null orHourlyRate (facility has no rate configured)', () => {
    const analytics = makeAnalytics()

    expect(() =>
      generateInsights(analytics, {
        orHourlyRate: null,
        operatingDaysPerYear: 250,
      })
    ).not.toThrow()
  })

  it('accepts undefined orHourlyRate (config field missing)', () => {
    const analytics = makeAnalytics()

    expect(() =>
      generateInsights(analytics, {
        orHourlyRate: undefined,
        operatingDaysPerYear: 260,
      })
    ).not.toThrow()
  })

  it('with orHourlyRate=2160 produces $36/min equivalent results', () => {
    // $2160/hr ÷ 60 = $36/min — the default rate
    const analytics = makeAnalytics({
      fcots: {
        ...makeKPI({
          value: 31,
          displayValue: '31%',
          target: 85,
          targetMet: false,
          subtitle: '11 late of 16 first cases',
        }),
        firstCaseDetails: [],
      } as FCOTSResult,
    })

    const withHourlyRate = generateInsights(analytics, {
      orHourlyRate: 2160,
      operatingDaysPerYear: 250,
    })
    const withMinuteRate = generateInsights(analytics, {
      revenuePerORMinute: 36,
      operatingDaysPerYear: 250,
    })

    const extractImpact = (insights: ReturnType<typeof generateInsights>) =>
      insights.find(i => i.id === 'fcots-delays')?.financialImpact

    // $2160/hr ÷ 60 = $36/min, so impacts must match
    expect(extractImpact(withHourlyRate)).toBe(extractImpact(withMinuteRate))
  })
})
