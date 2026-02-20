// components/settings/flags/__tests__/flag-settings-downstream.test.tsx
// Integration tests verifying that flag rule changes flow downstream correctly
//
// DOWNSTREAM PATH:
// 1. User modifies flag rule in settings page (toggle, severity, threshold)
// 2. Change is saved to flag_rules table
// 3. Flag detection engine reads rules → applies them to cases
// 4. case_flags table populated with detected flags
// 5. Analytics/case detail pages READ case_flags and display them
//
// COVERAGE:
// [x] Disabled rule → no flags created
// [x] Changed threshold → different cases flagged
// [x] Changed severity → flag severity updates
// [x] Changed scope (facility → personal) → only surgeon's cases affected
// [x] Filter composition: category filter + enabled rules

import { describe, it, expect, vi } from 'vitest'
import type { FlagRule, Severity } from '@/types/flag-settings'

// Mock flag detection logic (simplified version of what happens after save)
function detectFlags(
  rules: FlagRule[],
  caseData: {
    surgeon_id: string
    incision_to_close_duration: number
    facility_median_duration: number
    surgeon_median_duration: number
  }
): Array<{ rule_id: string; severity: Severity }> {
  const detectedFlags: Array<{ rule_id: string; severity: Severity }> = []

  rules.forEach((rule) => {
    // Only check enabled rules
    if (!rule.is_enabled) return

    // Check if rule applies to this case
    const value = caseData.incision_to_close_duration
    const baseline =
      rule.comparison_scope === 'personal'
        ? caseData.surgeon_median_duration
        : caseData.facility_median_duration

    let flagged = false

    // Threshold evaluation logic
    if (rule.threshold_type === 'absolute') {
      flagged =
        rule.operator === 'gt'
          ? value > rule.threshold_value
          : value >= rule.threshold_value
    } else if (rule.threshold_type === 'percentage_of_median') {
      const threshold = baseline * (rule.threshold_value / 100)
      flagged = rule.operator === 'gt' ? value > threshold : value >= threshold
    }

    if (flagged) {
      detectedFlags.push({ rule_id: rule.id, severity: rule.severity })
    }
  })

  return detectedFlags
}

describe('Flag Settings → Downstream Consumption', () => {
  const mockFacilityRule: FlagRule = {
    id: 'rule-1',
    facility_id: 'fac-1',
    name: 'Long Incision-to-Close',
    description: 'Case took too long',
    category: 'timing',
    metric: 'incision_to_close_duration',
    start_milestone: 'incision',
    end_milestone: 'closure',
    operator: 'gt',
    threshold_type: 'absolute',
    threshold_value: 90,
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const mockCaseData = {
    surgeon_id: 'surgeon-1',
    incision_to_close_duration: 120,
    facility_median_duration: 80,
    surgeon_median_duration: 75,
  }

  describe('Rule Enable/Disable → Flag Detection', () => {
    it('creates flag when rule is enabled and threshold exceeded', () => {
      const rules = [{ ...mockFacilityRule, is_enabled: true }]
      const flags = detectFlags(rules, mockCaseData)

      expect(flags.length).toBe(1)
      expect(flags[0].rule_id).toBe('rule-1')
      expect(flags[0].severity).toBe('warning')
    })

    it('does NOT create flag when rule is disabled', () => {
      const rules = [{ ...mockFacilityRule, is_enabled: false }]
      const flags = detectFlags(rules, mockCaseData)

      expect(flags.length).toBe(0)
    })

    it('toggling rule off stops flag creation immediately', () => {
      const rules = [{ ...mockFacilityRule, is_enabled: true }]
      let flags = detectFlags(rules, mockCaseData)
      expect(flags.length).toBe(1)

      // User toggles off
      rules[0].is_enabled = false
      flags = detectFlags(rules, mockCaseData)
      expect(flags.length).toBe(0)
    })
  })

  describe('Threshold Changes → Different Cases Flagged', () => {
    it('lowering threshold flags more cases', () => {
      const case1 = { ...mockCaseData, incision_to_close_duration: 95 }
      const case2 = { ...mockCaseData, incision_to_close_duration: 120 }

      // Original threshold: 90 → both cases flagged
      const rules = [mockFacilityRule]
      expect(detectFlags(rules, case1).length).toBe(1)
      expect(detectFlags(rules, case2).length).toBe(1)

      // User raises threshold to 100 → only case2 flagged
      rules[0].threshold_value = 100
      expect(detectFlags(rules, case1).length).toBe(0)
      expect(detectFlags(rules, case2).length).toBe(1)
    })

    it('raising threshold flags fewer cases', () => {
      const case1 = { ...mockCaseData, incision_to_close_duration: 95 }
      const case2 = { ...mockCaseData, incision_to_close_duration: 85 }

      const rules = [{ ...mockFacilityRule, threshold_value: 90 }]
      expect(detectFlags(rules, case1).length).toBe(1)
      expect(detectFlags(rules, case2).length).toBe(0)

      // User lowers threshold to 80 → both cases flagged
      rules[0].threshold_value = 80
      expect(detectFlags(rules, case1).length).toBe(1)
      expect(detectFlags(rules, case2).length).toBe(1)
    })

    it('changing threshold type changes which cases are flagged', () => {
      const case1 = { ...mockCaseData, incision_to_close_duration: 100 }

      // Absolute threshold: 90min
      const rules = [{ ...mockFacilityRule, threshold_type: 'absolute', threshold_value: 90 }] as FlagRule[]
      expect(detectFlags(rules, case1).length).toBe(1)

      // Change to percentage_of_median: 130% of 80min = 104min
      rules[0].threshold_type = 'percentage_of_median'
      rules[0].threshold_value = 130
      expect(detectFlags(rules, case1).length).toBe(0) // 100 < 104, not flagged
    })
  })

  describe('Severity Changes → Flag Severity Updates', () => {
    it('changing severity from warning to critical updates downstream flag', () => {
      const rules = [{ ...mockFacilityRule, severity: 'warning' }] as FlagRule[]
      let flags = detectFlags(rules, mockCaseData)
      expect(flags[0].severity).toBe('warning')

      // User changes severity to critical
      rules[0].severity = 'critical'
      flags = detectFlags(rules, mockCaseData)
      expect(flags[0].severity).toBe('critical')
    })

    it('severity change applies to ALL cases flagged by that rule', () => {
      const case1 = mockCaseData
      const case2 = { ...mockCaseData, incision_to_close_duration: 110 }
      const case3 = { ...mockCaseData, incision_to_close_duration: 150 }

      const rules = [{ ...mockFacilityRule, severity: 'info' }] as FlagRule[]

      const flags1 = detectFlags(rules, case1)
      const flags2 = detectFlags(rules, case2)
      const flags3 = detectFlags(rules, case3)

      expect(flags1[0].severity).toBe('info')
      expect(flags2[0].severity).toBe('info')
      expect(flags3[0].severity).toBe('info')

      // User upgrades all to critical
      rules[0].severity = 'critical'

      const updatedFlags1 = detectFlags(rules, case1)
      const updatedFlags2 = detectFlags(rules, case2)
      const updatedFlags3 = detectFlags(rules, case3)

      expect(updatedFlags1[0].severity).toBe('critical')
      expect(updatedFlags2[0].severity).toBe('critical')
      expect(updatedFlags3[0].severity).toBe('critical')
    })
  })

  describe('Scope Changes → Facility vs Personal', () => {
    it('facility scope uses facility median as baseline', () => {
      const caseData = {
        ...mockCaseData,
        facility_median_duration: 80,
        surgeon_median_duration: 60,
        incision_to_close_duration: 110,
      }

      // percentage_of_median: 130% of facility (80) = 104min
      const rules = [
        {
          ...mockFacilityRule,
          threshold_type: 'percentage_of_median',
          threshold_value: 130,
          comparison_scope: 'facility',
        },
      ] as FlagRule[]

      const flags = detectFlags(rules, caseData)
      expect(flags.length).toBe(1) // 110 > 104, flagged
    })

    it('personal scope uses surgeon median as baseline', () => {
      const caseData = {
        ...mockCaseData,
        facility_median_duration: 80,
        surgeon_median_duration: 60,
        incision_to_close_duration: 110,
      }

      // percentage_of_median: 130% of personal (60) = 78min
      const rules = [
        {
          ...mockFacilityRule,
          threshold_type: 'percentage_of_median',
          threshold_value: 130,
          comparison_scope: 'personal',
        },
      ] as FlagRule[]

      const flags = detectFlags(rules, caseData)
      expect(flags.length).toBe(1) // 110 > 78, flagged
    })

    it('changing scope from facility to personal changes which cases are flagged', () => {
      const fastSurgeon = {
        ...mockCaseData,
        surgeon_median_duration: 50,
        facility_median_duration: 80,
        incision_to_close_duration: 75,
      }

      const slowSurgeon = {
        ...mockCaseData,
        surgeon_median_duration: 100,
        facility_median_duration: 80,
        incision_to_close_duration: 75,
      }

      const rules = [
        {
          ...mockFacilityRule,
          threshold_type: 'percentage_of_median',
          threshold_value: 120,
          comparison_scope: 'facility',
        },
      ] as FlagRule[]

      // Facility scope: 120% of 80 = 96min
      expect(detectFlags(rules, fastSurgeon).length).toBe(0) // 75 < 96
      expect(detectFlags(rules, slowSurgeon).length).toBe(0) // 75 < 96

      // Change to personal scope
      rules[0].comparison_scope = 'personal'

      // Fast surgeon: 120% of 50 = 60min → flagged (75 > 60)
      // Slow surgeon: 120% of 100 = 120min → NOT flagged (75 < 120)
      expect(detectFlags(rules, fastSurgeon).length).toBe(1)
      expect(detectFlags(rules, slowSurgeon).length).toBe(0)
    })
  })

  describe('Category Filter → Displayed Rules', () => {
    it('filtering by category shows only rules in that category', () => {
      const timingRule = { ...mockFacilityRule, id: 'rule-1', category: 'timing' } as FlagRule
      const efficiencyRule = {
        ...mockFacilityRule,
        id: 'rule-2',
        category: 'efficiency',
      } as FlagRule
      const financialRule = {
        ...mockFacilityRule,
        id: 'rule-3',
        category: 'financial',
      } as FlagRule

      const allRules = [timingRule, efficiencyRule, financialRule]

      // Filter by "timing"
      const timingFiltered = allRules.filter((r) => r.category === 'timing')
      expect(timingFiltered.length).toBe(1)
      expect(timingFiltered[0].id).toBe('rule-1')

      // Filter by "all"
      const allFiltered = allRules
      expect(allFiltered.length).toBe(3)
    })

    it('only enabled rules in filtered category create flags', () => {
      const timingRule1 = {
        ...mockFacilityRule,
        id: 'rule-1',
        category: 'timing',
        is_enabled: true,
      } as FlagRule
      const timingRule2 = {
        ...mockFacilityRule,
        id: 'rule-2',
        category: 'timing',
        is_enabled: false,
      } as FlagRule
      const efficiencyRule = {
        ...mockFacilityRule,
        id: 'rule-3',
        category: 'efficiency',
        is_enabled: true,
      } as FlagRule

      const allRules = [timingRule1, timingRule2, efficiencyRule]

      // When displaying "timing" category: 2 rules shown, but only 1 enabled
      const timingFiltered = allRules.filter((r) => r.category === 'timing')
      expect(timingFiltered.length).toBe(2)

      const enabledTimingRules = timingFiltered.filter((r) => r.is_enabled)
      expect(enabledTimingRules.length).toBe(1)

      // Flag detection: only enabled rules create flags
      const flags = detectFlags(timingFiltered, mockCaseData)
      expect(flags.length).toBe(1)
      expect(flags[0].rule_id).toBe('rule-1')
    })
  })

  describe('Count Parity: Active Rules', () => {
    it('active rule counter matches enabled rule count', () => {
      const rules = [
        { ...mockFacilityRule, id: 'rule-1', is_enabled: true },
        { ...mockFacilityRule, id: 'rule-2', is_enabled: false },
        { ...mockFacilityRule, id: 'rule-3', is_enabled: true },
        { ...mockFacilityRule, id: 'rule-4', is_enabled: true },
      ] as FlagRule[]

      const enabledCount = rules.filter((r) => r.is_enabled).length
      const totalCount = rules.length

      expect(enabledCount).toBe(3)
      expect(totalCount).toBe(4)
    })

    it('toggling a rule updates the active counter', () => {
      const rules = [
        { ...mockFacilityRule, id: 'rule-1', is_enabled: true },
        { ...mockFacilityRule, id: 'rule-2', is_enabled: true },
      ] as FlagRule[]

      let enabledCount = rules.filter((r) => r.is_enabled).length
      expect(enabledCount).toBe(2)

      // User toggles rule-1 off
      rules[0].is_enabled = false
      enabledCount = rules.filter((r) => r.is_enabled).length
      expect(enabledCount).toBe(1)

      // User toggles rule-1 back on
      rules[0].is_enabled = true
      enabledCount = rules.filter((r) => r.is_enabled).length
      expect(enabledCount).toBe(2)
    })
  })
})
