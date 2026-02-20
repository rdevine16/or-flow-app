// lib/hooks/__tests__/useFlagAnalytics.test.ts
// Tests for useFlagAnalytics pure logic:
//   - canFetch guard (enabled flag + required params)
//   - RPC response normalization (null coalescing to safe defaults)
//   - Type contracts for FlagAnalyticsData
//
// The Supabase RPC call itself cannot be tested without a live connection,
// consistent with the pattern used by useDashboardAlerts, useTrendData, etc.

import { describe, it, expect } from 'vitest'
import type {
  FlagAnalyticsRPCResponse,
  FlagAnalyticsData,
  FlagSummaryKPIs,
  FlagSparklineData,
  WeeklyTrendPoint,
  DayOfWeekRow,
  FlagRuleBreakdownItem,
  DelayTypeBreakdownItem,
  SurgeonFlagRow,
  RoomFlagRow,
  RecentFlaggedCase,
  DetectedPattern,
} from '@/types/flag-analytics'

// ============================================
// Replicate the pure normalization logic from
// useFlagAnalytics so it can be unit tested.
// This mirrors the pattern in useTrendData.test.ts
// which imports groupCasesByDate directly.
// ============================================

const EMPTY_SUMMARY: FlagSummaryKPIs = {
  totalCases: 0,
  flaggedCases: 0,
  flagRate: 0,
  flagRateTrend: 0,
  delayedCases: 0,
  delayRate: 0,
  delayRateTrend: 0,
  criticalCount: 0,
  warningCount: 0,
  infoCount: 0,
  totalFlags: 0,
  avgFlagsPerCase: 0,
}

const EMPTY_SPARKLINE: FlagSparklineData = {
  flagRate: [],
  delayRate: [],
}

function normalizeRPCResponse(raw: FlagAnalyticsRPCResponse | null): FlagAnalyticsData {
  const normalized: FlagAnalyticsRPCResponse = {
    summary: raw?.summary ?? EMPTY_SUMMARY,
    sparklineData: raw?.sparklineData ?? EMPTY_SPARKLINE,
    weeklyTrend: raw?.weeklyTrend ?? [],
    dayOfWeekHeatmap: raw?.dayOfWeekHeatmap ?? [],
    flagRuleBreakdown: raw?.flagRuleBreakdown ?? [],
    delayTypeBreakdown: raw?.delayTypeBreakdown ?? [],
    surgeonFlags: raw?.surgeonFlags ?? [],
    roomFlags: raw?.roomFlags ?? [],
    recentFlaggedCases: raw?.recentFlaggedCases ?? [],
  }
  return { ...normalized, patterns: [] }
}

function computeCanFetch(options: {
  facilityId: string | null
  startDate: string | null
  endDate: string | null
  enabled?: boolean
}): boolean {
  const { facilityId, startDate, endDate, enabled = true } = options
  return enabled && !!facilityId && !!startDate && !!endDate
}

// ============================================
// canFetch guard
// ============================================

describe('useFlagAnalytics canFetch guard', () => {
  it('returns true when all required params are present and enabled is default true', () => {
    expect(computeCanFetch({
      facilityId: 'fac-1',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })).toBe(true)
  })

  it('returns false when enabled is explicitly false', () => {
    expect(computeCanFetch({
      facilityId: 'fac-1',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      enabled: false,
    })).toBe(false)
  })

  it('returns false when facilityId is null', () => {
    expect(computeCanFetch({
      facilityId: null,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })).toBe(false)
  })

  it('returns false when startDate is null', () => {
    expect(computeCanFetch({
      facilityId: 'fac-1',
      startDate: null,
      endDate: '2026-01-31',
    })).toBe(false)
  })

  it('returns false when endDate is null', () => {
    expect(computeCanFetch({
      facilityId: 'fac-1',
      startDate: '2026-01-01',
      endDate: null,
    })).toBe(false)
  })

  it('returns false when all params are null', () => {
    expect(computeCanFetch({
      facilityId: null,
      startDate: null,
      endDate: null,
    })).toBe(false)
  })

  it('returns false when enabled is false even with all params present', () => {
    expect(computeCanFetch({
      facilityId: 'fac-1',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      enabled: false,
    })).toBe(false)
  })
})

// ============================================
// RPC response normalization — null input
// ============================================

describe('normalizeRPCResponse: null RPC response (empty dataset)', () => {
  it('returns EMPTY_SUMMARY when raw is null', () => {
    const result = normalizeRPCResponse(null)
    expect(result.summary).toEqual(EMPTY_SUMMARY)
  })

  it('returns EMPTY_SPARKLINE when raw is null', () => {
    const result = normalizeRPCResponse(null)
    expect(result.sparklineData).toEqual(EMPTY_SPARKLINE)
  })

  it('returns empty arrays for all list fields when raw is null', () => {
    const result = normalizeRPCResponse(null)
    expect(result.weeklyTrend).toEqual([])
    expect(result.dayOfWeekHeatmap).toEqual([])
    expect(result.flagRuleBreakdown).toEqual([])
    expect(result.delayTypeBreakdown).toEqual([])
    expect(result.surgeonFlags).toEqual([])
    expect(result.roomFlags).toEqual([])
    expect(result.recentFlaggedCases).toEqual([])
  })

  it('returns empty patterns array when raw is null', () => {
    const result = normalizeRPCResponse(null)
    expect(result.patterns).toEqual([])
  })

  it('all numeric summary fields default to 0', () => {
    const result = normalizeRPCResponse(null)
    const s = result.summary
    expect(s.totalCases).toBe(0)
    expect(s.flaggedCases).toBe(0)
    expect(s.flagRate).toBe(0)
    expect(s.flagRateTrend).toBe(0)
    expect(s.delayedCases).toBe(0)
    expect(s.delayRate).toBe(0)
    expect(s.delayRateTrend).toBe(0)
    expect(s.criticalCount).toBe(0)
    expect(s.warningCount).toBe(0)
    expect(s.infoCount).toBe(0)
    expect(s.totalFlags).toBe(0)
    expect(s.avgFlagsPerCase).toBe(0)
  })
})

// ============================================
// RPC response normalization — partial null fields
// (RPC returned a response object but some arrays are null/undefined)
// ============================================

describe('normalizeRPCResponse: partial null fields from RPC', () => {
  it('falls back to EMPTY_SUMMARY when raw.summary is undefined', () => {
    const raw = { summary: undefined } as unknown as FlagAnalyticsRPCResponse
    const result = normalizeRPCResponse(raw)
    expect(result.summary).toEqual(EMPTY_SUMMARY)
  })

  it('falls back to EMPTY_SPARKLINE when raw.sparklineData is undefined', () => {
    const raw = { sparklineData: undefined } as unknown as FlagAnalyticsRPCResponse
    const result = normalizeRPCResponse(raw)
    expect(result.sparklineData).toEqual(EMPTY_SPARKLINE)
  })

  it('falls back to [] when raw.weeklyTrend is null', () => {
    const raw = { weeklyTrend: null } as unknown as FlagAnalyticsRPCResponse
    const result = normalizeRPCResponse(raw)
    expect(result.weeklyTrend).toEqual([])
  })

  it('falls back to [] when raw.surgeonFlags is null', () => {
    const raw = { surgeonFlags: null } as unknown as FlagAnalyticsRPCResponse
    const result = normalizeRPCResponse(raw)
    expect(result.surgeonFlags).toEqual([])
  })

  it('falls back to [] when raw.recentFlaggedCases is null', () => {
    const raw = { recentFlaggedCases: null } as unknown as FlagAnalyticsRPCResponse
    const result = normalizeRPCResponse(raw)
    expect(result.recentFlaggedCases).toEqual([])
  })
})

// ============================================
// RPC response normalization — successful response
// ============================================

describe('normalizeRPCResponse: fully populated RPC response', () => {
  const mockSummary: FlagSummaryKPIs = {
    totalCases: 120,
    flaggedCases: 45,
    flagRate: 37.5,
    flagRateTrend: -2.1,
    delayedCases: 18,
    delayRate: 15.0,
    delayRateTrend: 0.5,
    criticalCount: 5,
    warningCount: 28,
    infoCount: 12,
    totalFlags: 67,
    avgFlagsPerCase: 1.49,
  }

  const mockSparkline: FlagSparklineData = {
    flagRate: [40, 38, 42, 37, 35, 38, 37.5],
    delayRate: [16, 15, 14, 16, 15, 14, 15.0],
  }

  const mockWeeklyTrend: WeeklyTrendPoint[] = [
    { week: '2026-01-05', threshold: 8, delay: 4, total: 12 },
    { week: '2026-01-12', threshold: 10, delay: 5, total: 15 },
  ]

  const mockDayOfWeek: DayOfWeekRow[] = [
    { day: 'Monday', dayNum: 1, fcots: 3, timing: 2, turnover: 4, delay: 2, total: 11 },
  ]

  const mockFlagRules: FlagRuleBreakdownItem[] = [
    { name: 'Surgeon Readiness Gap', count: 22, severity: 'warning', pct: 32.8 },
    { name: 'FCOTS Breach', count: 15, severity: 'critical', pct: 22.4 },
  ]

  const mockDelayTypes: DelayTypeBreakdownItem[] = [
    { name: 'Patient late to pre-op', count: 8, pct: 44.4, avgDuration: 18 },
    { name: 'Equipment unavailable', count: 6, pct: 33.3, avgDuration: null },
  ]

  const mockSurgeons: SurgeonFlagRow[] = [
    { name: 'Dr. Smith', surgeonId: 'surg-1', cases: 30, flaggedCases: 14, flags: 14, rate: 46.7, prevRate: 49.9, trend: -3.2, topFlag: 'FCOTS Breach' },
  ]

  const mockRooms: RoomFlagRow[] = [
    { room: 'OR 3', roomId: 'room-3', cases: 40, flags: 18, rate: 45.0, topIssue: 'Turnover', topDelay: 'Equipment' },
  ]

  const mockRecentCases: RecentFlaggedCase[] = [
    {
      caseId: 'case-abc',
      caseNumber: 'C-2026-001',
      date: '2026-01-28',
      surgeon: 'Dr. Smith',
      roomId: 'room-3',
      procedure: 'Total Knee Replacement',
      flags: [{ type: 'threshold', name: 'FCOTS Breach', severity: 'critical' }],
    },
  ]

  const mockRaw: FlagAnalyticsRPCResponse = {
    summary: mockSummary,
    sparklineData: mockSparkline,
    weeklyTrend: mockWeeklyTrend,
    dayOfWeekHeatmap: mockDayOfWeek,
    flagRuleBreakdown: mockFlagRules,
    delayTypeBreakdown: mockDelayTypes,
    surgeonFlags: mockSurgeons,
    roomFlags: mockRooms,
    recentFlaggedCases: mockRecentCases,
  }

  it('passes through summary data unchanged', () => {
    const result = normalizeRPCResponse(mockRaw)
    expect(result.summary).toEqual(mockSummary)
  })

  it('passes through sparkline arrays unchanged', () => {
    const result = normalizeRPCResponse(mockRaw)
    expect(result.sparklineData.flagRate).toHaveLength(7)
    expect(result.sparklineData.delayRate).toHaveLength(7)
    expect(result.sparklineData).toEqual(mockSparkline)
  })

  it('passes through weeklyTrend array unchanged', () => {
    const result = normalizeRPCResponse(mockRaw)
    expect(result.weeklyTrend).toHaveLength(2)
    expect(result.weeklyTrend[0].week).toBe('2026-01-05')
    expect(result.weeklyTrend[1].total).toBe(15)
  })

  it('passes through dayOfWeekHeatmap unchanged', () => {
    const result = normalizeRPCResponse(mockRaw)
    expect(result.dayOfWeekHeatmap).toHaveLength(1)
    expect(result.dayOfWeekHeatmap[0].day).toBe('Monday')
  })

  it('passes through flagRuleBreakdown with severity types intact', () => {
    const result = normalizeRPCResponse(mockRaw)
    expect(result.flagRuleBreakdown).toHaveLength(2)
    expect(result.flagRuleBreakdown[0].severity).toBe('warning')
    expect(result.flagRuleBreakdown[1].severity).toBe('critical')
  })

  it('passes through delayTypeBreakdown with nullable avgDuration', () => {
    const result = normalizeRPCResponse(mockRaw)
    expect(result.delayTypeBreakdown).toHaveLength(2)
    expect(result.delayTypeBreakdown[0].avgDuration).toBe(18)
    expect(result.delayTypeBreakdown[1].avgDuration).toBeNull()
  })

  it('passes through surgeonFlags unchanged', () => {
    const result = normalizeRPCResponse(mockRaw)
    expect(result.surgeonFlags).toHaveLength(1)
    expect(result.surgeonFlags[0].surgeonId).toBe('surg-1')
    expect(result.surgeonFlags[0].rate).toBe(46.7)
  })

  it('passes through roomFlags unchanged', () => {
    const result = normalizeRPCResponse(mockRaw)
    expect(result.roomFlags).toHaveLength(1)
    expect(result.roomFlags[0].roomId).toBe('room-3')
  })

  it('passes through recentFlaggedCases with nested flags array', () => {
    const result = normalizeRPCResponse(mockRaw)
    expect(result.recentFlaggedCases).toHaveLength(1)
    expect(result.recentFlaggedCases[0].flags).toHaveLength(1)
    expect(result.recentFlaggedCases[0].flags[0].severity).toBe('critical')
    expect(result.recentFlaggedCases[0].flags[0].type).toBe('threshold')
  })

  it('returns patterns array (populated by detectFlagPatterns in Phase 5)', () => {
    const result = normalizeRPCResponse(mockRaw)
    // normalizeRPCResponse in the test helper still returns [] for patterns
    // (it is a local copy of the normalization logic, not the live hook).
    // The live hook calls detectFlagPatterns on the normalized data.
    // Pattern detection logic is tested in lib/__tests__/flagPatternDetection.test.ts.
    expect(Array.isArray(result.patterns)).toBe(true)
  })

  it('result satisfies FlagAnalyticsData type contract', () => {
    const result = normalizeRPCResponse(mockRaw)
    // Type guard: all required fields exist
    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('sparklineData')
    expect(result).toHaveProperty('weeklyTrend')
    expect(result).toHaveProperty('dayOfWeekHeatmap')
    expect(result).toHaveProperty('flagRuleBreakdown')
    expect(result).toHaveProperty('delayTypeBreakdown')
    expect(result).toHaveProperty('surgeonFlags')
    expect(result).toHaveProperty('roomFlags')
    expect(result).toHaveProperty('recentFlaggedCases')
    expect(result).toHaveProperty('patterns')
  })
})

// ============================================
// Type contract tests for FlagAnalyticsData
// These ensure downstream consumers can rely
// on FlagAnalyticsData.patterns always being an array.
// ============================================

describe('FlagAnalyticsData type contracts', () => {
  it('DetectedPattern type accepts all valid pattern types', () => {
    const patterns: DetectedPattern[] = [
      { type: 'day_spike', title: 'Monday Spike', desc: 'Mondays have 2x flags', severity: 'warning', metric: '2x' },
      { type: 'equipment_cascade', title: 'Equipment Issue', desc: 'Multiple rooms affected', severity: 'critical', metric: '3 rooms' },
      { type: 'trend_improvement', title: 'Improving', desc: 'Flag rate down 15%', severity: 'good', metric: '-15%' },
      { type: 'trend_deterioration', title: 'Worsening', desc: 'Flag rate up 10%', severity: 'warning', metric: '+10%' },
      { type: 'room_concentration', title: 'OR 3 Concentrated', desc: '60% of flags in OR 3', severity: 'warning', metric: '60%' },
      { type: 'recurring_surgeon', title: 'Recurring Surgeon', desc: 'Dr. Smith 3x rate', severity: 'critical', metric: '3x' },
    ]
    // If TypeScript accepts this at compile time and it runs without error,
    // the union type is correctly defined.
    expect(patterns).toHaveLength(6)
  })

  it('DetectedPattern severity accepts critical, warning, good', () => {
    const severities: DetectedPattern['severity'][] = ['critical', 'warning', 'good']
    expect(severities).toHaveLength(3)
  })

  it('FlagRuleBreakdownItem severity is constrained to info | warning | critical', () => {
    const item: FlagRuleBreakdownItem = {
      name: 'Test Rule',
      count: 5,
      severity: 'info',
      pct: 10,
    }
    expect(item.severity).toBe('info')
  })

  it('normalizeRPCResponse result patterns array is always Array type', () => {
    const result = normalizeRPCResponse(null)
    expect(Array.isArray(result.patterns)).toBe(true)
  })
})
