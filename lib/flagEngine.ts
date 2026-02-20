// ============================================
// lib/flagEngine.ts
// ============================================
// Evaluates cases against configured flag rules
// and produces case_flags for insertion.
//
// This module uses the same milestone map and duration
// calculation functions from analyticsV2.ts to ensure
// consistency between flag detection and dashboard metrics.
// ============================================

import {
  getMilestoneMap,
  getTimeDiffMinutes,
  calculateMedian,
  calculateStdDev,
  parseScheduledDateTime,
  type CaseWithMilestones,
  type MilestoneMap,
} from './analyticsV2'

// ============================================
// TYPES
// ============================================

// Re-export the shared FlagRule type for consumers that import from flagEngine
export type { FlagRule } from '@/types/flag-settings'
import type { FlagRule, CaseWithFinancials } from '@/types/flag-settings'

export interface CaseFlag {
  case_id: string
  facility_id: string
  flag_type: 'threshold' | 'delay'
  flag_rule_id: string | null
  metric_value: number | null
  threshold_value: number | null
  comparison_scope: string | null
  delay_type_id: string | null
  duration_minutes: number | null
  severity: string
  note: string | null
  created_by: string | null
}

export interface BaselineEntry {
  median: number
  stdDev: number
  count: number
  /** Sorted values for percentile calculation — only populated when percentile rules are active */
  values?: number[]
}

export interface FlagBaselines {
  // Facility-wide baselines by metric+procedure
  facility: Map<string, BaselineEntry>
  // Per-surgeon baselines by metric+procedure+surgeon
  personal: Map<string, BaselineEntry>
}

// ============================================
// METRIC EXTRACTION
// ============================================

/**
 * Extract a metric value from a case's milestone map.
 * Returns the duration in minutes for the given metric key.
 * 
 * For milestone-pair metrics (total_case_time, surgical_time, etc.),
 * uses the start/end milestone names from the flag rule.
 * 
 * For cross-case metrics (turnover_time, fcots_delay),
 * these require context beyond a single case and are handled separately.
 */
export function extractMetricValue(
  milestones: MilestoneMap,
  metric: string,
  startMilestone?: string | null,
  endMilestone?: string | null,
  caseData?: CaseWithFinancials
): number | null {
  // Direct milestone-pair metrics
  if (startMilestone && endMilestone) {
    const start = milestones[startMilestone as keyof MilestoneMap]
    const end = milestones[endMilestone as keyof MilestoneMap]
    return getTimeDiffMinutes(start, end)
  }

  // Named metric shortcuts (fallback if milestones not specified on rule)
  switch (metric) {
    // ---- Timing ----
    case 'total_case_time':
      return getTimeDiffMinutes(milestones.patient_in, milestones.patient_out)
    case 'surgical_time':
      return getTimeDiffMinutes(milestones.incision, milestones.closing)
    case 'pre_op_time':
      return getTimeDiffMinutes(milestones.patient_in, milestones.incision)
    case 'anesthesia_time':
      return getTimeDiffMinutes(milestones.anes_start, milestones.anes_end)
    case 'closing_time':
      return getTimeDiffMinutes(milestones.closing, milestones.closing_complete)
    case 'emergence_time':
      return getTimeDiffMinutes(milestones.closing_complete, milestones.patient_out)
    case 'prep_to_incision':
    case 'surgeon_readiness_gap':
      return getTimeDiffMinutes(milestones.prep_drape_complete, milestones.incision)

    // ---- Efficiency ----
    case 'fcots_delay':
      return extractFCOTSDelay(milestones, caseData)
    // turnover_time and room_idle_gap are cross-case — handled in evaluateCase

    // ---- Financial (from case_completion_stats) ----
    case 'case_profit':
      return caseData?.completion_stats?.profit ?? null
    case 'case_margin': {
      const stats = caseData?.completion_stats
      if (stats?.profit == null || stats?.reimbursement == null || stats.reimbursement === 0) return null
      return (stats.profit / stats.reimbursement) * 100
    }
    case 'profit_per_minute': {
      const stats = caseData?.completion_stats
      if (stats?.profit == null || stats?.total_duration_minutes == null || stats.total_duration_minutes === 0) return null
      return stats.profit / stats.total_duration_minutes
    }
    case 'total_case_cost': {
      const stats = caseData?.completion_stats
      if (stats?.total_debits == null && stats?.or_time_cost == null) return null
      return (stats?.total_debits ?? 0) + (stats?.or_time_cost ?? 0)
    }
    case 'reimbursement_variance': {
      const stats = caseData?.completion_stats
      const expected = caseData?.expected_reimbursement
      if (stats?.reimbursement == null || expected == null || expected === 0) return null
      return ((stats.reimbursement - expected) / expected) * 100
    }
    case 'or_time_cost':
      return caseData?.completion_stats?.or_time_cost ?? null
    // excess_time_cost is computed (needs baselines) — handled in evaluateCase

    // ---- Quality ----
    case 'missing_milestones':
      return countMissingMilestones(milestones)
    case 'milestone_out_of_order':
      return countSequenceViolations(milestones)

    default:
      return null
  }
}

/**
 * Extract FCOTS delay for a case.
 * Returns minutes late (positive = late, 0 or negative = on time).
 * Only applicable to first cases of the day per room.
 */
function extractFCOTSDelay(
  milestones: MilestoneMap,
  caseData?: CaseWithMilestones
): number | null {
  if (!caseData?.scheduled_date || !caseData?.start_time) return null
  
  const scheduled = parseScheduledDateTime(caseData.scheduled_date, caseData.start_time)
  const actual = milestones.patient_in
  
  if (!scheduled || !actual) return null
  return getTimeDiffMinutes(scheduled, actual)
}


// ============================================
// QUALITY METRIC HELPERS
// ============================================

/**
 * Core milestones expected in every case, in correct sequence order.
 */
const CORE_MILESTONE_SEQUENCE: (keyof MilestoneMap)[] = [
  'patient_in',
  'anes_start',
  'anes_end',
  'prep_drape_complete',
  'incision',
  'closing',
  'closing_complete',
  'patient_out',
]

/**
 * Count the number of core milestones missing from a case.
 */
function countMissingMilestones(milestones: MilestoneMap): number {
  let missing = 0
  for (const key of CORE_MILESTONE_SEQUENCE) {
    if (!milestones[key]) missing++
  }
  return missing
}

/**
 * Count the number of milestone sequence violations.
 * A violation occurs when a later milestone has an earlier timestamp
 * than a preceding milestone in the expected sequence.
 */
function countSequenceViolations(milestones: MilestoneMap): number {
  let violations = 0
  const recorded = CORE_MILESTONE_SEQUENCE
    .filter(key => milestones[key] != null)
    .map(key => ({ key, time: milestones[key]! }))

  for (let i = 1; i < recorded.length; i++) {
    if (recorded[i].time < recorded[i - 1].time) {
      violations++
    }
  }
  return violations
}

/**
 * Metrics that can have zero or negative values (financial, quality).
 * For these, we don't skip evaluation when value <= 0.
 */
const ALLOW_ZERO_OR_NEGATIVE = new Set([
  'case_profit', 'case_margin', 'profit_per_minute', 'total_case_cost',
  'reimbursement_variance', 'or_time_cost', 'excess_time_cost',
  'missing_milestones', 'milestone_out_of_order',
])

/**
 * Calculate the Nth percentile from a sorted array of values.
 * Uses linear interpolation between adjacent values.
 */
function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0
  if (sortedValues.length === 1) return sortedValues[0]

  const idx = (percentile / 100) * (sortedValues.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)

  if (lower === upper) return sortedValues[lower]
  const weight = idx - lower
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight
}


// ============================================
// BASELINE CALCULATION
// ============================================

/**
 * Build baseline statistics (median + stdDev) for all metrics
 * across a set of historical cases.
 * 
 * Keys are formatted as:
 *   facility: "{metric}" or "{metric}:{procedure_type_id}"
 *   personal: "{metric}:{surgeon_id}" or "{metric}:{surgeon_id}:{procedure_type_id}"
 * 
 * This runs once per evaluation batch (not per case).
 */
export function buildBaselines(
  historicalCases: CaseWithFinancials[],
  metrics: string[],
  needsPercentileValues?: boolean
): FlagBaselines {
  const facilityValues = new Map<string, number[]>()
  const personalValues = new Map<string, number[]>()

  // Milestone-pair metrics: canonical start/end milestones
  const metricDefs: Record<string, { start: string | null; end: string | null }> = {
    total_case_time: { start: 'patient_in', end: 'patient_out' },
    surgical_time: { start: 'incision', end: 'closing' },
    pre_op_time: { start: 'patient_in', end: 'incision' },
    anesthesia_time: { start: 'anes_start', end: 'anes_end' },
    closing_time: { start: 'closing', end: 'closing_complete' },
    emergence_time: { start: 'closing_complete', end: 'patient_out' },
    surgeon_readiness_gap: { start: 'prep_drape_complete', end: 'incision' },
    prep_to_incision: { start: 'prep_drape_complete', end: 'incision' },
  }

  // Metrics that are cross-case or depend on baselines themselves (skip)
  const SKIP_FOR_BASELINES = new Set([
    'turnover_time', 'fcots_delay', 'room_idle_gap', 'excess_time_cost',
  ])

  historicalCases.forEach(c => {
    const m = getMilestoneMap(c)
    const surgeonId = c.surgeon_id ?? null
    const procedureId = c.procedure_types?.id ?? null

    metrics.forEach(metric => {
      if (SKIP_FOR_BASELINES.has(metric)) return

      const def = metricDefs[metric]
      const value = extractMetricValue(m, metric, def?.start ?? null, def?.end ?? null, c)
      if (value === null) return
      if (!ALLOW_ZERO_OR_NEGATIVE.has(metric) && value <= 0) return

      // Facility-wide baseline (by metric, optionally by procedure)
      const facilityKey = procedureId ? `${metric}:${procedureId}` : metric
      if (!facilityValues.has(facilityKey)) facilityValues.set(facilityKey, [])
      facilityValues.get(facilityKey)!.push(value)

      // Also store without procedure for fallback
      if (procedureId) {
        if (!facilityValues.has(metric)) facilityValues.set(metric, [])
        facilityValues.get(metric)!.push(value)
      }

      // Per-surgeon baseline
      if (surgeonId) {
        const personalKey = procedureId
          ? `${metric}:${surgeonId}:${procedureId}`
          : `${metric}:${surgeonId}`
        if (!personalValues.has(personalKey)) personalValues.set(personalKey, [])
        personalValues.get(personalKey)!.push(value)

        // Also store without procedure for fallback
        const personalFallback = `${metric}:${surgeonId}`
        if (procedureId && personalFallback !== personalKey) {
          if (!personalValues.has(personalFallback)) personalValues.set(personalFallback, [])
          personalValues.get(personalFallback)!.push(value)
        }
      }
    })
  })

  // Convert value arrays to statistics
  const toStats = (valuesMap: Map<string, number[]>) => {
    const statsMap = new Map<string, BaselineEntry>()
    valuesMap.forEach((values, key) => {
      const median = calculateMedian(values)
      const stdDev = calculateStdDev(values)
      if (median !== null && stdDev !== null && values.length >= 3) {
        const entry: BaselineEntry = { median, stdDev, count: values.length }
        if (needsPercentileValues) {
          entry.values = [...values].sort((a, b) => a - b)
        }
        statsMap.set(key, entry)
      }
    })
    return statsMap
  }

  return {
    facility: toStats(facilityValues),
    personal: toStats(personalValues),
  }
}


// ============================================
// TURNOVER BASELINES
// ============================================

/**
 * Build turnover baselines from historical cases.
 * Turnover is a cross-case metric: patient_out (Case A) → patient_in (Case B) in same room.
 * Returns facility-level baseline only.
 */
export function buildTurnoverBaseline(
  historicalCases: CaseWithMilestones[]
): { median: number; stdDev: number; count: number } | null {
  const turnovers: number[] = []

  // Group by room and date
  const byRoomDate = new Map<string, CaseWithMilestones[]>()
  historicalCases.forEach(c => {
    if (!c.or_room_id) return
    const key = `${c.scheduled_date}|${c.or_room_id}`
    const existing = byRoomDate.get(key) || []
    existing.push(c)
    byRoomDate.set(key, existing)
  })

  byRoomDate.forEach((roomCases) => {
    const sorted = roomCases.sort((a, b) =>
      (a.start_time || '').localeCompare(b.start_time || '')
    )

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = getMilestoneMap(sorted[i])
      const next = getMilestoneMap(sorted[i + 1])

      if (current.patient_out && next.patient_in) {
        const turnoverMinutes = getTimeDiffMinutes(current.patient_out, next.patient_in)
        if (turnoverMinutes !== null && turnoverMinutes > 0 && turnoverMinutes < 180) {
          turnovers.push(turnoverMinutes)
        }
      }
    }
  })

  if (turnovers.length < 3) return null

  const median = calculateMedian(turnovers)
  const stdDev = calculateStdDev(turnovers)

  if (median === null || stdDev === null) return null
  return { median, stdDev, count: turnovers.length }
}


// ============================================
// FIRST CASE IDENTIFICATION
// ============================================

/**
 * Determine which cases are the first case in their room for the day.
 * Returns a Set of case IDs that are first cases.
 */
export function identifyFirstCases(cases: CaseWithMilestones[]): Set<string> {
  const firstCases = new Set<string>()
  const byRoomDate = new Map<string, CaseWithMilestones>()

  cases.forEach(c => {
    if (!c.or_room_id || !c.start_time) return
    const key = `${c.scheduled_date}|${c.or_room_id}`
    const existing = byRoomDate.get(key)

    if (!existing || (c.start_time < (existing.start_time || ''))) {
      byRoomDate.set(key, c)
    }
  })

  byRoomDate.forEach(c => firstCases.add(c.id))
  return firstCases
}


// ============================================
// CORE FLAG EVALUATION
// ============================================

/**
 * Compare a metric value against a threshold using the specified operator.
 */
function compareValue(
  actual: number,
  threshold: number,
  operator: string
): boolean {
  switch (operator) {
    case 'gt': return actual > threshold
    case 'gte': return actual >= threshold
    case 'lt': return actual < threshold
    case 'lte': return actual <= threshold
    default: return false
  }
}

/**
 * Resolve the effective threshold value for a rule.
 * For 'median_plus_sd': threshold = median + (threshold_value * stdDev)
 * For 'absolute': threshold = threshold_value directly
 */
function resolveThreshold(
  rule: FlagRule,
  baseline: BaselineEntry | undefined
): number | null {
  switch (rule.threshold_type) {
    case 'absolute':
      return rule.threshold_value

    case 'median_plus_sd':
      if (!baseline) return null
      if (rule.operator === 'gt' || rule.operator === 'gte') {
        return baseline.median + (rule.threshold_value * baseline.stdDev)
      } else {
        return baseline.median - (rule.threshold_value * baseline.stdDev)
      }

    case 'percentage_of_median':
      if (!baseline) return null
      if (rule.operator === 'gt' || rule.operator === 'gte') {
        return baseline.median * (1 + rule.threshold_value / 100)
      } else {
        return baseline.median * (1 - rule.threshold_value / 100)
      }

    case 'percentile':
      if (!baseline?.values || baseline.values.length === 0) return null
      return calculatePercentile(baseline.values, rule.threshold_value)

    case 'between':
      // Between is handled separately in evaluateAgainstRule
      return rule.threshold_value

    default:
      return null
  }
}

/**
 * Look up the baseline for a rule, given a case's surgeon and procedure.
 * Tries the most specific key first, then falls back to broader keys.
 */
function lookupBaseline(
  baselines: FlagBaselines,
  rule: FlagRule,
  surgeonId: string | null,
  procedureId: string | null
): BaselineEntry | undefined {
  const scope = rule.comparison_scope === 'personal' ? baselines.personal : baselines.facility

  // Try most specific first
  if (rule.comparison_scope === 'personal' && surgeonId) {
    // personal: metric:surgeon:procedure → metric:surgeon
    if (procedureId) {
      const specific = scope.get(`${rule.metric}:${surgeonId}:${procedureId}`)
      if (specific) return specific
    }
    return scope.get(`${rule.metric}:${surgeonId}`)
  }

  // Facility scope: metric:procedure → metric
  if (procedureId) {
    const specific = scope.get(`${rule.metric}:${procedureId}`)
    if (specific) return specific
  }
  return scope.get(rule.metric)
}


/**
 * Evaluate a metric value against a rule's threshold configuration.
 * Handles all threshold types including 'between'.
 */
function evaluateAgainstRule(
  metricValue: number,
  rule: FlagRule,
  baseline: BaselineEntry | undefined
): { triggered: boolean; threshold: number } {
  // Between: check if value falls within range
  if (rule.threshold_type === 'between') {
    if (rule.threshold_value_max === null) return { triggered: false, threshold: 0 }
    return {
      triggered: metricValue >= rule.threshold_value && metricValue <= rule.threshold_value_max,
      threshold: rule.threshold_value,
    }
  }

  const threshold = resolveThreshold(rule, baseline)
  if (threshold === null) return { triggered: false, threshold: 0 }

  return {
    triggered: compareValue(metricValue, threshold, rule.operator),
    threshold,
  }
}

/**
 * Create a CaseFlag object from a triggered rule evaluation.
 */
function buildFlag(
  caseData: CaseWithFinancials,
  rule: FlagRule,
  metricValue: number,
  threshold: number
): CaseFlag {
  return {
    case_id: caseData.id,
    facility_id: caseData.facility_id,
    flag_type: 'threshold',
    flag_rule_id: rule.id,
    metric_value: Math.round(metricValue * 10) / 10,
    threshold_value: Math.round(threshold * 10) / 10,
    comparison_scope: rule.comparison_scope,
    delay_type_id: null,
    duration_minutes: null,
    severity: rule.severity,
    note: null,
    created_by: null,
  }
}


/**
 * Evaluate a single case against all active flag rules.
 * Returns an array of CaseFlag objects ready for insertion.
 *
 * @param caseData - The case to evaluate (with optional financial data)
 * @param rules - Active flag rules for this facility
 * @param baselines - Pre-computed baselines from historical data
 * @param turnoverBaseline - Pre-computed turnover baseline
 * @param firstCaseIds - Set of case IDs that are first in their room for the day
 * @param turnoverForCase - Turnover/idle gap time before this specific case (if applicable)
 */
export function evaluateCase(
  caseData: CaseWithFinancials,
  rules: FlagRule[],
  baselines: FlagBaselines,
  turnoverBaseline: { median: number; stdDev: number } | null,
  firstCaseIds: Set<string>,
  turnoverForCase?: number | null
): CaseFlag[] {
  const flags: CaseFlag[] = []
  const milestones = getMilestoneMap(caseData)
  const surgeonId = caseData.surgeon_id ?? null
  const procedureId = caseData.procedure_types?.id ?? null

  // Must have at least patient_in and patient_out to evaluate
  if (!milestones.patient_in || !milestones.patient_out) return flags

  for (const rule of rules) {
    if (!rule.is_enabled) continue

    // --- Cross-case metrics (turnover_time, room_idle_gap) ---
    if (rule.metric === 'turnover_time' || rule.metric === 'room_idle_gap') {
      if (turnoverForCase === null || turnoverForCase === undefined) continue
      if (turnoverForCase <= 0) continue

      // Use turnover baseline for both metrics (same underlying computation)
      const bl = turnoverBaseline
        ? { median: turnoverBaseline.median, stdDev: turnoverBaseline.stdDev, count: 0 }
        : undefined
      const result = evaluateAgainstRule(turnoverForCase, rule, bl)
      if (result.triggered) {
        flags.push(buildFlag(caseData, rule, turnoverForCase, result.threshold))
      }
      continue
    }

    // --- FCOTS delay (first-case only) ---
    if (rule.metric === 'fcots_delay') {
      if (!firstCaseIds.has(caseData.id)) continue

      const delayMinutes = extractFCOTSDelay(milestones, caseData)
      if (delayMinutes === null) continue

      const result = evaluateAgainstRule(delayMinutes, rule, undefined)
      if (result.triggered) {
        flags.push(buildFlag(caseData, rule, delayMinutes, result.threshold))
      }
      continue
    }

    // --- Excess time cost (computed from baselines + completion_stats) ---
    if (rule.metric === 'excess_time_cost') {
      const stats = caseData.completion_stats
      if (!stats?.total_duration_minutes || !stats?.or_hourly_rate) continue

      // Look up median total_case_time for this procedure (or facility-wide)
      const tcBaseline = procedureId
        ? (baselines.facility.get(`total_case_time:${procedureId}`) ?? baselines.facility.get('total_case_time'))
        : baselines.facility.get('total_case_time')
      if (!tcBaseline) continue

      const excessMinutes = Math.max(0, stats.total_duration_minutes - tcBaseline.median)
      const metricValue = excessMinutes * stats.or_hourly_rate / 60

      const baseline = lookupBaseline(baselines, rule, surgeonId, procedureId)
      const result = evaluateAgainstRule(metricValue, rule, baseline)
      if (result.triggered) {
        flags.push(buildFlag(caseData, rule, metricValue, result.threshold))
      }
      continue
    }

    // --- Per-cost-category metrics ---
    if (rule.cost_category_id) {
      const metricValue = caseData.category_costs?.[rule.cost_category_id] ?? null
      if (metricValue === null) continue

      const baseline = lookupBaseline(baselines, rule, surgeonId, procedureId)
      const result = evaluateAgainstRule(metricValue, rule, baseline)
      if (result.triggered) {
        flags.push(buildFlag(caseData, rule, metricValue, result.threshold))
      }
      continue
    }

    // --- Standard metrics (milestone-pair, financial, quality) ---
    const metricValue = extractMetricValue(
      milestones, rule.metric, rule.start_milestone, rule.end_milestone, caseData
    )
    if (metricValue === null) continue
    // For timing/efficiency metrics, skip zero/negative (bad milestone data)
    if (!ALLOW_ZERO_OR_NEGATIVE.has(rule.metric) && metricValue <= 0) continue

    // Look up baseline and evaluate
    const baseline = lookupBaseline(baselines, rule, surgeonId, procedureId)
    const result = evaluateAgainstRule(metricValue, rule, baseline)
    if (result.triggered) {
      flags.push(buildFlag(caseData, rule, metricValue, result.threshold))
    }
  }

  return flags
}


// ============================================
// BATCH EVALUATION
// ============================================

/**
 * Evaluate multiple cases against flag rules.
 * Builds baselines from all provided cases, then evaluates each.
 * 
 * This is the main entry point for the flag evaluation pipeline.
 * Call this from your analytics API route after fetching cases.
 * 
 * @param cases - All cases to evaluate (also used as historical baseline)
 * @param rules - Active flag rules for the facility
 * @returns Array of CaseFlag objects ready for bulk insert
 */
export function evaluateCasesBatch(
  cases: CaseWithFinancials[],
  rules: FlagRule[]
): CaseFlag[] {
  if (cases.length === 0 || rules.length === 0) return []

  // Determine which metrics we need baselines for
  const activeMetrics = [...new Set(rules.filter(r => r.is_enabled).map(r => r.metric))]

  // Check if any rules use percentile threshold (need sorted values in baselines)
  const needsPercentileValues = rules.some(r => r.is_enabled && r.threshold_type === 'percentile')

  // Build baselines from all cases
  const baselines = buildBaselines(cases, activeMetrics, needsPercentileValues)

  // Build turnover baseline if any turnover or room_idle_gap rules exist
  const hasTurnoverRule = rules.some(r =>
    (r.metric === 'turnover_time' || r.metric === 'room_idle_gap') && r.is_enabled
  )
  const turnoverBaseline = hasTurnoverRule ? buildTurnoverBaseline(cases) : null

  // Identify first cases for FCOTS rules
  const hasFCOTSRule = rules.some(r => r.metric === 'fcots_delay' && r.is_enabled)
  const firstCaseIds = hasFCOTSRule ? identifyFirstCases(cases) : new Set<string>()

  // Pre-compute turnovers per case (used by both turnover_time and room_idle_gap)
  const turnoverByCase = hasTurnoverRule ? computeTurnoversPerCase(cases) : new Map<string, number>()

  // Evaluate each case
  const allFlags: CaseFlag[] = []

  for (const caseData of cases) {
    const turnover = turnoverByCase.get(caseData.id) ?? null
    const caseFlags = evaluateCase(
      caseData, rules, baselines, turnoverBaseline, firstCaseIds, turnover
    )
    allFlags.push(...caseFlags)
  }

  return allFlags
}


/**
 * Compute the turnover time before each case (except first cases in a room-day).
 * Turnover = patient_out of previous case → patient_in of this case, same room.
 */
function computeTurnoversPerCase(cases: CaseWithMilestones[]): Map<string, number> {
  const result = new Map<string, number>()

  // Group by room and date
  const byRoomDate = new Map<string, CaseWithMilestones[]>()
  cases.forEach(c => {
    if (!c.or_room_id) return
    const key = `${c.scheduled_date}|${c.or_room_id}`
    const existing = byRoomDate.get(key) || []
    existing.push(c)
    byRoomDate.set(key, existing)
  })

  byRoomDate.forEach((roomCases) => {
    const sorted = roomCases.sort((a, b) =>
      (a.start_time || '').localeCompare(b.start_time || '')
    )

    for (let i = 1; i < sorted.length; i++) {
      const prev = getMilestoneMap(sorted[i - 1])
      const curr = getMilestoneMap(sorted[i])

      if (prev.patient_out && curr.patient_in) {
        const turnover = getTimeDiffMinutes(prev.patient_out, curr.patient_in)
        if (turnover !== null && turnover > 0 && turnover < 180) {
          result.set(sorted[i].id, turnover)
        }
      }
    }
  })

  return result
}