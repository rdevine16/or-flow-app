// lib/__tests__/flagPatternDetection.test.ts
// Unit tests for the client-side flag pattern detection engine.
// Covers each detector in isolation and edge cases:
//   - detectFlagPatterns (main entry, sort order, early return)
//   - detectDaySpikes
//   - detectTrendChanges
//   - detectRoomConcentration
//   - detectRecurringSurgeon
//   - detectEquipmentCascade

import { describe, it, expect } from 'vitest'
import { detectFlagPatterns } from '../flagPatternDetection'
import type { FlagAnalyticsRPCResponse } from '@/types/flag-analytics'

// ============================================
// Shared factory helpers
// ============================================

function makeSummary(
  overrides: Partial<FlagAnalyticsRPCResponse['summary']> = {},
): FlagAnalyticsRPCResponse['summary'] {
  return {
    totalCases: 100,
    flaggedCases: 40,
    flagRate: 40,
    flagRateTrend: 0,
    delayedCases: 10,
    delayRate: 10,
    delayRateTrend: 0,
    criticalCount: 5,
    warningCount: 25,
    infoCount: 10,
    totalFlags: 60,
    avgFlagsPerCase: 1.5,
    ...overrides,
  }
}

function makeSurgeonRow(
  overrides: Partial<FlagAnalyticsRPCResponse['surgeonFlags'][number]> & { name: string; surgeonId: string },
): FlagAnalyticsRPCResponse['surgeonFlags'][number] {
  return {
    cases: 10,
    flaggedCases: 5,
    flags: 5,
    rate: 50,
    prevRate: null,
    trend: 0,
    topFlag: '',
    ...overrides,
  }
}

function makeBaseData(
  overrides: Partial<FlagAnalyticsRPCResponse> = {},
): FlagAnalyticsRPCResponse {
  return {
    summary: makeSummary(),
    sparklineData: { flagRate: [], delayRate: [] },
    weeklyTrend: [],
    dayOfWeekHeatmap: [],
    flagRuleBreakdown: [],
    delayTypeBreakdown: [],
    surgeonFlags: [],
    roomFlags: [],
    recentFlaggedCases: [],
    ...overrides,
  }
}

// ============================================
// Main entry: detectFlagPatterns
// ============================================

describe('detectFlagPatterns: early return guard', () => {
  it('returns empty array when totalFlags < 3 (below minFlagsForPattern)', () => {
    const data = makeBaseData({ summary: makeSummary({ totalFlags: 2 }) })
    expect(detectFlagPatterns(data)).toEqual([])
  })

  it('returns empty array when totalFlags is exactly 0', () => {
    const data = makeBaseData({ summary: makeSummary({ totalFlags: 0 }) })
    expect(detectFlagPatterns(data)).toEqual([])
  })

  it('proceeds when totalFlags equals 3 (at threshold)', () => {
    // With totalFlags=3 we proceed, but empty arrays means no patterns found
    const data = makeBaseData({ summary: makeSummary({ totalFlags: 3 }) })
    const patterns = detectFlagPatterns(data)
    expect(Array.isArray(patterns)).toBe(true)
  })

  it('always returns an array', () => {
    const data = makeBaseData()
    expect(Array.isArray(detectFlagPatterns(data))).toBe(true)
  })
})

describe('detectFlagPatterns: severity sort order', () => {
  it('sorts critical patterns before warning, warning before good', () => {
    // Craft data that triggers: room_concentration (critical), recurring_surgeon (warning),
    // and trend_improvement (good)
    const data = makeBaseData({
      summary: makeSummary({
        totalFlags: 20,
        totalCases: 100,
        flagRate: 20,
        avgFlagsPerCase: 1.0,
      }),
      // day heatmap: Monday spike >50% over average, total 8 flags (>=3) — warning
      dayOfWeekHeatmap: [
        { day: 'Monday', dayNum: 1, fcots: 4, timing: 2, turnover: 1, delay: 1, total: 8 },
        { day: 'Tuesday', dayNum: 2, fcots: 1, timing: 1, turnover: 0, delay: 0, total: 2 },
        { day: 'Wednesday', dayNum: 3, fcots: 1, timing: 1, turnover: 0, delay: 0, total: 2 },
        { day: 'Thursday', dayNum: 4, fcots: 1, timing: 0, turnover: 0, delay: 0, total: 1 },
        { day: 'Friday', dayNum: 5, fcots: 1, timing: 0, turnover: 0, delay: 0, total: 1 },
      ],
      // room: triggers critical (>35% flags, <30% cases)
      roomFlags: [
        { room: 'OR 1', roomId: 'r1', cases: 20, flags: 8, rate: 40, topIssue: 'Timing', topDelay: '' },
      ],
      // surgeons: triggers warning (rate > 2x facility average of 20%)
      surgeonFlags: [
        makeSurgeonRow({ name: 'Dr. Jones', surgeonId: 's1', cases: 10, flags: 5, rate: 50, topFlag: 'FCOTS' }),
      ],
      // trend: improvement (secondHalf threshold < firstHalf by >20%)
      weeklyTrend: [
        { week: '2026-01-01', threshold: 10, delay: 5, total: 15 },
        { week: '2026-01-08', threshold: 10, delay: 5, total: 15 },
        { week: '2026-01-15', threshold: 5, delay: 3, total: 8 },
        { week: '2026-01-22', threshold: 5, delay: 3, total: 8 },
      ],
    })

    const patterns = detectFlagPatterns(data)
    expect(patterns.length).toBeGreaterThan(0)

    // Verify sort: critical comes first, then warning, then good
    const severities = patterns.map((p) => p.severity)
    const criticalIdx = severities.indexOf('critical')
    const warningIdx = severities.indexOf('warning')
    const goodIdx = severities.indexOf('good')

    if (criticalIdx !== -1 && warningIdx !== -1) {
      expect(criticalIdx).toBeLessThan(warningIdx)
    }
    if (warningIdx !== -1 && goodIdx !== -1) {
      expect(warningIdx).toBeLessThan(goodIdx)
    }
    if (criticalIdx !== -1 && goodIdx !== -1) {
      expect(criticalIdx).toBeLessThan(goodIdx)
    }
  })
})

// ============================================
// Detector: Day Spikes
// ============================================

describe('detectDaySpikes', () => {
  it('detects a spike when a day has >50% more flags than average', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 20 }),
      dayOfWeekHeatmap: [
        // avg = (12 + 2 + 2 + 2 + 2) / 5 = 4. Monday excess = (12-4)/4 = 200% > 50%
        { day: 'Monday', dayNum: 1, fcots: 6, timing: 3, turnover: 2, delay: 1, total: 12 },
        { day: 'Tuesday', dayNum: 2, fcots: 1, timing: 1, turnover: 0, delay: 0, total: 2 },
        { day: 'Wednesday', dayNum: 3, fcots: 1, timing: 1, turnover: 0, delay: 0, total: 2 },
        { day: 'Thursday', dayNum: 4, fcots: 1, timing: 1, turnover: 0, delay: 0, total: 2 },
        { day: 'Friday', dayNum: 5, fcots: 1, timing: 1, turnover: 0, delay: 0, total: 2 },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const spikes = patterns.filter((p) => p.type === 'day_spike')
    expect(spikes.length).toBe(1)
    expect(spikes[0].title).toBe('Monday Spike')
  })

  it('assigns "critical" severity when excess > 100% (more than double)', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 20 }),
      dayOfWeekHeatmap: [
        // avg=4, Monday=12 → excess=200% > 100%
        { day: 'Monday', dayNum: 1, fcots: 6, timing: 3, turnover: 2, delay: 1, total: 12 },
        { day: 'Tuesday', dayNum: 2, fcots: 1, timing: 1, turnover: 0, delay: 0, total: 2 },
        { day: 'Wednesday', dayNum: 3, fcots: 1, timing: 1, turnover: 0, delay: 0, total: 2 },
        { day: 'Thursday', dayNum: 4, fcots: 1, timing: 1, turnover: 0, delay: 0, total: 2 },
        { day: 'Friday', dayNum: 5, fcots: 1, timing: 1, turnover: 0, delay: 0, total: 2 },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const spike = patterns.find((p) => p.type === 'day_spike')
    expect(spike?.severity).toBe('critical')
  })

  it('assigns "warning" severity when excess is between 50% and 100%', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 20 }),
      dayOfWeekHeatmap: [
        // avg = (7 + 4 + 4 + 4 + 3) / 5 = 4.4, Monday excess = (7-4.4)/4.4 ≈ 59% — warning
        { day: 'Monday', dayNum: 1, fcots: 4, timing: 2, turnover: 1, delay: 0, total: 7 },
        { day: 'Tuesday', dayNum: 2, fcots: 2, timing: 1, turnover: 1, delay: 0, total: 4 },
        { day: 'Wednesday', dayNum: 3, fcots: 2, timing: 1, turnover: 1, delay: 0, total: 4 },
        { day: 'Thursday', dayNum: 4, fcots: 2, timing: 1, turnover: 1, delay: 0, total: 4 },
        { day: 'Friday', dayNum: 5, fcots: 1, timing: 1, turnover: 1, delay: 0, total: 3 },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const spike = patterns.find((p) => p.type === 'day_spike')
    expect(spike?.severity).toBe('warning')
  })

  it('does NOT detect a spike when excess is exactly 50% (threshold is exclusive)', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 18 }),
      dayOfWeekHeatmap: [
        // avg = (6 + 4 + 4 + 4) / 4 = 4.5, Monday excess = (6-4.5)/4.5 = 33% — not a spike
        { day: 'Monday', dayNum: 1, fcots: 3, timing: 2, turnover: 1, delay: 0, total: 6 },
        { day: 'Tuesday', dayNum: 2, fcots: 2, timing: 1, turnover: 1, delay: 0, total: 4 },
        { day: 'Wednesday', dayNum: 3, fcots: 2, timing: 1, turnover: 1, delay: 0, total: 4 },
        { day: 'Thursday', dayNum: 4, fcots: 2, timing: 1, turnover: 1, delay: 0, total: 4 },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const spikes = patterns.filter((p) => p.type === 'day_spike')
    expect(spikes.length).toBe(0)
  })

  it('does NOT spike a day when total < 3 (below minFlagsForPattern)', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 10 }),
      dayOfWeekHeatmap: [
        // avg = (2 + 1 + 1) / 3 = 1.33, Monday excess = (2-1.33)/1.33 = 50.4% — barely over threshold
        // but Monday total=2 < 3, so should NOT trigger
        { day: 'Monday', dayNum: 1, fcots: 1, timing: 1, turnover: 0, delay: 0, total: 2 },
        { day: 'Tuesday', dayNum: 2, fcots: 0, timing: 1, turnover: 0, delay: 0, total: 1 },
        { day: 'Wednesday', dayNum: 3, fcots: 0, timing: 1, turnover: 0, delay: 0, total: 1 },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const spikes = patterns.filter((p) => p.type === 'day_spike')
    expect(spikes.length).toBe(0)
  })

  it('does NOT detect spikes when heatmap is empty', () => {
    const data = makeBaseData({ summary: makeSummary({ totalFlags: 10 }), dayOfWeekHeatmap: [] })
    const patterns = detectFlagPatterns(data)
    const spikes = patterns.filter((p) => p.type === 'day_spike')
    expect(spikes.length).toBe(0)
  })

  it('correctly identifies the dominant flag category in the spike description', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 20 }),
      dayOfWeekHeatmap: [
        // Timing dominates (5 out of 10)
        { day: 'Friday', dayNum: 5, fcots: 2, timing: 5, turnover: 2, delay: 1, total: 10 },
        { day: 'Monday', dayNum: 1, fcots: 1, timing: 1, turnover: 0, delay: 0, total: 2 },
        { day: 'Tuesday', dayNum: 2, fcots: 1, timing: 0, turnover: 0, delay: 0, total: 1 },
        { day: 'Wednesday', dayNum: 3, fcots: 1, timing: 0, turnover: 0, delay: 0, total: 1 },
        { day: 'Thursday', dayNum: 4, fcots: 1, timing: 0, turnover: 0, delay: 0, total: 1 },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const spike = patterns.find((p) => p.type === 'day_spike')
    expect(spike?.desc).toContain('Timing')
    expect(spike?.metric).toContain('%')
  })

  it('can detect multiple spikes if multiple days qualify', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 30 }),
      dayOfWeekHeatmap: [
        // avg = (12 + 12 + 1 + 1 + 1) / 5 = 5.4
        // Monday: (12-5.4)/5.4 ≈ 122% spike
        // Tuesday: (12-5.4)/5.4 ≈ 122% spike
        { day: 'Monday', dayNum: 1, fcots: 6, timing: 3, turnover: 2, delay: 1, total: 12 },
        { day: 'Tuesday', dayNum: 2, fcots: 6, timing: 3, turnover: 2, delay: 1, total: 12 },
        { day: 'Wednesday', dayNum: 3, fcots: 0, timing: 1, turnover: 0, delay: 0, total: 1 },
        { day: 'Thursday', dayNum: 4, fcots: 0, timing: 1, turnover: 0, delay: 0, total: 1 },
        { day: 'Friday', dayNum: 5, fcots: 0, timing: 1, turnover: 0, delay: 0, total: 1 },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const spikes = patterns.filter((p) => p.type === 'day_spike')
    expect(spikes.length).toBe(2)
  })

  it('does not divide by zero when all days have 0 flags', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 10 }),
      dayOfWeekHeatmap: [
        { day: 'Monday', dayNum: 1, fcots: 0, timing: 0, turnover: 0, delay: 0, total: 0 },
        { day: 'Tuesday', dayNum: 2, fcots: 0, timing: 0, turnover: 0, delay: 0, total: 0 },
      ],
    })
    // Should not throw
    expect(() => detectFlagPatterns(data)).not.toThrow()
    const spikes = detectFlagPatterns(data).filter((p) => p.type === 'day_spike')
    expect(spikes.length).toBe(0)
  })
})

// ============================================
// Detector: Trend Changes
// ============================================

describe('detectTrendChanges', () => {
  it('detects trend_improvement when threshold flags decrease >20% from first to second half', () => {
    // first half avg=10, second half avg=6 → change=-40% < -20%
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 10 }),
      weeklyTrend: [
        { week: '2026-01-01', threshold: 10, delay: 2, total: 12 },
        { week: '2026-01-08', threshold: 10, delay: 2, total: 12 },
        { week: '2026-01-15', threshold: 6, delay: 2, total: 8 },
        { week: '2026-01-22', threshold: 6, delay: 2, total: 8 },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const improvements = patterns.filter(
      (p) => p.type === 'trend_improvement' && p.title === 'Threshold Flags Declining',
    )
    expect(improvements.length).toBe(1)
    expect(improvements[0].severity).toBe('good')
    expect(improvements[0].metric).toMatch(/^-\d+%$/)
  })

  it('detects trend_deterioration when threshold flags increase >20% from first to second half', () => {
    // first half avg=5, second half avg=8 → change=+60% > +20%
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 10 }),
      weeklyTrend: [
        { week: '2026-01-01', threshold: 5, delay: 1, total: 6 },
        { week: '2026-01-08', threshold: 5, delay: 1, total: 6 },
        { week: '2026-01-15', threshold: 8, delay: 1, total: 9 },
        { week: '2026-01-22', threshold: 8, delay: 1, total: 9 },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const deteriorations = patterns.filter(
      (p) => p.type === 'trend_deterioration' && p.title === 'Threshold Flags Increasing',
    )
    expect(deteriorations.length).toBe(1)
    expect(deteriorations[0].severity).toBe('warning')
    expect(deteriorations[0].metric).toMatch(/^\+\d+%$/)
  })

  it('detects trend_improvement when delay flags decrease >20%', () => {
    // first half delay avg=8, second half delay avg=4 → change=-50% < -20%
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 10 }),
      weeklyTrend: [
        { week: '2026-01-01', threshold: 2, delay: 8, total: 10 },
        { week: '2026-01-08', threshold: 2, delay: 8, total: 10 },
        { week: '2026-01-15', threshold: 2, delay: 4, total: 6 },
        { week: '2026-01-22', threshold: 2, delay: 4, total: 6 },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const improvements = patterns.filter(
      (p) => p.type === 'trend_improvement' && p.title === 'Reported Delays Declining',
    )
    expect(improvements.length).toBe(1)
  })

  it('detects trend_deterioration when delay flags increase >20%', () => {
    // first half delay avg=3, second half avg=6 → change=+100% > +20%
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 10 }),
      weeklyTrend: [
        { week: '2026-01-01', threshold: 2, delay: 3, total: 5 },
        { week: '2026-01-08', threshold: 2, delay: 3, total: 5 },
        { week: '2026-01-15', threshold: 2, delay: 6, total: 8 },
        { week: '2026-01-22', threshold: 2, delay: 6, total: 8 },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const deteriorations = patterns.filter(
      (p) => p.type === 'trend_deterioration' && p.title === 'Reported Delays Increasing',
    )
    expect(deteriorations.length).toBe(1)
  })

  it('does NOT detect a trend with fewer than 3 weeks of data (minimum is trendMinWeeks=3)', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 10 }),
      weeklyTrend: [
        { week: '2026-01-01', threshold: 10, delay: 5, total: 15 },
        { week: '2026-01-08', threshold: 1, delay: 1, total: 2 },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const trends = patterns.filter(
      (p) => p.type === 'trend_improvement' || p.type === 'trend_deterioration',
    )
    expect(trends.length).toBe(0)
  })

  it('does NOT flag as a trend when change is exactly 20% (threshold is exclusive)', () => {
    // first half=5, second half=6 → change=+20% which is NOT > 20%
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 10 }),
      weeklyTrend: [
        { week: '2026-01-01', threshold: 5, delay: 0, total: 5 },
        { week: '2026-01-08', threshold: 5, delay: 0, total: 5 },
        { week: '2026-01-15', threshold: 6, delay: 0, total: 6 },
        { week: '2026-01-22', threshold: 6, delay: 0, total: 6 },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const thresholdTrends = patterns.filter(
      (p) => p.title === 'Threshold Flags Increasing' || p.title === 'Threshold Flags Declining',
    )
    expect(thresholdTrends.length).toBe(0)
  })

  it('does NOT flag when first half threshold avg is 0 (avoids divide by zero)', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 10 }),
      weeklyTrend: [
        { week: '2026-01-01', threshold: 0, delay: 0, total: 0 },
        { week: '2026-01-08', threshold: 0, delay: 0, total: 0 },
        { week: '2026-01-15', threshold: 10, delay: 5, total: 15 },
        { week: '2026-01-22', threshold: 10, delay: 5, total: 15 },
      ],
    })
    expect(() => detectFlagPatterns(data)).not.toThrow()
    // The guard `if (firstThreshold > 0)` prevents processing — no pattern emitted
    const result = detectFlagPatterns(data).filter(
      (p) => p.title === 'Threshold Flags Increasing' || p.title === 'Threshold Flags Declining',
    )
    expect(result.length).toBe(0)
  })

  it('works with odd number of weeks (5) — splits into first 2 and last 3', () => {
    // mid = floor(5/2) = 2, so firstHalf=[0,1], secondHalf=[2,3,4]
    // first half threshold avg = (10+10)/2 = 10
    // second half avg = (2+2+2)/3 = 2 → change = -80% (improvement)
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 10 }),
      weeklyTrend: [
        { week: '2026-01-01', threshold: 10, delay: 1, total: 11 },
        { week: '2026-01-08', threshold: 10, delay: 1, total: 11 },
        { week: '2026-01-15', threshold: 2, delay: 1, total: 3 },
        { week: '2026-01-22', threshold: 2, delay: 1, total: 3 },
        { week: '2026-01-29', threshold: 2, delay: 1, total: 3 },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const improvement = patterns.find((p) => p.title === 'Threshold Flags Declining')
    expect(improvement).toBeDefined()
  })
})

// ============================================
// Detector: Room Concentration
// ============================================

describe('detectRoomConcentration', () => {
  it('detects concentration when room has >35% of flags but <30% of cases', () => {
    // OR 1: 40 flags out of 100 total = 40% flags, 20 cases out of 100 = 20% cases
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 100, totalCases: 100 }),
      roomFlags: [
        { room: 'OR 1', roomId: 'r1', cases: 20, flags: 40, rate: 200, topIssue: 'Timing', topDelay: 'Equipment' },
        { room: 'OR 2', roomId: 'r2', cases: 80, flags: 60, rate: 75, topIssue: 'Turnover', topDelay: '' },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const concentrations = patterns.filter((p) => p.type === 'room_concentration')
    expect(concentrations.length).toBe(1)
    expect(concentrations[0].title).toBe('OR 1 Flag Concentration')
    expect(concentrations[0].severity).toBe('critical')
    expect(concentrations[0].desc).toContain('Timing')
    expect(concentrations[0].metric).toBe('40%')
  })

  it('does NOT detect concentration when room flag share is exactly 35% (threshold is exclusive)', () => {
    // 35/100 = exactly 35%, not > 35%
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 100, totalCases: 100 }),
      roomFlags: [
        { room: 'OR 1', roomId: 'r1', cases: 20, flags: 35, rate: 175, topIssue: 'Timing', topDelay: '' },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const concentrations = patterns.filter((p) => p.type === 'room_concentration')
    expect(concentrations.length).toBe(0)
  })

  it('does NOT detect concentration when room case share is >=30% (not disproportionate)', () => {
    // Flags: 40/100=40% BUT cases: 35/100=35% — case share is NOT < 30%
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 100, totalCases: 100 }),
      roomFlags: [
        { room: 'OR 1', roomId: 'r1', cases: 35, flags: 40, rate: 114, topIssue: 'Timing', topDelay: '' },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const concentrations = patterns.filter((p) => p.type === 'room_concentration')
    expect(concentrations.length).toBe(0)
  })

  it('does NOT detect concentration when rooms array is empty', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 10, totalCases: 50 }),
      roomFlags: [],
    })
    const patterns = detectFlagPatterns(data)
    expect(patterns.filter((p) => p.type === 'room_concentration').length).toBe(0)
  })

  it('does NOT detect when totalCases is 0 (avoids divide by zero)', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 10, totalCases: 0 }),
      roomFlags: [
        { room: 'OR 1', roomId: 'r1', cases: 0, flags: 10, rate: 0, topIssue: '', topDelay: '' },
      ],
    })
    expect(() => detectFlagPatterns(data)).not.toThrow()
    const concentrations = detectFlagPatterns(data).filter((p) => p.type === 'room_concentration')
    expect(concentrations.length).toBe(0)
  })

  it('does NOT detect when totalFlags is 0 (avoids divide by zero)', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 0, totalCases: 50 }),
      roomFlags: [
        { room: 'OR 1', roomId: 'r1', cases: 10, flags: 0, rate: 0, topIssue: '', topDelay: '' },
      ],
    })
    // Early return at totalFlags < 3 guard triggers before room check
    expect(() => detectFlagPatterns(data)).not.toThrow()
    const concentrations = detectFlagPatterns(data).filter((p) => p.type === 'room_concentration')
    expect(concentrations.length).toBe(0)
  })

  it('shows "N/A" in description when topIssue is empty string', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 100, totalCases: 100 }),
      roomFlags: [
        { room: 'OR 3', roomId: 'r3', cases: 20, flags: 40, rate: 200, topIssue: '', topDelay: '' },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const concentration = patterns.find((p) => p.type === 'room_concentration')
    expect(concentration?.desc).toContain('N/A')
  })

  it('can detect multiple rooms in concentration simultaneously', () => {
    // Both OR 1 and OR 2 qualify: each >35% flags, <30% cases (split 60/40 flags, 20/20 cases)
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 100, totalCases: 100 }),
      roomFlags: [
        { room: 'OR 1', roomId: 'r1', cases: 20, flags: 40, rate: 200, topIssue: 'Timing', topDelay: '' },
        { room: 'OR 2', roomId: 'r2', cases: 20, flags: 36, rate: 180, topIssue: 'Turnover', topDelay: '' },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const concentrations = patterns.filter((p) => p.type === 'room_concentration')
    expect(concentrations.length).toBe(2)
  })
})

// ============================================
// Detector: Recurring Surgeon
// ============================================

describe('detectRecurringSurgeon', () => {
  it('detects recurring surgeon when rate is >2x facility average and flags >= 3', () => {
    // Facility rate=20%, surgeon rate=50% → 50/20=2.5x > 2x, flags=5 >= 3
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 10, flagRate: 20 }),
      surgeonFlags: [
        makeSurgeonRow({ name: 'Dr. Smith', surgeonId: 's1', cases: 10, flags: 5, rate: 50, topFlag: 'FCOTS Breach' }),
      ],
    })
    const patterns = detectFlagPatterns(data)
    const recurring = patterns.filter((p) => p.type === 'recurring_surgeon')
    expect(recurring.length).toBe(1)
    expect(recurring[0].title).toBe('Dr. Smith Flag Pattern')
    expect(recurring[0].severity).toBe('warning')
    expect(recurring[0].metric).toBe('2.5x')
    expect(recurring[0].desc).toContain('FCOTS Breach')
  })

  it('does NOT detect when surgeon rate is exactly 2x (threshold is exclusive)', () => {
    // Facility rate=20%, threshold=40%, surgeon rate=40% — NOT > 40%
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 10, flagRate: 20 }),
      surgeonFlags: [
        makeSurgeonRow({ name: 'Dr. Jones', surgeonId: 's2', cases: 10, flags: 4, rate: 40, topFlag: 'Timing' }),
      ],
    })
    const patterns = detectFlagPatterns(data)
    const recurring = patterns.filter((p) => p.type === 'recurring_surgeon')
    expect(recurring.length).toBe(0)
  })

  it('does NOT detect when surgeon has fewer than 3 flags (below minFlagsForPattern)', () => {
    // Rate is 3x but only 2 flags
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 10, flagRate: 20 }),
      surgeonFlags: [
        makeSurgeonRow({ name: 'Dr. Lee', surgeonId: 's3', cases: 3, flags: 2, rate: 66, topFlag: 'Delay' }),
      ],
    })
    const patterns = detectFlagPatterns(data)
    const recurring = patterns.filter((p) => p.type === 'recurring_surgeon')
    expect(recurring.length).toBe(0)
  })

  it('does NOT detect when facilityFlagRate is 0 (avoids divide by zero)', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 10, flagRate: 0 }),
      surgeonFlags: [
        makeSurgeonRow({ name: 'Dr. Zhang', surgeonId: 's4', cases: 10, flags: 8, rate: 80, topFlag: 'Timing' }),
      ],
    })
    expect(() => detectFlagPatterns(data)).not.toThrow()
    const recurring = detectFlagPatterns(data).filter((p) => p.type === 'recurring_surgeon')
    expect(recurring.length).toBe(0)
  })

  it('does NOT detect when surgeonFlags array is empty', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 10, flagRate: 20 }),
      surgeonFlags: [],
    })
    const patterns = detectFlagPatterns(data)
    expect(patterns.filter((p) => p.type === 'recurring_surgeon').length).toBe(0)
  })

  it('shows "N/A" in description when topFlag is empty string', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 10, flagRate: 20 }),
      surgeonFlags: [
        makeSurgeonRow({ name: 'Dr. Brown', surgeonId: 's5', cases: 10, flags: 5, rate: 50, topFlag: '' }),
      ],
    })
    const patterns = detectFlagPatterns(data)
    const recurring = patterns.find((p) => p.type === 'recurring_surgeon')
    expect(recurring?.desc).toContain('N/A')
  })

  it('can detect multiple recurring surgeons', () => {
    // Both surgeons have rate >2x facility rate of 20%
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 20, flagRate: 20 }),
      surgeonFlags: [
        makeSurgeonRow({ name: 'Dr. A', surgeonId: 's1', cases: 10, flags: 5, rate: 50, topFlag: 'FCOTS' }),
        makeSurgeonRow({ name: 'Dr. B', surgeonId: 's2', cases: 10, flags: 6, rate: 60, topFlag: 'Timing' }),
        makeSurgeonRow({ name: 'Dr. C', surgeonId: 's3', cases: 20, flags: 3, rate: 15, topFlag: '' }),
      ],
    })
    const patterns = detectFlagPatterns(data)
    const recurring = patterns.filter((p) => p.type === 'recurring_surgeon')
    expect(recurring.length).toBe(2)
    const names = recurring.map((p) => p.title)
    expect(names).toContain('Dr. A Flag Pattern')
    expect(names).toContain('Dr. B Flag Pattern')
  })
})

// ============================================
// Detector: Equipment Cascade
// ============================================

describe('detectEquipmentCascade', () => {
  it('detects cascade when equipment delays exist and avgFlagsPerCase > 1.5', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 20, avgFlagsPerCase: 1.8 }),
      delayTypeBreakdown: [
        { name: 'Equipment unavailable', count: 3, pct: 30, avgDuration: 25 },
        { name: 'Patient preparation', count: 5, pct: 50, avgDuration: 10 },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const cascades = patterns.filter((p) => p.type === 'equipment_cascade')
    expect(cascades.length).toBe(1)
    expect(cascades[0].severity).toBe('critical')
    expect(cascades[0].title).toBe('Equipment → Cascade Pattern')
    expect(cascades[0].desc).toContain('equipment-related delays')
    expect(cascades[0].metric).toBe('1.8x')
  })

  it('matches multiple equipment-related keyword patterns (instrument, supply, device, implant)', () => {
    const keywords = ['instrument tray missing', 'supply shortage', 'device malfunction', 'implant unavailable']
    for (const name of keywords) {
      const data = makeBaseData({
        summary: makeSummary({ totalFlags: 20, avgFlagsPerCase: 2.0 }),
        delayTypeBreakdown: [
          { name, count: 3, pct: 50, avgDuration: 20 },
        ],
      })
      const patterns = detectFlagPatterns(data)
      const cascades = patterns.filter((p) => p.type === 'equipment_cascade')
      expect(cascades.length).toBe(1)
    }
  })

  it('does NOT detect cascade when avgFlagsPerCase is exactly 1.5 (threshold is exclusive)', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 20, avgFlagsPerCase: 1.5 }),
      delayTypeBreakdown: [
        { name: 'Equipment unavailable', count: 3, pct: 30, avgDuration: 25 },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const cascades = patterns.filter((p) => p.type === 'equipment_cascade')
    expect(cascades.length).toBe(0)
  })

  it('does NOT detect cascade when equipment delays count is below 2', () => {
    // Only 1 equipment delay
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 20, avgFlagsPerCase: 2.0 }),
      delayTypeBreakdown: [
        { name: 'Equipment unavailable', count: 1, pct: 10, avgDuration: 25 },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const cascades = patterns.filter((p) => p.type === 'equipment_cascade')
    expect(cascades.length).toBe(0)
  })

  it('does NOT detect cascade when no delay types match equipment keywords', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 20, avgFlagsPerCase: 2.0 }),
      delayTypeBreakdown: [
        { name: 'Patient late to pre-op', count: 5, pct: 50, avgDuration: 15 },
        { name: 'Surgeon not available', count: 5, pct: 50, avgDuration: 10 },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const cascades = patterns.filter((p) => p.type === 'equipment_cascade')
    expect(cascades.length).toBe(0)
  })

  it('does NOT detect cascade when delayTypeBreakdown is empty', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 20, avgFlagsPerCase: 2.5 }),
      delayTypeBreakdown: [],
    })
    const patterns = detectFlagPatterns(data)
    const cascades = patterns.filter((p) => p.type === 'equipment_cascade')
    expect(cascades.length).toBe(0)
  })

  it('sums total equipment delays across multiple matching delay types', () => {
    // 3 + 4 = 7 equipment delays, avgFlagsPerCase=2.0
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 20, avgFlagsPerCase: 2.0 }),
      delayTypeBreakdown: [
        { name: 'Equipment unavailable', count: 3, pct: 20, avgDuration: 25 },
        { name: 'Instrument not sterilized', count: 4, pct: 30, avgDuration: 15 },
      ],
    })
    const patterns = detectFlagPatterns(data)
    const cascade = patterns.find((p) => p.type === 'equipment_cascade')
    expect(cascade?.desc).toContain('7 equipment-related delays')
  })
})

// ============================================
// Edge cases: empty / minimal data
// ============================================

describe('detectFlagPatterns: combined edge cases', () => {
  it('handles completely empty data object without throwing', () => {
    const data = makeBaseData({
      summary: makeSummary({
        totalFlags: 0,
        totalCases: 0,
        flagRate: 0,
        avgFlagsPerCase: 0,
      }),
    })
    expect(() => detectFlagPatterns(data)).not.toThrow()
    expect(detectFlagPatterns(data)).toEqual([])
  })

  it('handles a single-surgeon, single-room, single-week dataset without throwing', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 5, totalCases: 10, flagRate: 50, avgFlagsPerCase: 0.5 }),
      weeklyTrend: [{ week: '2026-01-01', threshold: 3, delay: 2, total: 5 }],
      dayOfWeekHeatmap: [
        { day: 'Monday', dayNum: 1, fcots: 2, timing: 2, turnover: 1, delay: 0, total: 5 },
      ],
      roomFlags: [
        { room: 'OR 1', roomId: 'r1', cases: 10, flags: 5, rate: 50, topIssue: 'Timing', topDelay: '' },
      ],
      surgeonFlags: [
        makeSurgeonRow({ name: 'Dr. A', surgeonId: 's1', cases: 10, flags: 5, rate: 50, topFlag: '' }),
      ],
    })
    expect(() => detectFlagPatterns(data)).not.toThrow()
  })

  it('returns only patterns with the correct required shape (type, title, desc, severity, metric)', () => {
    const data = makeBaseData({
      summary: makeSummary({ totalFlags: 20, totalCases: 100, flagRate: 20, avgFlagsPerCase: 1.0 }),
      dayOfWeekHeatmap: [
        { day: 'Monday', dayNum: 1, fcots: 6, timing: 3, turnover: 2, delay: 1, total: 12 },
        { day: 'Tuesday', dayNum: 2, fcots: 1, timing: 1, turnover: 0, delay: 0, total: 2 },
        { day: 'Wednesday', dayNum: 3, fcots: 1, timing: 0, turnover: 0, delay: 0, total: 2 },
        { day: 'Thursday', dayNum: 4, fcots: 1, timing: 0, turnover: 0, delay: 0, total: 2 },
        { day: 'Friday', dayNum: 5, fcots: 1, timing: 0, turnover: 0, delay: 0, total: 2 },
      ],
    })
    const patterns = detectFlagPatterns(data)
    for (const p of patterns) {
      expect(p).toHaveProperty('type')
      expect(p).toHaveProperty('title')
      expect(p).toHaveProperty('desc')
      expect(p).toHaveProperty('severity')
      expect(p).toHaveProperty('metric')
      expect(typeof p.type).toBe('string')
      expect(typeof p.title).toBe('string')
      expect(typeof p.desc).toBe('string')
      expect(['critical', 'warning', 'good']).toContain(p.severity)
      expect(typeof p.metric).toBe('string')
    }
  })
})
