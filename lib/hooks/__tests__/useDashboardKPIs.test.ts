import { describe, it, expect } from 'vitest'
import { mapRowToConfig } from '@/lib/hooks/useAnalyticsConfig'
import { ANALYTICS_CONFIG_DEFAULTS } from '@/lib/analyticsV2'
import {
  calculateFCOTS,
  calculateTurnoverTime,
  calculateORUtilization,
  calculateCancellationRate,
  type CaseWithMilestones,
  type FacilityAnalyticsConfig,
} from '@/lib/analyticsV2'

// ============================================
// Date range helper logic (original tests)
// Replicated inline since getDateRanges is not exported.
// ============================================

function getLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type TimeRange = 'today' | 'week' | 'month'

interface DateRangePair {
  current: { start: string; end: string }
  previous: { start: string; end: string }
}

function getDateRanges(timeRange: TimeRange, referenceDate: Date = new Date()): DateRangePair {
  const today = referenceDate
  const todayStr = getLocalDateString(today)

  switch (timeRange) {
    case 'today': {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return {
        current: { start: todayStr, end: todayStr },
        previous: { start: getLocalDateString(yesterday), end: getLocalDateString(yesterday) },
      }
    }
    case 'week': {
      const dayOfWeek = today.getDay()
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const monday = new Date(today)
      monday.setDate(today.getDate() - mondayOffset)

      const prevMonday = new Date(monday)
      prevMonday.setDate(monday.getDate() - 7)
      const prevSunday = new Date(monday)
      prevSunday.setDate(monday.getDate() - 1)

      return {
        current: { start: getLocalDateString(monday), end: todayStr },
        previous: { start: getLocalDateString(prevMonday), end: getLocalDateString(prevSunday) },
      }
    }
    case 'month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

      const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
      const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1)

      return {
        current: { start: getLocalDateString(monthStart), end: todayStr },
        previous: { start: getLocalDateString(prevMonthStart), end: getLocalDateString(prevMonthEnd) },
      }
    }
  }
}

describe('getDateRanges', () => {
  it('today: returns current day and yesterday', () => {
    // Wednesday Feb 12, 2025
    const ref = new Date(2025, 1, 12) // month is 0-indexed
    const ranges = getDateRanges('today', ref)

    expect(ranges.current.start).toBe('2025-02-12')
    expect(ranges.current.end).toBe('2025-02-12')
    expect(ranges.previous.start).toBe('2025-02-11')
    expect(ranges.previous.end).toBe('2025-02-11')
  })

  it('week: returns Monday-today and prior week', () => {
    // Wednesday Feb 12, 2025 (Wednesday)
    const ref = new Date(2025, 1, 12)
    const ranges = getDateRanges('week', ref)

    expect(ranges.current.start).toBe('2025-02-10') // Monday
    expect(ranges.current.end).toBe('2025-02-12')   // Today (Wed)
    expect(ranges.previous.start).toBe('2025-02-03') // Prev Monday
    expect(ranges.previous.end).toBe('2025-02-09')   // Prev Sunday
  })

  it('week: handles Sunday correctly (goes to prior Monday)', () => {
    // Sunday Feb 16, 2025
    const ref = new Date(2025, 1, 16)
    const ranges = getDateRanges('week', ref)

    expect(ranges.current.start).toBe('2025-02-10') // Monday of this week
    expect(ranges.current.end).toBe('2025-02-16')   // Sunday
  })

  it('week: handles Monday correctly (week starts today)', () => {
    // Monday Feb 10, 2025
    const ref = new Date(2025, 1, 10)
    const ranges = getDateRanges('week', ref)

    expect(ranges.current.start).toBe('2025-02-10')
    expect(ranges.current.end).toBe('2025-02-10')
    expect(ranges.previous.start).toBe('2025-02-03')
    expect(ranges.previous.end).toBe('2025-02-09')
  })

  it('month: returns 1st of month through today', () => {
    // Feb 15, 2025
    const ref = new Date(2025, 1, 15)
    const ranges = getDateRanges('month', ref)

    expect(ranges.current.start).toBe('2025-02-01')
    expect(ranges.current.end).toBe('2025-02-15')
    expect(ranges.previous.start).toBe('2025-01-01')
    expect(ranges.previous.end).toBe('2025-01-31')
  })

  it('month: handles January (previous month is December prior year)', () => {
    // Jan 20, 2025
    const ref = new Date(2025, 0, 20)
    const ranges = getDateRanges('month', ref)

    expect(ranges.current.start).toBe('2025-01-01')
    expect(ranges.current.end).toBe('2025-01-20')
    expect(ranges.previous.start).toBe('2024-12-01')
    expect(ranges.previous.end).toBe('2024-12-31')
  })

  it('month: handles first day of month', () => {
    // Mar 1, 2025
    const ref = new Date(2025, 2, 1)
    const ranges = getDateRanges('month', ref)

    expect(ranges.current.start).toBe('2025-03-01')
    expect(ranges.current.end).toBe('2025-03-01')
    expect(ranges.previous.start).toBe('2025-02-01')
    expect(ranges.previous.end).toBe('2025-02-28')
  })
})

// ============================================
// Phase 4: mapRowToConfig — config-building logic
// Tests that useDashboardKPIs correctly builds FacilityAnalyticsConfig
// from the DB row (facility_analytics_settings + or_hourly_rate).
// ============================================

describe('mapRowToConfig: builds FacilityAnalyticsConfig from DB row (Phase 4)', () => {
  it('applies all defaults when row is null and orHourlyRate is null', () => {
    const config = mapRowToConfig(null, null)
    const d = ANALYTICS_CONFIG_DEFAULTS

    expect(config.fcotsTargetPercent).toBe(d.fcotsTargetPercent)
    expect(config.utilizationTargetPercent).toBe(d.utilizationTargetPercent)
    expect(config.cancellationTargetPercent).toBe(d.cancellationTargetPercent)
    expect(config.turnoverThresholdMinutes).toBe(d.turnoverThresholdMinutes)
    expect(config.operatingDaysPerYear).toBe(d.operatingDaysPerYear)
    expect(config.orHourlyRate).toBe(d.orHourlyRate)
  })

  it('uses orHourlyRate from facilities table when provided', () => {
    const config = mapRowToConfig(null, 3600)
    expect(config.orHourlyRate).toBe(3600)
  })

  it('overrides defaults with values from settings row', () => {
    const row = {
      fcots_target_percent: 90,
      utilization_target_percent: 80,
      cancellation_target_percent: 3,
      turnover_threshold_minutes: 20,
      operating_days_per_year: 300,
    }
    const config = mapRowToConfig(row, null)

    expect(config.fcotsTargetPercent).toBe(90)
    expect(config.utilizationTargetPercent).toBe(80)
    expect(config.cancellationTargetPercent).toBe(3)
    expect(config.turnoverThresholdMinutes).toBe(20)
    expect(config.operatingDaysPerYear).toBe(300)
  })

  it('merges partial row with defaults for missing fields', () => {
    // Only fcotsTargetPercent is set; everything else gets defaults
    const row = { fcots_target_percent: 95 }
    const config = mapRowToConfig(row, 2160)
    const d = ANALYTICS_CONFIG_DEFAULTS

    expect(config.fcotsTargetPercent).toBe(95)
    expect(config.utilizationTargetPercent).toBe(d.utilizationTargetPercent)  // default
    expect(config.orHourlyRate).toBe(2160)  // from facilities table
  })

  it('null orHourlyRate falls back to ANALYTICS_CONFIG_DEFAULTS.orHourlyRate', () => {
    const config = mapRowToConfig(null, null)
    expect(config.orHourlyRate).toBe(ANALYTICS_CONFIG_DEFAULTS.orHourlyRate)
  })

  it('maps fcots_milestone incision correctly', () => {
    const config = mapRowToConfig({ fcots_milestone: 'incision' }, null)
    expect(config.fcotsMilestone).toBe('incision')
  })

  it('maps unknown fcots_milestone to patient_in default', () => {
    const config = mapRowToConfig({ fcots_milestone: 'unknown_value' }, null)
    expect(config.fcotsMilestone).toBe('patient_in')
  })
})

// ============================================
// Phase 4: calculateFCOTS respects config.fcotsTargetPercent
// Verifies useDashboardKPIs correctly threads config into calculate functions.
// ============================================

const EMPTY_CASES: CaseWithMilestones[] = []

describe('calculateFCOTS: respects FacilityAnalyticsConfig from mapRowToConfig (Phase 4)', () => {
  it('uses fcotsTargetPercent from config when calling calculateFCOTS', () => {
    const configDefault: FacilityAnalyticsConfig = mapRowToConfig(null, null)
    const configCustom: FacilityAnalyticsConfig = mapRowToConfig(
      { fcots_target_percent: 90 },
      null
    )

    const resultDefault = calculateFCOTS(EMPTY_CASES, EMPTY_CASES, {
      milestone: configDefault.fcotsMilestone,
      graceMinutes: configDefault.fcotsGraceMinutes,
      targetPercent: configDefault.fcotsTargetPercent,
    })
    const resultCustom = calculateFCOTS(EMPTY_CASES, EMPTY_CASES, {
      milestone: configCustom.fcotsMilestone,
      graceMinutes: configCustom.fcotsGraceMinutes,
      targetPercent: configCustom.fcotsTargetPercent,
    })

    // With no cases, both return 0 value, but targets should differ
    expect(resultDefault.target).toBe(ANALYTICS_CONFIG_DEFAULTS.fcotsTargetPercent)
    expect(resultCustom.target).toBe(90)
  })
})

describe('calculateTurnoverTime: respects FacilityAnalyticsConfig from mapRowToConfig (Phase 4)', () => {
  it('uses turnoverComplianceTarget from config when calling calculateTurnoverTime', () => {
    // Note: calculateTurnoverTime returns target = complianceTarget (%), not thresholdMinutes.
    // The threshold is embedded in the subtitle string, not target.
    const configDefault: FacilityAnalyticsConfig = mapRowToConfig(null, null)
    const configCustom: FacilityAnalyticsConfig = mapRowToConfig(
      { turnover_compliance_target_percent: 90 },
      null
    )

    const resultDefault = calculateTurnoverTime(EMPTY_CASES, EMPTY_CASES, {
      turnoverThresholdMinutes: configDefault.turnoverThresholdMinutes,
      turnoverComplianceTarget: configDefault.turnoverComplianceTarget,
    })
    const resultCustom = calculateTurnoverTime(EMPTY_CASES, EMPTY_CASES, {
      turnoverThresholdMinutes: configCustom.turnoverThresholdMinutes,
      turnoverComplianceTarget: configCustom.turnoverComplianceTarget,
    })

    // target = complianceTarget (the % threshold), not the minutes threshold
    expect(resultDefault.target).toBe(ANALYTICS_CONFIG_DEFAULTS.turnoverComplianceTarget)
    expect(resultCustom.target).toBe(90)
  })

  it('reflects turnoverThresholdMinutes in the subtitle string', () => {
    // The threshold minutes appear in the subtitle, not target
    const config: FacilityAnalyticsConfig = mapRowToConfig(
      { turnover_threshold_minutes: 20 },
      null
    )

    const result = calculateTurnoverTime(EMPTY_CASES, EMPTY_CASES, {
      turnoverThresholdMinutes: config.turnoverThresholdMinutes,
      turnoverComplianceTarget: config.turnoverComplianceTarget,
    })

    // subtitle format: "X% under 20 min target"
    expect(result.subtitle).toContain('20 min')
  })
})

describe('calculateORUtilization: respects FacilityAnalyticsConfig from mapRowToConfig (Phase 4)', () => {
  it('uses utilizationTargetPercent from config when calling calculateORUtilization', () => {
    const configDefault: FacilityAnalyticsConfig = mapRowToConfig(null, null)
    const configCustom: FacilityAnalyticsConfig = mapRowToConfig(
      { utilization_target_percent: 80 },
      null
    )

    const resultDefault = calculateORUtilization(EMPTY_CASES, 10, EMPTY_CASES, undefined, {
      utilizationTargetPercent: configDefault.utilizationTargetPercent,
    })
    const resultCustom = calculateORUtilization(EMPTY_CASES, 10, EMPTY_CASES, undefined, {
      utilizationTargetPercent: configCustom.utilizationTargetPercent,
    })

    expect(resultDefault.target).toBe(ANALYTICS_CONFIG_DEFAULTS.utilizationTargetPercent)
    expect(resultCustom.target).toBe(80)
  })
})

describe('calculateCancellationRate: respects FacilityAnalyticsConfig from mapRowToConfig (Phase 4)', () => {
  it('uses cancellationTargetPercent from config when calling calculateCancellationRate', () => {
    const configDefault: FacilityAnalyticsConfig = mapRowToConfig(null, null)
    const configCustom: FacilityAnalyticsConfig = mapRowToConfig(
      { cancellation_target_percent: 2 },
      null
    )

    const resultDefault = calculateCancellationRate(EMPTY_CASES, EMPTY_CASES, {
      cancellationTargetPercent: configDefault.cancellationTargetPercent,
    })
    const resultCustom = calculateCancellationRate(EMPTY_CASES, EMPTY_CASES, {
      cancellationTargetPercent: configCustom.cancellationTargetPercent,
    })

    expect(resultDefault.target).toBe(ANALYTICS_CONFIG_DEFAULTS.cancellationTargetPercent)
    expect(resultCustom.target).toBe(2)
  })
})

// ============================================
// Phase 4: Config round-trip integrity
// Tests the full path: DB row → mapRowToConfig → calculate functions
// exactly as useDashboardKPIs does it.
// ============================================

describe('Phase 4 config round-trip: DB row → mapRowToConfig → calculate functions', () => {
  it('custom settings row flows correctly into all four calculate functions', () => {
    const settingsRow = {
      fcots_target_percent: 92,
      turnover_threshold_minutes: 22,
      utilization_target_percent: 82,
      cancellation_target_percent: 3,
      operating_days_per_year: 260,
      fcots_milestone: 'patient_in' as const,
      fcots_grace_minutes: 3,
      turnover_compliance_target_percent: 70,
      turnover_target_same_surgeon: 40,
      turnover_target_flip_room: 12,
      idle_combined_target_minutes: 10,
      idle_flip_target_minutes: 5,
      idle_same_room_target_minutes: 15,
      tardiness_target_minutes: 10,
      non_op_warn_minutes: 20,
      non_op_bad_minutes: 30,
    }
    const orHourlyRate = 2400 // $40/min

    const config: FacilityAnalyticsConfig = mapRowToConfig(settingsRow, orHourlyRate)

    // Config fields match the settings row
    expect(config.fcotsTargetPercent).toBe(92)
    expect(config.turnoverThresholdMinutes).toBe(22)
    expect(config.utilizationTargetPercent).toBe(82)
    expect(config.cancellationTargetPercent).toBe(3)
    expect(config.operatingDaysPerYear).toBe(260)
    expect(config.orHourlyRate).toBe(2400)

    // All four calculate functions accept the config fields without error
    expect(() => calculateFCOTS(EMPTY_CASES, EMPTY_CASES, {
      milestone: config.fcotsMilestone,
      graceMinutes: config.fcotsGraceMinutes,
      targetPercent: config.fcotsTargetPercent,
    })).not.toThrow()

    expect(() => calculateTurnoverTime(EMPTY_CASES, EMPTY_CASES, {
      turnoverThresholdMinutes: config.turnoverThresholdMinutes,
      turnoverComplianceTarget: config.turnoverComplianceTarget,
    })).not.toThrow()

    expect(() => calculateORUtilization(EMPTY_CASES, 10, EMPTY_CASES, undefined, {
      utilizationTargetPercent: config.utilizationTargetPercent,
    })).not.toThrow()

    expect(() => calculateCancellationRate(EMPTY_CASES, EMPTY_CASES, {
      cancellationTargetPercent: config.cancellationTargetPercent,
    })).not.toThrow()

    // Targets from calculate results match what was set in the settings row
    const fcots = calculateFCOTS(EMPTY_CASES, EMPTY_CASES, {
      milestone: config.fcotsMilestone,
      graceMinutes: config.fcotsGraceMinutes,
      targetPercent: config.fcotsTargetPercent,
    })
    const turnover = calculateTurnoverTime(EMPTY_CASES, EMPTY_CASES, {
      turnoverThresholdMinutes: config.turnoverThresholdMinutes,
      turnoverComplianceTarget: config.turnoverComplianceTarget,
    })
    const utilization = calculateORUtilization(EMPTY_CASES, 10, EMPTY_CASES, undefined, {
      utilizationTargetPercent: config.utilizationTargetPercent,
    })
    const cancellation = calculateCancellationRate(EMPTY_CASES, EMPTY_CASES, {
      cancellationTargetPercent: config.cancellationTargetPercent,
    })

    expect(fcots.target).toBe(92)
    // turnover.target = complianceTarget (%), not thresholdMinutes
    expect(turnover.target).toBe(70)
    expect(utilization.target).toBe(82)
    expect(cancellation.target).toBe(3)
  })
})
