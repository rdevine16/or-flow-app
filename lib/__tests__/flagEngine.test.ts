// lib/__tests__/flagEngine.test.ts
// Comprehensive tests for Phase 5: Financial and quality metrics in flag engine

import { describe, it, expect } from 'vitest'
import {
  extractMetricValue,
  evaluateCase,
  buildBaselines,
  type CaseFlag,
  type FlagBaselines,
} from '../flagEngine'
import type { MilestoneMap } from '../analyticsV2'
import type { FlagRule, CaseWithFinancials, CaseCompletionStats } from '@/types/flag-settings'

// =====================================================
// TEST HELPERS
// =====================================================

function createMilestoneMap(overrides: Partial<MilestoneMap> = {}): MilestoneMap {
  return {
    patient_in: '2026-02-15T07:30:00Z',
    anes_start: '2026-02-15T07:35:00Z',
    anes_end: '2026-02-15T07:45:00Z',
    prep_drape_complete: '2026-02-15T07:55:00Z',
    incision: '2026-02-15T08:00:00Z',
    closing: '2026-02-15T09:00:00Z',
    closing_complete: '2026-02-15T09:10:00Z',
    patient_out: '2026-02-15T09:30:00Z',
    ...overrides,
  }
}

function createCaseWithFinancials(overrides: Partial<CaseWithFinancials> = {}): CaseWithFinancials {
  const defaultMilestones = [
    { facility_milestone_id: 'patient_in', recorded_at: '2026-02-15T07:30:00Z', facility_milestones: { name: 'patient_in' } },
    { facility_milestone_id: 'anes_start', recorded_at: '2026-02-15T07:35:00Z', facility_milestones: { name: 'anes_start' } },
    { facility_milestone_id: 'anes_end', recorded_at: '2026-02-15T07:45:00Z', facility_milestones: { name: 'anes_end' } },
    { facility_milestone_id: 'prep_drape_complete', recorded_at: '2026-02-15T07:55:00Z', facility_milestones: { name: 'prep_drape_complete' } },
    { facility_milestone_id: 'incision', recorded_at: '2026-02-15T08:00:00Z', facility_milestones: { name: 'incision' } },
    { facility_milestone_id: 'closing', recorded_at: '2026-02-15T09:00:00Z', facility_milestones: { name: 'closing' } },
    { facility_milestone_id: 'closing_complete', recorded_at: '2026-02-15T09:10:00Z', facility_milestones: { name: 'closing_complete' } },
    { facility_milestone_id: 'patient_out', recorded_at: '2026-02-15T09:30:00Z', facility_milestones: { name: 'patient_out' } },
  ]

  return {
    id: 'case-1',
    case_number: 'CASE-001',
    facility_id: 'facility-1',
    surgeon_id: 'surgeon-1',
    scheduled_date: '2026-02-15',
    start_time: '07:30',
    or_room_id: 'room-1',
    status_id: 'status-1',
    case_milestones: defaultMilestones,
    procedure_types: { id: 'proc-1', name: 'Test Procedure' },
    completion_stats: {
      profit: 1500,
      reimbursement: 5000,
      total_debits: 2000,
      or_time_cost: 1500,
      total_duration_minutes: 120,
      or_hourly_rate: 50,
    },
    expected_reimbursement: 5000,
    category_costs: {},
    ...overrides,
  } as CaseWithFinancials
}

function createFlagRule(overrides: Partial<FlagRule> = {}): FlagRule {
  return {
    id: 'rule-1',
    facility_id: 'facility-1',
    name: 'Test Rule',
    description: null,
    category: 'financial',
    metric: 'case_profit',
    start_milestone: null,
    end_milestone: null,
    operator: 'lt',
    threshold_type: 'absolute',
    threshold_value: 0,
    threshold_value_max: null,
    comparison_scope: 'facility',
    severity: 'warning',
    display_order: 1,
    is_built_in: true,
    is_enabled: true,
    is_active: true,
    source_rule_id: null,
    cost_category_id: null,
    deleted_at: null,
    deleted_by: null,
    created_at: '2026-02-15T00:00:00Z',
    updated_at: '2026-02-15T00:00:00Z',
    ...overrides,
  }
}

// =====================================================
// FINANCIAL METRIC EXTRACTION
// =====================================================

describe('extractMetricValue - Financial Metrics', () => {
  const milestones = createMilestoneMap()

  it('extracts case_profit from completion_stats', () => {
    const caseData = createCaseWithFinancials({ completion_stats: { profit: 1500 } as CaseCompletionStats })
    const value = extractMetricValue(milestones, 'case_profit', null, null, caseData)
    expect(value).toBe(1500)
  })

  it('returns null for case_profit when completion_stats is missing', () => {
    const caseData = createCaseWithFinancials({ completion_stats: null })
    const value = extractMetricValue(milestones, 'case_profit', null, null, caseData)
    expect(value).toBeNull()
  })

  it('extracts case_margin as percentage', () => {
    const caseData = createCaseWithFinancials({
      completion_stats: { profit: 2000, reimbursement: 5000 } as CaseCompletionStats
    })
    const value = extractMetricValue(milestones, 'case_margin', null, null, caseData)
    expect(value).toBe(40) // (2000 / 5000) * 100 = 40%
  })

  it('returns null for case_margin when reimbursement is zero', () => {
    const caseData = createCaseWithFinancials({
      completion_stats: { profit: 1000, reimbursement: 0 } as CaseCompletionStats
    })
    const value = extractMetricValue(milestones, 'case_margin', null, null, caseData)
    expect(value).toBeNull()
  })

  it('returns null for case_margin when profit or reimbursement is missing', () => {
    const caseData = createCaseWithFinancials({
      completion_stats: { profit: null, reimbursement: 5000 } as CaseCompletionStats
    })
    const value = extractMetricValue(milestones, 'case_margin', null, null, caseData)
    expect(value).toBeNull()
  })

  it('extracts profit_per_minute', () => {
    const caseData = createCaseWithFinancials({
      completion_stats: { profit: 1200, total_duration_minutes: 60 } as CaseCompletionStats
    })
    const value = extractMetricValue(milestones, 'profit_per_minute', null, null, caseData)
    expect(value).toBe(20) // 1200 / 60 = 20
  })

  it('returns null for profit_per_minute when duration is zero', () => {
    const caseData = createCaseWithFinancials({
      completion_stats: { profit: 1200, total_duration_minutes: 0 } as CaseCompletionStats
    })
    const value = extractMetricValue(milestones, 'profit_per_minute', null, null, caseData)
    expect(value).toBeNull()
  })

  it('extracts total_case_cost as sum of debits and OR cost', () => {
    const caseData = createCaseWithFinancials({
      completion_stats: { total_debits: 2000, or_time_cost: 1500 } as CaseCompletionStats
    })
    const value = extractMetricValue(milestones, 'total_case_cost', null, null, caseData)
    expect(value).toBe(3500) // 2000 + 1500
  })

  it('returns null for total_case_cost when both debits and OR cost are missing', () => {
    const caseData = createCaseWithFinancials({
      completion_stats: { total_debits: null, or_time_cost: null } as CaseCompletionStats
    })
    const value = extractMetricValue(milestones, 'total_case_cost', null, null, caseData)
    expect(value).toBeNull()
  })

  it('calculates total_case_cost with only debits', () => {
    const caseData = createCaseWithFinancials({
      completion_stats: { total_debits: 2000, or_time_cost: null } as CaseCompletionStats
    })
    const value = extractMetricValue(milestones, 'total_case_cost', null, null, caseData)
    expect(value).toBe(2000)
  })

  it('calculates total_case_cost with only OR cost', () => {
    const caseData = createCaseWithFinancials({
      completion_stats: { total_debits: null, or_time_cost: 1500 } as CaseCompletionStats
    })
    const value = extractMetricValue(milestones, 'total_case_cost', null, null, caseData)
    expect(value).toBe(1500)
  })

  it('extracts reimbursement_variance as percentage', () => {
    const caseData = createCaseWithFinancials({
      completion_stats: { reimbursement: 5500 } as CaseCompletionStats,
      expected_reimbursement: 5000,
    })
    const value = extractMetricValue(milestones, 'reimbursement_variance', null, null, caseData)
    expect(value).toBe(10) // ((5500 - 5000) / 5000) * 100 = 10%
  })

  it('returns negative variance when actual is less than expected', () => {
    const caseData = createCaseWithFinancials({
      completion_stats: { reimbursement: 4500 } as CaseCompletionStats,
      expected_reimbursement: 5000,
    })
    const value = extractMetricValue(milestones, 'reimbursement_variance', null, null, caseData)
    expect(value).toBe(-10) // ((4500 - 5000) / 5000) * 100 = -10%
  })

  it('returns null for reimbursement_variance when expected is zero', () => {
    const caseData = createCaseWithFinancials({
      completion_stats: { reimbursement: 5000 } as CaseCompletionStats,
      expected_reimbursement: 0,
    })
    const value = extractMetricValue(milestones, 'reimbursement_variance', null, null, caseData)
    expect(value).toBeNull()
  })

  it('extracts or_time_cost directly', () => {
    const caseData = createCaseWithFinancials({
      completion_stats: { or_time_cost: 1500 } as CaseCompletionStats
    })
    const value = extractMetricValue(milestones, 'or_time_cost', null, null, caseData)
    expect(value).toBe(1500)
  })
})

// =====================================================
// QUALITY METRIC EXTRACTION
// =====================================================

describe('extractMetricValue - Quality Metrics', () => {
  it('counts missing milestones', () => {
    const milestones = createMilestoneMap({
      patient_in: '2026-02-15T07:30:00Z',
      anes_start: null,
      anes_end: null,
      prep_drape_complete: '2026-02-15T07:55:00Z',
      incision: '2026-02-15T08:00:00Z',
      closing: null,
      patient_out: '2026-02-15T09:30:00Z',
    })
    const value = extractMetricValue(milestones, 'missing_milestones', null, null)
    expect(value).toBe(3) // anes_start, anes_end, closing, closing_complete missing, but prep_drape_complete present
  })

  it('returns 0 missing milestones when all are present', () => {
    const milestones = createMilestoneMap()
    const value = extractMetricValue(milestones, 'missing_milestones', null, null)
    expect(value).toBe(0)
  })

  it('counts sequence violations when milestones are out of order', () => {
    const milestones = createMilestoneMap({
      patient_in: '2026-02-15T07:30:00Z',
      anes_start: '2026-02-15T07:35:00Z',
      anes_end: '2026-02-15T07:45:00Z',
      prep_drape_complete: '2026-02-15T07:55:00Z',
      incision: '2026-02-15T08:00:00Z',
      closing: '2026-02-15T07:50:00Z', // BEFORE incision - violation!
      closing_complete: '2026-02-15T09:10:00Z',
      patient_out: '2026-02-15T09:30:00Z',
    })
    const value = extractMetricValue(milestones, 'milestone_out_of_order', null, null)
    expect(value).toBe(1)
  })

  it('returns 0 sequence violations when all are in order', () => {
    const milestones = createMilestoneMap()
    const value = extractMetricValue(milestones, 'milestone_out_of_order', null, null)
    expect(value).toBe(0)
  })

  it('counts multiple sequence violations', () => {
    const milestones = createMilestoneMap({
      patient_in: '2026-02-15T07:30:00Z',
      anes_start: '2026-02-15T07:25:00Z', // BEFORE patient_in - violation 1
      anes_end: '2026-02-15T07:45:00Z',
      prep_drape_complete: '2026-02-15T07:40:00Z', // BEFORE anes_end - violation 2
      incision: '2026-02-15T08:00:00Z',
      closing: '2026-02-15T09:00:00Z',
      closing_complete: '2026-02-15T09:10:00Z',
      patient_out: '2026-02-15T09:30:00Z',
    })
    const value = extractMetricValue(milestones, 'milestone_out_of_order', null, null)
    expect(value).toBe(2)
  })

  it('handles missing milestones when checking sequence violations', () => {
    const milestones = createMilestoneMap({
      patient_in: '2026-02-15T07:30:00Z',
      anes_start: null,
      anes_end: null,
      prep_drape_complete: '2026-02-15T07:55:00Z',
      incision: '2026-02-15T08:00:00Z',
      closing: '2026-02-15T07:50:00Z', // BEFORE prep_drape - violation
      closing_complete: '2026-02-15T09:10:00Z',
      patient_out: '2026-02-15T09:30:00Z',
    })
    const value = extractMetricValue(milestones, 'milestone_out_of_order', null, null)
    expect(value).toBe(1)
  })
})

// =====================================================
// THRESHOLD TYPE RESOLUTION
// =====================================================

describe('evaluateCase - Threshold Types', () => {
  it('resolves percentage_of_median threshold with gt operator', () => {
    const rule = createFlagRule({
      metric: 'surgical_time',
      threshold_type: 'percentage_of_median',
      threshold_value: 20, // 20% above median
      operator: 'gt',
    })

    const baselines: FlagBaselines = {
      facility: new Map([['surgical_time', { median: 60, stdDev: 10, count: 10 }]]),
      personal: new Map(),
    }

    // Case with surgical_time = 75 min (25% above median of 60)
    const caseData = createCaseWithFinancials({
      case_milestones: [
        { facility_milestone_id: 'patient_in', recorded_at: '2026-02-15T07:30:00Z', facility_milestones: { name: 'patient_in' } },
        { facility_milestone_id: 'incision', recorded_at: '2026-02-15T08:00:00Z', facility_milestones: { name: 'incision' } },
        { facility_milestone_id: 'closing', recorded_at: '2026-02-15T09:15:00Z', facility_milestones: { name: 'closing' } },
        { facility_milestone_id: 'patient_out', recorded_at: '2026-02-15T09:30:00Z', facility_milestones: { name: 'patient_out' } },
      ],
    })

    const flags = evaluateCase(caseData, [rule], baselines, null, new Set(), null)

    // 75 > 60 * 1.2 (72) → should flag
    expect(flags).toHaveLength(1)
    expect(flags[0].metric_value).toBe(75)
    expect(flags[0].threshold_value).toBe(72) // 60 * 1.2
  })

  it('resolves percentage_of_median threshold with lt operator', () => {
    const rule = createFlagRule({
      metric: 'surgical_time',
      threshold_type: 'percentage_of_median',
      threshold_value: 30, // 30% below median
      operator: 'lt',
    })

    const baselines: FlagBaselines = {
      facility: new Map([['surgical_time', { median: 100, stdDev: 15, count: 10 }]]),
      personal: new Map(),
    }

    // Case with surgical_time = 65 min (35% below median of 100)
    const caseData = createCaseWithFinancials({
      case_milestones: [
        { facility_milestone_id: 'patient_in', recorded_at: '2026-02-15T07:30:00Z', facility_milestones: { name: 'patient_in' } },
        { facility_milestone_id: 'incision', recorded_at: '2026-02-15T08:00:00Z', facility_milestones: { name: 'incision' } },
        { facility_milestone_id: 'closing', recorded_at: '2026-02-15T09:05:00Z', facility_milestones: { name: 'closing' } },
        { facility_milestone_id: 'patient_out', recorded_at: '2026-02-15T09:30:00Z', facility_milestones: { name: 'patient_out' } },
      ],
    })

    const flags = evaluateCase(caseData, [rule], baselines, null, new Set(), null)

    // 65 < 100 * 0.7 (70) → should flag
    expect(flags).toHaveLength(1)
    expect(flags[0].metric_value).toBe(65)
    expect(flags[0].threshold_value).toBe(70) // 100 * 0.7
  })

  it('resolves percentile threshold', () => {
    const rule = createFlagRule({
      metric: 'surgical_time',
      threshold_type: 'percentile',
      threshold_value: 90, // 90th percentile
      operator: 'gt',
    })

    const baselines: FlagBaselines = {
      facility: new Map([
        ['surgical_time', {
          median: 60,
          stdDev: 10,
          count: 20,
          values: [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135],
        }],
      ]),
      personal: new Map(),
    }

    // Case with surgical_time = 135 min (above 90th percentile)
    const caseData = createCaseWithFinancials({
      case_milestones: [
        { facility_milestone_id: 'patient_in', recorded_at: '2026-02-15T07:30:00Z', facility_milestones: { name: 'patient_in' } },
        { facility_milestone_id: 'incision', recorded_at: '2026-02-15T08:00:00Z', facility_milestones: { name: 'incision' } },
        { facility_milestone_id: 'closing', recorded_at: '2026-02-15T10:15:00Z', facility_milestones: { name: 'closing' } },
        { facility_milestone_id: 'patient_out', recorded_at: '2026-02-15T10:30:00Z', facility_milestones: { name: 'patient_out' } },
      ],
    })

    const flags = evaluateCase(caseData, [rule], baselines, null, new Set(), null)

    expect(flags).toHaveLength(1)
    expect(flags[0].metric_value).toBe(135)
    // 90th percentile of the sorted values should be around 130-132
    expect(flags[0].threshold_value).toBeGreaterThan(125)
    expect(flags[0].threshold_value).toBeLessThan(135)
  })

  it('resolves between threshold', () => {
    const rule = createFlagRule({
      metric: 'case_margin',
      threshold_type: 'between',
      threshold_value: 10, // min
      threshold_value_max: 25, // max
      operator: 'gte', // operator is ignored for between
    })

    // Case with margin = 15% (within range)
    const caseData = createCaseWithFinancials({
      completion_stats: { profit: 750, reimbursement: 5000 } as CaseCompletionStats,
    })

    const flags = evaluateCase(caseData, [rule], { facility: new Map(), personal: new Map() }, null, new Set(), null)

    expect(flags).toHaveLength(1)
    expect(flags[0].metric_value).toBe(15) // (750 / 5000) * 100
  })

  it('does not flag when value is outside between range', () => {
    const rule = createFlagRule({
      metric: 'case_margin',
      threshold_type: 'between',
      threshold_value: 10,
      threshold_value_max: 25,
      operator: 'gte',
    })

    // Case with margin = 30% (outside range)
    const caseData = createCaseWithFinancials({
      completion_stats: { profit: 1500, reimbursement: 5000 } as CaseCompletionStats,
    })

    const flags = evaluateCase(caseData, [rule], { facility: new Map(), personal: new Map() }, null, new Set(), null)

    expect(flags).toHaveLength(0)
  })
})

// =====================================================
// COMPARISON OPERATORS
// =====================================================

describe('evaluateCase - Comparison Operators', () => {
  it('evaluates gt (greater than)', () => {
    const rule = createFlagRule({
      metric: 'surgical_time',
      threshold_type: 'absolute',
      threshold_value: 90,
      operator: 'gt',
    })

    const caseData = createCaseWithFinancials({
      case_milestones: [
        { facility_milestone_id: 'patient_in', recorded_at: '2026-02-15T07:30:00Z', facility_milestones: { name: 'patient_in' } },
        { facility_milestone_id: 'incision', recorded_at: '2026-02-15T08:00:00Z', facility_milestones: { name: 'incision' } },
        { facility_milestone_id: 'closing', recorded_at: '2026-02-15T09:35:00Z', facility_milestones: { name: 'closing' } }, // 95 min
        { facility_milestone_id: 'patient_out', recorded_at: '2026-02-15T10:00:00Z', facility_milestones: { name: 'patient_out' } },
      ],
    })

    const flags = evaluateCase(caseData, [rule], { facility: new Map(), personal: new Map() }, null, new Set(), null)
    expect(flags).toHaveLength(1)
  })

  it('does not flag when value equals threshold with gt operator', () => {
    const rule = createFlagRule({
      metric: 'surgical_time',
      threshold_type: 'absolute',
      threshold_value: 60,
      operator: 'gt',
    })

    const caseData = createCaseWithFinancials({
      case_milestones: [
        { facility_milestone_id: 'patient_in', recorded_at: '2026-02-15T07:30:00Z', facility_milestones: { name: 'patient_in' } },
        { facility_milestone_id: 'incision', recorded_at: '2026-02-15T08:00:00Z', facility_milestones: { name: 'incision' } },
        { facility_milestone_id: 'closing', recorded_at: '2026-02-15T09:00:00Z', facility_milestones: { name: 'closing' } }, // exactly 60 min
        { facility_milestone_id: 'patient_out', recorded_at: '2026-02-15T09:30:00Z', facility_milestones: { name: 'patient_out' } },
      ],
    })

    const flags = evaluateCase(caseData, [rule], { facility: new Map(), personal: new Map() }, null, new Set(), null)
    expect(flags).toHaveLength(0)
  })

  it('evaluates gte (greater than or equal)', () => {
    const rule = createFlagRule({
      metric: 'surgical_time',
      threshold_type: 'absolute',
      threshold_value: 60,
      operator: 'gte',
    })

    const caseData = createCaseWithFinancials({
      case_milestones: [
        { facility_milestone_id: 'patient_in', recorded_at: '2026-02-15T07:30:00Z', facility_milestones: { name: 'patient_in' } },
        { facility_milestone_id: 'incision', recorded_at: '2026-02-15T08:00:00Z', facility_milestones: { name: 'incision' } },
        { facility_milestone_id: 'closing', recorded_at: '2026-02-15T09:00:00Z', facility_milestones: { name: 'closing' } }, // exactly 60 min
        { facility_milestone_id: 'patient_out', recorded_at: '2026-02-15T09:30:00Z', facility_milestones: { name: 'patient_out' } },
      ],
    })

    const flags = evaluateCase(caseData, [rule], { facility: new Map(), personal: new Map() }, null, new Set(), null)
    expect(flags).toHaveLength(1)
  })

  it('evaluates lt (less than)', () => {
    const rule = createFlagRule({
      metric: 'case_profit',
      threshold_type: 'absolute',
      threshold_value: 1000,
      operator: 'lt',
    })

    const caseData = createCaseWithFinancials({
      completion_stats: { profit: 800 } as CaseCompletionStats,
    })

    const flags = evaluateCase(caseData, [rule], { facility: new Map(), personal: new Map() }, null, new Set(), null)
    expect(flags).toHaveLength(1)
  })

  it('evaluates lte (less than or equal)', () => {
    const rule = createFlagRule({
      metric: 'case_profit',
      threshold_type: 'absolute',
      threshold_value: 1000,
      operator: 'lte',
    })

    const caseData = createCaseWithFinancials({
      completion_stats: { profit: 1000 } as CaseCompletionStats,
    })

    const flags = evaluateCase(caseData, [rule], { facility: new Map(), personal: new Map() }, null, new Set(), null)
    expect(flags).toHaveLength(1)
  })
})

// =====================================================
// FINANCIAL RULE EVALUATION
// =====================================================

describe('evaluateCase - Financial Rules', () => {
  it('flags negative profit cases', () => {
    const rule = createFlagRule({
      metric: 'case_profit',
      threshold_type: 'absolute',
      threshold_value: 0,
      operator: 'lt',
      severity: 'critical',
    })

    const caseData = createCaseWithFinancials({
      completion_stats: { profit: -500 } as CaseCompletionStats,
    })

    const flags = evaluateCase(caseData, [rule], { facility: new Map(), personal: new Map() }, null, new Set(), null)

    expect(flags).toHaveLength(1)
    expect(flags[0].metric_value).toBe(-500)
    expect(flags[0].severity).toBe('critical')
  })

  it('flags low margin cases', () => {
    const rule = createFlagRule({
      metric: 'case_margin',
      threshold_type: 'absolute',
      threshold_value: 20, // less than 20% margin
      operator: 'lt',
      severity: 'warning',
    })

    const caseData = createCaseWithFinancials({
      completion_stats: { profit: 500, reimbursement: 5000 } as CaseCompletionStats, // 10% margin
    })

    const flags = evaluateCase(caseData, [rule], { facility: new Map(), personal: new Map() }, null, new Set(), null)

    expect(flags).toHaveLength(1)
    expect(flags[0].metric_value).toBe(10)
  })

  it('flags high cost cases', () => {
    const rule = createFlagRule({
      metric: 'total_case_cost',
      threshold_type: 'absolute',
      threshold_value: 3000,
      operator: 'gt',
    })

    const caseData = createCaseWithFinancials({
      completion_stats: { total_debits: 2500, or_time_cost: 1000 } as CaseCompletionStats, // 3500 total
    })

    const flags = evaluateCase(caseData, [rule], { facility: new Map(), personal: new Map() }, null, new Set(), null)

    expect(flags).toHaveLength(1)
    expect(flags[0].metric_value).toBe(3500)
  })
})

// =====================================================
// QUALITY RULE EVALUATION
// =====================================================

describe('evaluateCase - Quality Rules', () => {
  it('flags cases with too many missing milestones', () => {
    const rule = createFlagRule({
      metric: 'missing_milestones',
      threshold_type: 'absolute',
      threshold_value: 2,
      operator: 'gt',
      category: 'quality',
    })

    const caseData = createCaseWithFinancials({
      case_milestones: [
        { facility_milestone_id: 'patient_in', recorded_at: '2026-02-15T07:30:00Z', facility_milestones: { name: 'patient_in' } },
        { facility_milestone_id: 'incision', recorded_at: '2026-02-15T08:00:00Z', facility_milestones: { name: 'incision' } },
        { facility_milestone_id: 'patient_out', recorded_at: '2026-02-15T09:30:00Z', facility_milestones: { name: 'patient_out' } },
        // Missing: anes_start, anes_end, prep_drape_complete, closing, closing_complete (5 total)
      ],
    })

    const flags = evaluateCase(caseData, [rule], { facility: new Map(), personal: new Map() }, null, new Set(), null)

    expect(flags).toHaveLength(1)
    expect(flags[0].metric_value).toBe(5)
  })

  it('flags cases with sequence violations', () => {
    const rule = createFlagRule({
      metric: 'milestone_out_of_order',
      threshold_type: 'absolute',
      threshold_value: 0,
      operator: 'gt',
      category: 'quality',
      severity: 'warning',
    })

    const caseData = createCaseWithFinancials({
      case_milestones: [
        { facility_milestone_id: 'patient_in', recorded_at: '2026-02-15T07:30:00Z', facility_milestones: { name: 'patient_in' } },
        { facility_milestone_id: 'anes_start', recorded_at: '2026-02-15T07:35:00Z', facility_milestones: { name: 'anes_start' } },
        { facility_milestone_id: 'anes_end', recorded_at: '2026-02-15T07:45:00Z', facility_milestones: { name: 'anes_end' } },
        { facility_milestone_id: 'incision', recorded_at: '2026-02-15T08:00:00Z', facility_milestones: { name: 'incision' } },
        { facility_milestone_id: 'closing', recorded_at: '2026-02-15T07:50:00Z', facility_milestones: { name: 'closing' } }, // Out of order!
        { facility_milestone_id: 'patient_out', recorded_at: '2026-02-15T09:30:00Z', facility_milestones: { name: 'patient_out' } },
      ],
    })

    const flags = evaluateCase(caseData, [rule], { facility: new Map(), personal: new Map() }, null, new Set(), null)

    expect(flags).toHaveLength(1)
    expect(flags[0].metric_value).toBe(1)
  })
})

// =====================================================
// BASELINES WITH FINANCIAL/QUALITY METRICS
// =====================================================

describe('buildBaselines - Financial and Quality Metrics', () => {
  it('includes financial metrics in facility baselines', () => {
    const cases: CaseWithFinancials[] = [
      createCaseWithFinancials({
        id: 'case-1',
        completion_stats: { profit: 1000, reimbursement: 5000 } as CaseCompletionStats,
        case_milestones: [
          { facility_milestone_id: 'patient_in', recorded_at: '2026-02-15T07:30:00Z' },
          { facility_milestone_id: 'patient_out', recorded_at: '2026-02-15T09:30:00Z' },
        ] as never,
      }),
      createCaseWithFinancials({
        id: 'case-2',
        completion_stats: { profit: 1500, reimbursement: 5000 } as CaseCompletionStats,
        case_milestones: [
          { facility_milestone_id: 'patient_in', recorded_at: '2026-02-15T08:00:00Z' },
          { facility_milestone_id: 'patient_out', recorded_at: '2026-02-15T10:00:00Z' },
        ] as never,
      }),
      createCaseWithFinancials({
        id: 'case-3',
        completion_stats: { profit: 1200, reimbursement: 5000 } as CaseCompletionStats,
        case_milestones: [
          { facility_milestone_id: 'patient_in', recorded_at: '2026-02-15T09:00:00Z' },
          { facility_milestone_id: 'patient_out', recorded_at: '2026-02-15T11:00:00Z' },
        ] as never,
      }),
    ]

    const baselines = buildBaselines(cases, ['case_profit', 'case_margin'], false)

    expect(baselines.facility.has('case_profit')).toBe(true)
    expect(baselines.facility.get('case_profit')?.median).toBe(1200)
    expect(baselines.facility.get('case_profit')?.count).toBe(3)

    expect(baselines.facility.has('case_margin')).toBe(true)
    expect(baselines.facility.get('case_margin')?.median).toBe(24) // (1200 / 5000) * 100
  })

  it('includes quality metrics in baselines', () => {
    const cases: CaseWithFinancials[] = [
      createCaseWithFinancials({
        id: 'case-1',
        case_milestones: [
          { facility_milestone_id: 'patient_in', recorded_at: '2026-02-15T07:30:00Z', facility_milestones: { name: 'patient_in' } },
          { facility_milestone_id: 'incision', recorded_at: '2026-02-15T08:00:00Z', facility_milestones: { name: 'incision' } },
          { facility_milestone_id: 'patient_out', recorded_at: '2026-02-15T09:30:00Z', facility_milestones: { name: 'patient_out' } },
          // Missing 5 core milestones
        ],
      }),
      createCaseWithFinancials({
        id: 'case-2',
        case_milestones: [
          { facility_milestone_id: 'patient_in', recorded_at: '2026-02-15T08:00:00Z', facility_milestones: { name: 'patient_in' } },
          { facility_milestone_id: 'anes_start', recorded_at: '2026-02-15T08:05:00Z', facility_milestones: { name: 'anes_start' } },
          { facility_milestone_id: 'incision', recorded_at: '2026-02-15T08:30:00Z', facility_milestones: { name: 'incision' } },
          { facility_milestone_id: 'patient_out', recorded_at: '2026-02-15T10:00:00Z', facility_milestones: { name: 'patient_out' } },
          // Missing 4 core milestones
        ],
      }),
      createCaseWithFinancials({
        id: 'case-3',
        case_milestones: [
          { facility_milestone_id: 'patient_in', recorded_at: '2026-02-15T09:00:00Z', facility_milestones: { name: 'patient_in' } },
          { facility_milestone_id: 'anes_start', recorded_at: '2026-02-15T09:05:00Z', facility_milestones: { name: 'anes_start' } },
          { facility_milestone_id: 'anes_end', recorded_at: '2026-02-15T09:15:00Z', facility_milestones: { name: 'anes_end' } },
          { facility_milestone_id: 'incision', recorded_at: '2026-02-15T09:30:00Z', facility_milestones: { name: 'incision' } },
          { facility_milestone_id: 'patient_out', recorded_at: '2026-02-15T11:00:00Z', facility_milestones: { name: 'patient_out' } },
          // Missing 3 core milestones
        ],
      }),
    ]

    const baselines = buildBaselines(cases, ['missing_milestones'], false)

    expect(baselines.facility.has('missing_milestones')).toBe(true)
    expect(baselines.facility.get('missing_milestones')?.median).toBe(4)
    expect(baselines.facility.get('missing_milestones')?.count).toBe(3)
  })

  it('stores sorted values when percentile calculation is needed', () => {
    const cases: CaseWithFinancials[] = [
      createCaseWithFinancials({
        id: 'case-1',
        completion_stats: { profit: 800 } as CaseCompletionStats,
        case_milestones: [
          { facility_milestone_id: 'patient_in', recorded_at: '2026-02-15T07:30:00Z', facility_milestones: { name: 'patient_in' } },
          { facility_milestone_id: 'patient_out', recorded_at: '2026-02-15T09:30:00Z', facility_milestones: { name: 'patient_out' } },
        ],
      }),
      createCaseWithFinancials({
        id: 'case-2',
        completion_stats: { profit: 1200 } as CaseCompletionStats,
        case_milestones: [
          { facility_milestone_id: 'patient_in', recorded_at: '2026-02-15T08:00:00Z', facility_milestones: { name: 'patient_in' } },
          { facility_milestone_id: 'patient_out', recorded_at: '2026-02-15T10:00:00Z', facility_milestones: { name: 'patient_out' } },
        ],
      }),
      createCaseWithFinancials({
        id: 'case-3',
        completion_stats: { profit: 1500 } as CaseCompletionStats,
        case_milestones: [
          { facility_milestone_id: 'patient_in', recorded_at: '2026-02-15T09:00:00Z', facility_milestones: { name: 'patient_in' } },
          { facility_milestone_id: 'patient_out', recorded_at: '2026-02-15T11:00:00Z', facility_milestones: { name: 'patient_out' } },
        ],
      }),
    ]

    const baselines = buildBaselines(cases, ['case_profit'], true)

    expect(baselines.facility.get('case_profit')?.values).toBeDefined()
    expect(baselines.facility.get('case_profit')?.values).toEqual([800, 1200, 1500])
  })
})

// =====================================================
// PERCENTILE CALCULATION
// =====================================================

describe('calculatePercentile', () => {
  // Note: calculatePercentile is not exported, so we test it indirectly via percentile threshold rules

  it('calculates percentile for single value', () => {
    const rule = createFlagRule({
      metric: 'case_profit',
      threshold_type: 'percentile',
      threshold_value: 50,
      operator: 'lt',
    })

    const baselines: FlagBaselines = {
      facility: new Map([
        ['case_profit', { median: 1000, stdDev: 100, count: 1, values: [1000] }],
      ]),
      personal: new Map(),
    }

    const caseData = createCaseWithFinancials({
      completion_stats: { profit: 900 } as CaseCompletionStats,
    })

    const flags = evaluateCase(caseData, [rule], baselines, null, new Set(), null)

    expect(flags).toHaveLength(1)
    expect(flags[0].threshold_value).toBe(1000)
  })

  it('calculates percentile for two values', () => {
    const rule = createFlagRule({
      metric: 'case_profit',
      threshold_type: 'percentile',
      threshold_value: 50,
      operator: 'lt',
    })

    const baselines: FlagBaselines = {
      facility: new Map([
        ['case_profit', { median: 1250, stdDev: 250, count: 2, values: [1000, 1500] }],
      ]),
      personal: new Map(),
    }

    const caseData = createCaseWithFinancials({
      completion_stats: { profit: 900 } as CaseCompletionStats,
    })

    const flags = evaluateCase(caseData, [rule], baselines, null, new Set(), null)

    expect(flags).toHaveLength(1)
    // 50th percentile of [1000, 1500] = 1250
    expect(flags[0].threshold_value).toBe(1250)
  })

  it('calculates percentile with interpolation', () => {
    const rule = createFlagRule({
      metric: 'case_profit',
      threshold_type: 'percentile',
      threshold_value: 75,
      operator: 'gt',
    })

    const baselines: FlagBaselines = {
      facility: new Map([
        ['case_profit', {
          median: 1000,
          stdDev: 200,
          count: 5,
          values: [600, 800, 1000, 1200, 1400],
        }],
      ]),
      personal: new Map(),
    }

    const caseData = createCaseWithFinancials({
      completion_stats: { profit: 1350 } as CaseCompletionStats,
    })

    const flags = evaluateCase(caseData, [rule], baselines, null, new Set(), null)

    expect(flags).toHaveLength(1)
    // 75th percentile of [600, 800, 1000, 1200, 1400]
    // Index: 0.75 * (5-1) = 3 → value at index 3 = 1200
    expect(flags[0].threshold_value).toBe(1200)
  })
})

// =====================================================
// ALLOW_ZERO_OR_NEGATIVE GUARD
// =====================================================

describe('evaluateCase - Zero and Negative Value Handling', () => {
  it('evaluates negative profit values', () => {
    const rule = createFlagRule({
      metric: 'case_profit',
      threshold_type: 'absolute',
      threshold_value: 0,
      operator: 'lt',
    })

    const caseData = createCaseWithFinancials({
      completion_stats: { profit: -500 } as CaseCompletionStats,
    })

    const flags = evaluateCase(caseData, [rule], { facility: new Map(), personal: new Map() }, null, new Set(), null)

    expect(flags).toHaveLength(1)
    expect(flags[0].metric_value).toBe(-500)
  })

  it('evaluates zero profit values', () => {
    const rule = createFlagRule({
      metric: 'case_profit',
      threshold_type: 'absolute',
      threshold_value: 100,
      operator: 'lt',
    })

    const caseData = createCaseWithFinancials({
      completion_stats: { profit: 0 } as CaseCompletionStats,
    })

    const flags = evaluateCase(caseData, [rule], { facility: new Map(), personal: new Map() }, null, new Set(), null)

    expect(flags).toHaveLength(1)
    expect(flags[0].metric_value).toBe(0)
  })

  it('evaluates negative margin values', () => {
    const rule = createFlagRule({
      metric: 'case_margin',
      threshold_type: 'absolute',
      threshold_value: 10,
      operator: 'lt',
    })

    const caseData = createCaseWithFinancials({
      completion_stats: { profit: -1000, reimbursement: 5000 } as CaseCompletionStats,
    })

    const flags = evaluateCase(caseData, [rule], { facility: new Map(), personal: new Map() }, null, new Set(), null)

    expect(flags).toHaveLength(1)
    expect(flags[0].metric_value).toBe(-20) // (-1000 / 5000) * 100
  })

  it('evaluates zero quality metrics', () => {
    const rule = createFlagRule({
      metric: 'missing_milestones',
      threshold_type: 'absolute',
      threshold_value: 0,
      operator: 'gt',
    })

    const caseData = createCaseWithFinancials({
      case_milestones: [
        { facility_milestone_id: 'patient_in', recorded_at: '2026-02-15T07:30:00Z' },
        { facility_milestone_id: 'anes_start', recorded_at: '2026-02-15T07:35:00Z' },
        { facility_milestone_id: 'anes_end', recorded_at: '2026-02-15T07:45:00Z' },
        { facility_milestone_id: 'prep_drape_complete', recorded_at: '2026-02-15T07:55:00Z' },
        { facility_milestone_id: 'incision', recorded_at: '2026-02-15T08:00:00Z' },
        { facility_milestone_id: 'closing', recorded_at: '2026-02-15T09:00:00Z' },
        { facility_milestone_id: 'closing_complete', recorded_at: '2026-02-15T09:10:00Z' },
        { facility_milestone_id: 'patient_out', recorded_at: '2026-02-15T09:30:00Z' },
      ] as never,
    })

    const flags = evaluateCase(caseData, [rule], { facility: new Map(), personal: new Map() }, null, new Set(), null)

    // 0 missing milestones is NOT > 0, so should not flag
    expect(flags).toHaveLength(0)
  })

  it('does NOT evaluate zero/negative timing metrics', () => {
    const rule = createFlagRule({
      metric: 'surgical_time',
      threshold_type: 'absolute',
      threshold_value: 30,
      operator: 'lt',
    })

    // Case with invalid milestones resulting in 0 or negative duration
    const caseData = createCaseWithFinancials({
      case_milestones: [
        { facility_milestone_id: 'incision', recorded_at: '2026-02-15T08:00:00Z' },
        { facility_milestone_id: 'closing', recorded_at: '2026-02-15T08:00:00Z' }, // Same time = 0 duration
      ] as never,
    })

    const flags = evaluateCase(caseData, [rule], { facility: new Map(), personal: new Map() }, null, new Set(), null)

    // Timing metrics with value <= 0 should be skipped (bad milestone data)
    expect(flags).toHaveLength(0)
  })
})
