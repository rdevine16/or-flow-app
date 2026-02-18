/**
 * Tests for useAnalyticsConfig hook and mapRowToConfig utility.
 *
 * Phase 1 tests:
 * - FacilityAnalyticsConfig type compiles and defaults are exported
 * - mapRowToConfig correctly maps DB rows to config with fallback defaults
 * - mapRowToConfig handles null/missing settings gracefully
 */
import { describe, it, expect } from 'vitest'
import {
  ANALYTICS_CONFIG_DEFAULTS,
  type FacilityAnalyticsConfig,
} from '../../analyticsV2'
import { mapRowToConfig } from '../useAnalyticsConfig'

// ============================================
// ANALYTICS_CONFIG_DEFAULTS
// ============================================

describe('ANALYTICS_CONFIG_DEFAULTS', () => {
  it('has correct FCOTS defaults', () => {
    expect(ANALYTICS_CONFIG_DEFAULTS.fcotsMilestone).toBe('patient_in')
    expect(ANALYTICS_CONFIG_DEFAULTS.fcotsGraceMinutes).toBe(2)
    expect(ANALYTICS_CONFIG_DEFAULTS.fcotsTargetPercent).toBe(85)
  })

  it('has correct turnover defaults (corrected values)', () => {
    expect(ANALYTICS_CONFIG_DEFAULTS.sameRoomTurnoverTarget).toBe(45)
    expect(ANALYTICS_CONFIG_DEFAULTS.flipRoomTurnoverTarget).toBe(15)
    expect(ANALYTICS_CONFIG_DEFAULTS.turnoverThresholdMinutes).toBe(30)
    expect(ANALYTICS_CONFIG_DEFAULTS.turnoverComplianceTarget).toBe(80)
  })

  it('has correct utilization and cancellation defaults', () => {
    expect(ANALYTICS_CONFIG_DEFAULTS.utilizationTargetPercent).toBe(75)
    expect(ANALYTICS_CONFIG_DEFAULTS.cancellationTargetPercent).toBe(5)
  })

  it('has correct idle time defaults', () => {
    expect(ANALYTICS_CONFIG_DEFAULTS.idleCombinedTargetMinutes).toBe(10)
    expect(ANALYTICS_CONFIG_DEFAULTS.idleFlipTargetMinutes).toBe(5)
    expect(ANALYTICS_CONFIG_DEFAULTS.idleSameRoomTargetMinutes).toBe(10)
  })

  it('has correct tardiness and non-op defaults', () => {
    expect(ANALYTICS_CONFIG_DEFAULTS.tardinessTargetMinutes).toBe(45)
    expect(ANALYTICS_CONFIG_DEFAULTS.nonOpWarnMinutes).toBe(20)
    expect(ANALYTICS_CONFIG_DEFAULTS.nonOpBadMinutes).toBe(30)
  })

  it('has correct operational defaults', () => {
    expect(ANALYTICS_CONFIG_DEFAULTS.operatingDaysPerYear).toBe(250)
    expect(ANALYTICS_CONFIG_DEFAULTS.orHourlyRate).toBeNull()
  })

  it('has all expected keys', () => {
    const keys = Object.keys(ANALYTICS_CONFIG_DEFAULTS)
    expect(keys).toHaveLength(17)
    expect(keys).toContain('fcotsMilestone')
    expect(keys).toContain('orHourlyRate')
    expect(keys).toContain('operatingDaysPerYear')
  })
})

// ============================================
// mapRowToConfig
// ============================================

describe('mapRowToConfig', () => {
  it('returns all defaults when row is null', () => {
    const config = mapRowToConfig(null, null)
    expect(config).toEqual(ANALYTICS_CONFIG_DEFAULTS)
  })

  it('returns all defaults when row is empty object', () => {
    const config = mapRowToConfig({}, null)
    expect(config).toEqual(ANALYTICS_CONFIG_DEFAULTS)
  })

  it('maps a full DB row correctly', () => {
    const row = {
      fcots_milestone: 'incision' as const,
      fcots_grace_minutes: 5,
      fcots_target_percent: 90,
      turnover_target_same_surgeon: 50,
      turnover_target_flip_room: 20,
      turnover_threshold_minutes: 35,
      turnover_compliance_target_percent: 85,
      utilization_target_percent: 80,
      cancellation_target_percent: 3,
      idle_combined_target_minutes: 15,
      idle_flip_target_minutes: 8,
      idle_same_room_target_minutes: 12,
      tardiness_target_minutes: 60,
      non_op_warn_minutes: 25,
      non_op_bad_minutes: 40,
      operating_days_per_year: 260,
    }

    const config = mapRowToConfig(row, 2400)

    expect(config.fcotsMilestone).toBe('incision')
    expect(config.fcotsGraceMinutes).toBe(5)
    expect(config.fcotsTargetPercent).toBe(90)
    expect(config.sameRoomTurnoverTarget).toBe(50)
    expect(config.flipRoomTurnoverTarget).toBe(20)
    expect(config.turnoverThresholdMinutes).toBe(35)
    expect(config.turnoverComplianceTarget).toBe(85)
    expect(config.utilizationTargetPercent).toBe(80)
    expect(config.cancellationTargetPercent).toBe(3)
    expect(config.idleCombinedTargetMinutes).toBe(15)
    expect(config.idleFlipTargetMinutes).toBe(8)
    expect(config.idleSameRoomTargetMinutes).toBe(12)
    expect(config.tardinessTargetMinutes).toBe(60)
    expect(config.nonOpWarnMinutes).toBe(25)
    expect(config.nonOpBadMinutes).toBe(40)
    expect(config.operatingDaysPerYear).toBe(260)
    expect(config.orHourlyRate).toBe(2400)
  })

  it('applies defaults for missing fields in partial row', () => {
    const row = {
      fcots_milestone: 'patient_in' as const,
      fcots_grace_minutes: 3,
      // Everything else is missing
    }

    const config = mapRowToConfig(row, 1800)

    // Provided values
    expect(config.fcotsMilestone).toBe('patient_in')
    expect(config.fcotsGraceMinutes).toBe(3)
    // Defaults for missing values
    expect(config.fcotsTargetPercent).toBe(85)
    expect(config.sameRoomTurnoverTarget).toBe(45)
    expect(config.flipRoomTurnoverTarget).toBe(15)
    expect(config.turnoverThresholdMinutes).toBe(30)
    expect(config.utilizationTargetPercent).toBe(75)
    expect(config.operatingDaysPerYear).toBe(250)
    // Revenue from facilities table
    expect(config.orHourlyRate).toBe(1800)
  })

  it('maps unknown fcots_milestone to patient_in', () => {
    const config = mapRowToConfig({ fcots_milestone: 'unknown_value' }, null)
    expect(config.fcotsMilestone).toBe('patient_in')
  })

  it('handles or_hourly_rate = 0 correctly (does not fall back to null)', () => {
    // 0 is a valid rate (free OR? testing scenario) — should not be treated as falsy
    const config = mapRowToConfig(null, 0)
    expect(config.orHourlyRate).toBe(0)
  })

  it('result satisfies FacilityAnalyticsConfig type', () => {
    const config: FacilityAnalyticsConfig = mapRowToConfig(null, null)
    // TypeScript compilation verifies the type; runtime check for safety
    expect(typeof config.fcotsMilestone).toBe('string')
    expect(typeof config.fcotsGraceMinutes).toBe('number')
    expect(typeof config.sameRoomTurnoverTarget).toBe('number')
    expect(typeof config.operatingDaysPerYear).toBe('number')
  })
})
