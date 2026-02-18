/**
 * Phase 5 tests: Analytics Settings UI — default values, field coverage,
 * and alignment with shared FacilityAnalyticsConfig defaults.
 */
import { describe, it, expect } from 'vitest'
import { ANALYTICS_CONFIG_DEFAULTS, type FacilityAnalyticsConfig } from '@/lib/analyticsV2'

// DB column name → FacilityAnalyticsConfig field mapping
// This is the source of truth for how settings page form fields map to the shared config
const DB_TO_CONFIG_MAP: Record<string, { configKey: keyof FacilityAnalyticsConfig; defaultValue: number }> = {
  // FCOTS
  fcots_grace_minutes:                  { configKey: 'fcotsGraceMinutes',            defaultValue: 2 },
  fcots_target_percent:                 { configKey: 'fcotsTargetPercent',            defaultValue: 85 },
  // Surgical Turnovers (corrected defaults)
  turnover_target_same_surgeon:         { configKey: 'sameRoomTurnoverTarget',        defaultValue: 45 },
  turnover_target_flip_room:            { configKey: 'flipRoomTurnoverTarget',        defaultValue: 15 },
  turnover_threshold_minutes:           { configKey: 'turnoverThresholdMinutes',      defaultValue: 30 },
  turnover_compliance_target_percent:   { configKey: 'turnoverComplianceTarget',      defaultValue: 80 },
  // OR Utilization (corrected default)
  utilization_target_percent:           { configKey: 'utilizationTargetPercent',      defaultValue: 75 },
  // Cancellations
  cancellation_target_percent:          { configKey: 'cancellationTargetPercent',     defaultValue: 5 },
  // Surgeon Idle Time
  idle_combined_target_minutes:         { configKey: 'idleCombinedTargetMinutes',     defaultValue: 10 },
  idle_flip_target_minutes:             { configKey: 'idleFlipTargetMinutes',         defaultValue: 5 },
  idle_same_room_target_minutes:        { configKey: 'idleSameRoomTargetMinutes',     defaultValue: 10 },
  // Tardiness & Non-Operative Time
  tardiness_target_minutes:             { configKey: 'tardinessTargetMinutes',        defaultValue: 45 },
  non_op_warn_minutes:                  { configKey: 'nonOpWarnMinutes',              defaultValue: 20 },
  non_op_bad_minutes:                   { configKey: 'nonOpBadMinutes',               defaultValue: 30 },
  // Operational
  operating_days_per_year:              { configKey: 'operatingDaysPerYear',          defaultValue: 250 },
}

describe('Analytics Settings — defaults alignment', () => {
  it('every numeric DB column default matches ANALYTICS_CONFIG_DEFAULTS', () => {
    for (const [dbCol, { configKey, defaultValue }] of Object.entries(DB_TO_CONFIG_MAP)) {
      const configValue = ANALYTICS_CONFIG_DEFAULTS[configKey]
      expect(configValue, `${dbCol} → ${configKey}`).toBe(defaultValue)
    }
  })

  it('FCOTS milestone default matches', () => {
    expect(ANALYTICS_CONFIG_DEFAULTS.fcotsMilestone).toBe('patient_in')
  })

  it('corrected turnover defaults: same-room=45, flip=15 (not old 30/45)', () => {
    expect(ANALYTICS_CONFIG_DEFAULTS.sameRoomTurnoverTarget).toBe(45)
    expect(ANALYTICS_CONFIG_DEFAULTS.flipRoomTurnoverTarget).toBe(15)
  })

  it('corrected utilization default: 75% (not old 80%)', () => {
    expect(ANALYTICS_CONFIG_DEFAULTS.utilizationTargetPercent).toBe(75)
  })

  it('all new Phase 1 columns have corresponding config fields', () => {
    const newColumns = [
      'turnover_threshold_minutes',
      'turnover_compliance_target_percent',
      'tardiness_target_minutes',
      'idle_combined_target_minutes',
      'idle_flip_target_minutes',
      'idle_same_room_target_minutes',
      'non_op_warn_minutes',
      'non_op_bad_minutes',
      'operating_days_per_year',
    ]
    for (const col of newColumns) {
      expect(DB_TO_CONFIG_MAP[col], `missing mapping for new column: ${col}`).toBeDefined()
      const configKey = DB_TO_CONFIG_MAP[col].configKey
      expect(
        ANALYTICS_CONFIG_DEFAULTS[configKey],
        `ANALYTICS_CONFIG_DEFAULTS.${configKey} should be defined`
      ).toBeDefined()
    }
  })

  it('orHourlyRate defaults to null (comes from facilities table, not settings)', () => {
    expect(ANALYTICS_CONFIG_DEFAULTS.orHourlyRate).toBeNull()
  })
})

describe('Analytics Settings — section structure', () => {
  // These arrays define the expected fields per UI section.
  // If a field is added to the DB but not wired in the settings page, this test reminds you.

  const SECTION_FIELDS: Record<string, string[]> = {
    'FCOTS': ['fcots_milestone', 'fcots_grace_minutes', 'fcots_target_percent'],
    'Surgical Turnovers': [
      'turnover_target_same_surgeon', 'turnover_target_flip_room',
      'turnover_threshold_minutes', 'turnover_compliance_target_percent',
    ],
    'OR Utilization': ['utilization_target_percent'],
    'Cancellations': ['cancellation_target_percent'],
    'Surgeon Idle Time': [
      'idle_combined_target_minutes', 'idle_flip_target_minutes', 'idle_same_room_target_minutes',
    ],
    'Tardiness & Non-Op': [
      'tardiness_target_minutes', 'non_op_warn_minutes', 'non_op_bad_minutes',
    ],
    'Operational': ['operating_days_per_year'],
  }

  it('all configurable DB columns are assigned to a section', () => {
    const allSectionFields = Object.values(SECTION_FIELDS).flat()
    const allDbColumns = [...Object.keys(DB_TO_CONFIG_MAP), 'fcots_milestone']
    for (const col of allDbColumns) {
      expect(allSectionFields, `DB column ${col} not in any section`).toContain(col)
    }
  })

  it('total field count matches expected (15 numeric + 1 milestone = 16)', () => {
    const allSectionFields = Object.values(SECTION_FIELDS).flat()
    expect(allSectionFields).toHaveLength(16)
  })
})
