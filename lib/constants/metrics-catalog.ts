// lib/constants/metrics-catalog.ts
// Static metrics catalog for the flag rule builder.
// Dynamic per-cost-category metrics are generated at runtime from the facility's cost_categories.

import type {
  MetricCatalogEntry,
  MetricCategory,
  MetricCategoryConfig,
  Operator,
  ThresholdType,
} from '@/types/flag-settings'

// =====================================================
// OPERATORS
// =====================================================

export const OPERATORS: ReadonlyArray<{ id: Operator; label: string; symbol: string }> = [
  { id: 'gt', label: 'Greater than', symbol: '>' },
  { id: 'gte', label: 'Greater than or equal', symbol: '≥' },
  { id: 'lt', label: 'Less than', symbol: '<' },
  { id: 'lte', label: 'Less than or equal', symbol: '≤' },
] as const

// =====================================================
// THRESHOLD TYPES
// =====================================================

export const THRESHOLD_TYPES: ReadonlyArray<{ id: ThresholdType; label: string; description: string }> = [
  {
    id: 'median_plus_sd',
    label: 'Median + Std Deviations',
    description: 'Flag when value exceeds the median by N standard deviations',
  },
  {
    id: 'median_plus_offset',
    label: 'Median + Offset',
    description: 'Flag when value exceeds the median by a fixed amount',
  },
  {
    id: 'absolute',
    label: 'Absolute Value',
    description: 'Flag when value exceeds a fixed number',
  },
  {
    id: 'percentage_of_median',
    label: '% of Median',
    description: 'Flag when value exceeds N% above or below the facility median',
  },
  {
    id: 'percentile',
    label: 'Percentile',
    description: 'Flag when value is above or below the Nth percentile',
  },
  {
    id: 'between',
    label: 'Between (Range)',
    description: 'Flag when value falls within a specified range',
  },
] as const

// =====================================================
// METRIC CATEGORIES
// =====================================================

export const METRIC_CATEGORIES: ReadonlyArray<MetricCategoryConfig> = [
  { id: 'timing', label: 'Timing', colorKey: 'timing' },
  { id: 'efficiency', label: 'Efficiency', colorKey: 'efficiency' },
  { id: 'financial', label: 'Financial', colorKey: 'financial' },
  { id: 'quality', label: 'Quality', colorKey: 'quality' },
] as const

// =====================================================
// STATIC METRICS CATALOG (~21 metrics)
// =====================================================

export const METRICS_CATALOG: ReadonlyArray<MetricCatalogEntry> = [
  // ---- Timing (7) ----
  {
    id: 'total_case_time',
    name: 'Total Case Time',
    description: 'Duration from patient in to patient out',
    category: 'timing',
    dataType: 'minutes',
    unit: 'min',
    source: 'case_milestone_stats',
    startMilestone: 'patient_in',
    endMilestone: 'patient_out',
    supportsMedian: true,
  },
  {
    id: 'surgical_time',
    name: 'Surgical Time',
    description: 'Duration from incision to closing',
    category: 'timing',
    dataType: 'minutes',
    unit: 'min',
    source: 'case_milestone_stats',
    startMilestone: 'incision',
    endMilestone: 'closing',
    supportsMedian: true,
  },
  {
    id: 'pre_op_time',
    name: 'Pre-Op Time',
    description: 'Duration from patient in to incision',
    category: 'timing',
    dataType: 'minutes',
    unit: 'min',
    source: 'case_milestone_stats',
    startMilestone: 'patient_in',
    endMilestone: 'incision',
    supportsMedian: true,
  },
  {
    id: 'anesthesia_time',
    name: 'Anesthesia Induction',
    description: 'Duration from anesthesia start to anesthesia end',
    category: 'timing',
    dataType: 'minutes',
    unit: 'min',
    source: 'case_milestone_stats',
    startMilestone: 'anes_start',
    endMilestone: 'anes_end',
    supportsMedian: true,
  },
  {
    id: 'closing_time',
    name: 'Closing Time',
    description: 'Duration from closing start to closing complete',
    category: 'timing',
    dataType: 'minutes',
    unit: 'min',
    source: 'case_milestone_stats',
    startMilestone: 'closing',
    endMilestone: 'closing_complete',
    supportsMedian: true,
  },
  {
    id: 'emergence_time',
    name: 'Emergence Time',
    description: 'Duration from closing complete to patient out',
    category: 'timing',
    dataType: 'minutes',
    unit: 'min',
    source: 'case_milestone_stats',
    startMilestone: 'closing_complete',
    endMilestone: 'patient_out',
    supportsMedian: true,
  },
  {
    id: 'prep_to_incision',
    name: 'Prep to Incision',
    description: 'Duration from prep/drape complete to incision',
    category: 'timing',
    dataType: 'minutes',
    unit: 'min',
    source: 'case_milestone_stats',
    startMilestone: 'prep_drape_complete',
    endMilestone: 'incision',
    supportsMedian: true,
  },

  // ---- Efficiency (5) ----
  {
    id: 'turnover_time',
    name: 'Room Turnover',
    description: 'Time between patient out (prev case) and patient in (next case) in same room',
    category: 'efficiency',
    dataType: 'minutes',
    unit: 'min',
    source: 'computed',
    startMilestone: null,
    endMilestone: null,
    supportsMedian: true,
  },
  {
    id: 'fcots_delay',
    name: 'First Case Delay',
    description: 'Minutes late for first case of the day',
    category: 'efficiency',
    dataType: 'minutes',
    unit: 'min',
    source: 'case_milestone_stats',
    startMilestone: null,
    endMilestone: null,
    supportsMedian: false,
  },
  {
    id: 'surgeon_readiness_gap',
    name: 'Surgeon Readiness Gap',
    description: 'Gap between prep/drape complete and incision',
    category: 'efficiency',
    dataType: 'minutes',
    unit: 'min',
    source: 'case_milestone_stats',
    startMilestone: 'prep_drape_complete',
    endMilestone: 'incision',
    supportsMedian: true,
  },
  {
    id: 'callback_delay',
    name: 'Callback Delay',
    description: 'Delay from callback request to surgeon arrival',
    category: 'efficiency',
    dataType: 'minutes',
    unit: 'min',
    source: 'case_milestone_stats',
    startMilestone: null,
    endMilestone: null,
    supportsMedian: true,
  },
  {
    id: 'room_idle_gap',
    name: 'Room Idle Gap',
    description: 'Gap between cases in same room beyond standard turnover',
    category: 'efficiency',
    dataType: 'minutes',
    unit: 'min',
    source: 'computed',
    startMilestone: null,
    endMilestone: null,
    supportsMedian: true,
  },

  // ---- Financial (7) ----
  {
    id: 'case_profit',
    name: 'Case Profit',
    description: 'Net profit (reimbursement minus total cost)',
    category: 'financial',
    dataType: 'currency',
    unit: '$',
    source: 'case_completion_stats',
    startMilestone: null,
    endMilestone: null,
    supportsMedian: true,
  },
  {
    id: 'case_margin',
    name: 'Case Margin',
    description: 'Profit margin as percentage of reimbursement',
    category: 'financial',
    dataType: 'percentage',
    unit: '%',
    source: 'case_completion_stats',
    startMilestone: null,
    endMilestone: null,
    supportsMedian: true,
  },
  {
    id: 'profit_per_minute',
    name: 'Profit per Minute',
    description: 'Profit divided by total case duration',
    category: 'financial',
    dataType: 'currency',
    unit: '$/min',
    source: 'case_completion_stats',
    startMilestone: null,
    endMilestone: null,
    supportsMedian: true,
  },
  {
    id: 'total_case_cost',
    name: 'Total Case Cost',
    description: 'Sum of all costs (debits + OR time cost)',
    category: 'financial',
    dataType: 'currency',
    unit: '$',
    source: 'case_completion_stats',
    startMilestone: null,
    endMilestone: null,
    supportsMedian: true,
  },
  {
    id: 'reimbursement_variance',
    name: 'Reimbursement Variance',
    description: 'Percentage difference between actual and expected reimbursement',
    category: 'financial',
    dataType: 'percentage',
    unit: '%',
    source: 'case_completion_stats',
    startMilestone: null,
    endMilestone: null,
    supportsMedian: false,
  },
  {
    id: 'or_time_cost',
    name: 'OR Time Cost',
    description: 'Cost of operating room time based on facility hourly rate',
    category: 'financial',
    dataType: 'currency',
    unit: '$',
    source: 'case_completion_stats',
    startMilestone: null,
    endMilestone: null,
    supportsMedian: true,
  },
  {
    id: 'excess_time_cost',
    name: 'Excess Time Cost',
    description: 'Cost of minutes beyond median duration at facility OR rate',
    category: 'financial',
    dataType: 'currency',
    unit: '$',
    source: 'computed',
    startMilestone: null,
    endMilestone: null,
    supportsMedian: false,
  },

  // ---- Quality (2) ----
  {
    id: 'missing_milestones',
    name: 'Missing Milestones',
    description: 'Count of expected milestones without a recorded timestamp',
    category: 'quality',
    dataType: 'count',
    unit: '',
    source: 'case_milestones',
    startMilestone: null,
    endMilestone: null,
    supportsMedian: false,
  },
  {
    id: 'milestone_out_of_order',
    name: 'Milestone Sequence Error',
    description: 'Count of milestones recorded out of expected sequence',
    category: 'quality',
    dataType: 'count',
    unit: '',
    source: 'case_milestones',
    startMilestone: null,
    endMilestone: null,
    supportsMedian: false,
  },
] as const

// =====================================================
// HELPERS
// =====================================================

/** Look up a metric by ID. Returns undefined if not found (e.g., dynamic metric). */
export function getMetricById(id: string): MetricCatalogEntry | undefined {
  return METRICS_CATALOG.find(m => m.id === id)
}

/** Get all static metrics for a given category. */
export function getMetricsByCategory(category: MetricCategory): ReadonlyArray<MetricCatalogEntry> {
  return METRICS_CATALOG.filter(m => m.category === category)
}
