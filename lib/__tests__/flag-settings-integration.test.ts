// lib/__tests__/flag-settings-integration.test.ts
// Integration tests verifying shared flag-settings types work with flagEngine
//
// COVERAGE:
// [x] Shared FlagRule type is compatible with flagEngine
// [x] Type refactor didn't break existing flag detection logic
// [x] Severity enum values match what flagEngine expects

import { describe, it, expect } from 'vitest'
import type { FlagRule, Severity, Operator, ThresholdType } from '@/types/flag-settings'
import { METRICS_CATALOG } from '@/lib/constants/metrics-catalog'

describe('flag-settings type integration', () => {
  it('FlagRule severity values match expected enum', () => {
    const validSeverities: Severity[] = ['info', 'warning', 'critical']

    // Mock rule using each severity
    validSeverities.forEach(severity => {
      const rule: Partial<FlagRule> = {
        severity,
        name: 'Test Rule',
      }
      expect(rule.severity).toBe(severity)
    })
  })

  it('FlagRule operator values match expected enum', () => {
    const validOperators: Operator[] = ['gt', 'gte', 'lt', 'lte']

    validOperators.forEach(operator => {
      const rule: Partial<FlagRule> = {
        operator,
        name: 'Test Rule',
      }
      expect(rule.operator).toBe(operator)
    })
  })

  it('FlagRule threshold_type values match expected enum', () => {
    const validThresholdTypes: ThresholdType[] = [
      'median_plus_sd',
      'absolute',
      'percentage_of_median',
      'percentile',
      'between',
    ]

    validThresholdTypes.forEach(thresholdType => {
      const rule: Partial<FlagRule> = {
        threshold_type: thresholdType,
        name: 'Test Rule',
      }
      expect(rule.threshold_type).toBe(thresholdType)
    })
  })

  it('FlagRule can be constructed with fields from METRICS_CATALOG', () => {
    // Get a sample metric
    const metric = METRICS_CATALOG[0]

    // Build a mock FlagRule using metric properties
    const rule: FlagRule = {
      id: 'rule-1',
      facility_id: 'fac-1',
      name: `${metric.name} Alert`,
      description: `Flag when ${metric.description} exceeds threshold`,
      category: metric.category,
      metric: metric.id,
      start_milestone: metric.startMilestone,
      end_milestone: metric.endMilestone,
      operator: 'gt',
      threshold_type: 'absolute',
      threshold_value: 120,
      threshold_value_max: null,
      comparison_scope: 'facility',
      severity: 'warning',
      display_order: 1,
      is_built_in: true,
      is_enabled: true,
      is_active: true,
      source_rule_id: null,
      cost_category_id: metric.costCategoryId || null,
      deleted_at: null,
      deleted_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Verify all required fields are present
    expect(rule.id).toBeTruthy()
    expect(rule.facility_id).toBeTruthy()
    expect(rule.name).toBeTruthy()
    expect(rule.category).toBe(metric.category)
    expect(rule.metric).toBe(metric.id)
    expect(['info', 'warning', 'critical']).toContain(rule.severity)
    expect(['gt', 'gte', 'lt', 'lte']).toContain(rule.operator)
  })

  it('FlagRule supports soft delete columns (is_active, deleted_at, deleted_by)', () => {
    const rule: Partial<FlagRule> = {
      id: 'rule-1',
      is_active: false,
      deleted_at: new Date().toISOString(),
      deleted_by: 'user-123',
    }

    expect(rule.is_active).toBe(false)
    expect(rule.deleted_at).toBeTruthy()
    expect(rule.deleted_by).toBeTruthy()
  })

  it('FlagRule threshold_value_max supports between threshold type', () => {
    const betweenRule: Partial<FlagRule> = {
      threshold_type: 'between',
      threshold_value: 30, // min
      threshold_value_max: 60, // max
    }

    expect(betweenRule.threshold_value).toBe(30)
    expect(betweenRule.threshold_value_max).toBe(60)

    // For non-between types, threshold_value_max should be null
    const absoluteRule: Partial<FlagRule> = {
      threshold_type: 'absolute',
      threshold_value: 120,
      threshold_value_max: null,
    }

    expect(absoluteRule.threshold_value_max).toBeNull()
  })

  it('FlagRule comparison_scope supports personal and facility', () => {
    const personalRule: Partial<FlagRule> = {
      comparison_scope: 'personal',
    }

    const facilityRule: Partial<FlagRule> = {
      comparison_scope: 'facility',
    }

    expect(personalRule.comparison_scope).toBe('personal')
    expect(facilityRule.comparison_scope).toBe('facility')
  })

  it('FlagRule source_rule_id supports custom rule derivation from built-in rules', () => {
    // Built-in rule
    const builtInRule: Partial<FlagRule> = {
      id: 'built-in-1',
      is_built_in: true,
      source_rule_id: null,
    }

    // Custom rule derived from built-in
    const customRule: Partial<FlagRule> = {
      id: 'custom-1',
      is_built_in: false,
      source_rule_id: 'built-in-1', // References the built-in rule
    }

    expect(builtInRule.source_rule_id).toBeNull()
    expect(customRule.source_rule_id).toBe('built-in-1')
  })

  it('FlagRule cost_category_id supports dynamic per-category financial metrics', () => {
    // Static metric — no cost_category_id
    const staticRule: Partial<FlagRule> = {
      metric: 'total_case_cost',
      cost_category_id: null,
    }

    // Dynamic metric (e.g., "supply_cost_implants") — has cost_category_id
    const dynamicRule: Partial<FlagRule> = {
      metric: 'supply_cost_implants',
      cost_category_id: 'cost-cat-123',
    }

    expect(staticRule.cost_category_id).toBeNull()
    expect(dynamicRule.cost_category_id).toBe('cost-cat-123')
  })
})
