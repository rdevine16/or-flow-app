// types/flag-settings.ts
// Shared types for the flag settings system.
// Used by: app/settings/flags/page.tsx, lib/flagEngine.ts, lib/dal/flag-rules.ts

import type { CaseWithMilestones } from '@/lib/analyticsV2'

// =====================================================
// DATABASE ROW TYPE
// =====================================================

export interface FlagRule {
  id: string
  facility_id: string
  name: string
  description: string | null
  category: string
  metric: string
  start_milestone: string | null
  end_milestone: string | null
  operator: Operator
  threshold_type: ThresholdType
  threshold_value: number
  threshold_value_max: number | null
  comparison_scope: ComparisonScope
  severity: Severity
  display_order: number
  is_built_in: boolean
  is_enabled: boolean
  is_active: boolean
  source_rule_id: string | null
  cost_category_id: string | null
  deleted_at: string | null
  deleted_by: string | null
  created_at: string
  updated_at: string
}

// =====================================================
// ENUMS / LITERALS
// =====================================================

export type Severity = 'info' | 'warning' | 'critical'

export type Operator = 'gt' | 'gte' | 'lt' | 'lte'

export type ThresholdType =
  | 'median_plus_sd'
  | 'absolute'
  | 'percentage_of_median'
  | 'percentile'
  | 'between'

export type ComparisonScope = 'personal' | 'facility'

export type MetricCategory =
  | 'timing'
  | 'efficiency'
  | 'financial'
  | 'quality'

export type MetricDataType = 'minutes' | 'currency' | 'percentage' | 'count'

export type MetricSource =
  | 'case_milestone_stats'
  | 'case_completion_stats'
  | 'computed'
  | 'case_milestones'

// =====================================================
// METRICS CATALOG TYPES
// =====================================================

export interface MetricCatalogEntry {
  id: string
  name: string
  description: string
  category: MetricCategory
  dataType: MetricDataType
  unit: string
  source: MetricSource
  startMilestone: string | null
  endMilestone: string | null
  supportsMedian: boolean
  /** Set when this metric is dynamically generated from a cost category */
  costCategoryId?: string
}

// =====================================================
// BUILDER FORM STATE
// =====================================================

export interface CustomRuleFormState {
  metricId: string
  name: string
  description: string
  thresholdType: ThresholdType
  operator: Operator
  thresholdValue: number
  thresholdValueMax: number | null
  severity: Severity
  comparisonScope: ComparisonScope
  costCategoryId: string | null
}

// =====================================================
// CATEGORY CONFIG
// =====================================================

export interface MetricCategoryConfig {
  id: MetricCategory
  label: string
  colorKey: string
}

// =====================================================
// FINANCIAL DATA TYPES (for flag engine)
// =====================================================

/** Financial data from case_completion_stats used for flag evaluation */
export interface CaseCompletionStats {
  profit: number | null
  reimbursement: number | null
  total_debits: number | null
  or_time_cost: number | null
  total_duration_minutes: number | null
  or_hourly_rate: number | null
}

/**
 * Extended case type with optional financial/quality data for flag evaluation.
 * All additional fields are optional, so plain CaseWithMilestones objects
 * are structurally compatible with this type.
 */
export interface CaseWithFinancials extends CaseWithMilestones {
  /** Financial data from case_completion_stats */
  completion_stats?: CaseCompletionStats | null
  /** Expected reimbursement from procedure_reimbursements (for variance calculation) */
  expected_reimbursement?: number | null
  /** Per-cost-category dollar amounts: cost_category_id → amount */
  category_costs?: Record<string, number>
}
