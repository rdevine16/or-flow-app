// ============================================
// lib/flag-detection.ts
// ============================================
// Pure-function flag detection engine for surgeon day analysis.
// Detects anomalies (late starts, long turnovers, extended phases, fast cases)
// by comparing case data against thresholds and historical medians.
// ============================================

import type {
  CaseWithMilestones,
  PhaseDefInput,
} from './analyticsV2'
import {
  getMilestoneMap,
  getTotalORTime,
  buildMilestoneTimestampMap,
  computePhaseDurations,
  calculateMedian,
  parseScheduledDateTime,
} from './analyticsV2'

// ============================================
// TYPES
// ============================================

export interface CaseFlag {
  /** e.g. 'late_start', 'long_turnover', 'extended_phase', 'extended_subphase', 'fast_case' */
  type: string
  severity: 'warning' | 'caution' | 'info' | 'positive'
  /** Human-readable: "Late Start", "Extended Surgical" */
  label: string
  /** Context: "+12m vs scheduled", "47m vs 38m med" */
  detail: string
  /** Emoji for compact display */
  icon: string
}

export interface FlagThresholds {
  /** Minutes past scheduled start to flag as late (default 10) */
  lateStartMinutes: number
  /** Minutes of turnover to flag as long (default 30) */
  longTurnoverMinutes: number
  /** Fraction over median to flag a parent phase as extended (default 0.4 = 40%) */
  phaseExtendedPct: number
  /** Fraction over median to flag a sub-phase as extended (default 0.3 = 30%) */
  subphaseExtendedPct: number
  /** Fraction under median to flag as fast case (default 0.15 = 15%) */
  fastCasePct: number
}

/** Medians keyed by `procedureId:phaseId` for phase/sub-phase, or `procedureId:total` for total OR time */
export type ProcedureMedians = Map<string, number>

// ============================================
// CONSTANTS
// ============================================

export const DEFAULT_FLAG_THRESHOLDS: FlagThresholds = {
  lateStartMinutes: 10,
  longTurnoverMinutes: 30,
  phaseExtendedPct: 0.4,
  subphaseExtendedPct: 0.3,
  fastCasePct: 0.15,
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Detect flags for a single case.
 *
 * Pure function — takes all data it needs as arguments.
 *
 * @param caseData - The case to check
 * @param caseIndex - Index of the case in the day's chronological list (0 = first case)
 * @param allDayCases - All cases for the day (needed for turnover calculation)
 * @param procedureMedians - Historical medians from computeProcedureMedians()
 * @param phaseDefinitions - Phase definitions for computing durations
 * @param thresholds - Detection thresholds (defaults to DEFAULT_FLAG_THRESHOLDS)
 */
export function detectCaseFlags(
  caseData: CaseWithMilestones,
  caseIndex: number,
  allDayCases: CaseWithMilestones[],
  procedureMedians: ProcedureMedians,
  phaseDefinitions: PhaseDefInput[],
  thresholds: FlagThresholds = DEFAULT_FLAG_THRESHOLDS,
): CaseFlag[] {
  const flags: CaseFlag[] = []
  const milestones = getMilestoneMap(caseData)
  const procedureId = getProcedureId(caseData)

  // --- Late Start (first case only) ---
  if (caseIndex === 0 && milestones.patient_in && caseData.start_time && caseData.scheduled_date) {
    const scheduled = parseScheduledDateTime(caseData.scheduled_date, caseData.start_time)
    if (scheduled) {
      const delayMinutes = (milestones.patient_in.getTime() - scheduled.getTime()) / 60000
      if (delayMinutes > thresholds.lateStartMinutes) {
        flags.push({
          type: 'late_start',
          severity: 'warning',
          label: 'Late Start',
          detail: `+${Math.round(delayMinutes)}m vs scheduled`,
          icon: '🕐',
        })
      } else if (delayMinutes > 1) {
        flags.push({
          type: 'late_start',
          severity: 'info',
          label: 'Late Start',
          detail: `+${Math.round(delayMinutes)}m vs scheduled`,
          icon: '🕐',
        })
      }
    }
  }

  // --- Long Turnover (find previous case in same room) ---
  if (caseData.or_room_id && milestones.patient_in) {
    const prevCase = findPreviousCaseInRoom(caseData, allDayCases)
    if (prevCase) {
      const prevMilestones = getMilestoneMap(prevCase)
      if (prevMilestones.patient_out) {
        const turnoverMinutes =
          (milestones.patient_in.getTime() - prevMilestones.patient_out.getTime()) / 60000
        if (turnoverMinutes > thresholds.longTurnoverMinutes) {
          flags.push({
            type: 'long_turnover',
            severity: 'warning',
            label: 'Long Turnover',
            detail: `${Math.round(turnoverMinutes)}m between cases`,
            icon: '⏳',
          })
        }
      }
    }
  }

  // --- Extended Phase / Extended Sub-phase ---
  if (procedureId) {
    const timestampMap = buildMilestoneTimestampMap(caseData.case_milestones || [])
    const durations = computePhaseDurations(phaseDefinitions, timestampMap)

    for (const phase of durations) {
      if (phase.durationSeconds === null) continue

      const medianKey = `${procedureId}:${phase.phaseId}`
      const median = procedureMedians.get(medianKey)
      if (median === undefined || median === 0) continue

      const isSubphase = phase.parentPhaseId !== null
      const pctThreshold = isSubphase ? thresholds.subphaseExtendedPct : thresholds.phaseExtendedPct
      const flagType = isSubphase ? 'extended_subphase' : 'extended_phase'

      const ratio = (phase.durationSeconds - median) / median
      if (ratio > pctThreshold) {
        const actualMin = Math.round(phase.durationSeconds / 60)
        const medianMin = Math.round(median / 60)
        flags.push({
          type: flagType,
          severity: 'caution',
          label: `Extended ${phase.displayName}`,
          detail: `${actualMin}m vs ${medianMin}m med (+${Math.round(ratio * 100)}%)`,
          icon: '⚠️',
        })
      }
    }
  }

  // --- Fast Case ---
  if (procedureId) {
    const totalOR = getTotalORTime(milestones)
    const totalMedianKey = `${procedureId}:total`
    const totalMedian = procedureMedians.get(totalMedianKey)

    if (totalOR !== null && totalMedian !== undefined && totalMedian > 0) {
      const ratio = (totalMedian - totalOR) / totalMedian
      if (ratio > thresholds.fastCasePct) {
        const actualMin = Math.round(totalOR / 60)
        const medianMin = Math.round(totalMedian / 60)
        flags.push({
          type: 'fast_case',
          severity: 'positive',
          label: 'Fast Case',
          detail: `${actualMin}m vs ${medianMin}m med (-${Math.round(ratio * 100)}%)`,
          icon: '⚡',
        })
      }
    }
  }

  return flags
}

/**
 * Compute historical medians per procedure per phase/sub-phase and total OR time.
 *
 * Returns a Map keyed by `procedureId:phaseId` (for phases) and `procedureId:total` (for total OR time).
 * Values are median durations in seconds.
 */
export function computeProcedureMedians(
  cases: CaseWithMilestones[],
  phaseDefinitions: PhaseDefInput[],
): ProcedureMedians {
  const medians: ProcedureMedians = new Map()

  // Collect durations keyed by procedureId:phaseId
  const durationBuckets = new Map<string, number[]>()

  for (const c of cases) {
    const procedureId = getProcedureId(c)
    if (!procedureId) continue

    // Total OR time
    const milestones = getMilestoneMap(c)
    const totalOR = getTotalORTime(milestones)
    if (totalOR !== null && totalOR > 0) {
      const totalKey = `${procedureId}:total`
      const existing = durationBuckets.get(totalKey) || []
      existing.push(totalOR)
      durationBuckets.set(totalKey, existing)
    }

    // Phase durations
    const timestampMap = buildMilestoneTimestampMap(c.case_milestones || [])
    const durations = computePhaseDurations(phaseDefinitions, timestampMap)

    for (const phase of durations) {
      if (phase.durationSeconds === null || phase.durationSeconds <= 0) continue
      const key = `${procedureId}:${phase.phaseId}`
      const existing = durationBuckets.get(key) || []
      existing.push(phase.durationSeconds)
      durationBuckets.set(key, existing)
    }
  }

  // Compute median for each bucket
  for (const [key, values] of durationBuckets) {
    const median = calculateMedian(values)
    if (median !== null) {
      medians.set(key, median)
    }
  }

  return medians
}

/**
 * Flatten all case flags into a flat list with case numbers, for the sidebar flag list.
 */
export function aggregateDayFlags(
  cases: CaseWithMilestones[],
  caseFlagsMap: Record<string, CaseFlag[]>,
): { caseNumber: string; flag: CaseFlag }[] {
  const result: { caseNumber: string; flag: CaseFlag }[] = []

  for (const c of cases) {
    const flags = caseFlagsMap[c.id]
    if (!flags) continue
    for (const flag of flags) {
      result.push({ caseNumber: c.case_number, flag })
    }
  }

  return result
}

// ============================================
// INTERNAL HELPERS
// ============================================

/** Extract procedure ID from a case, handling both array and object shapes. */
function getProcedureId(caseData: CaseWithMilestones): string | null {
  const proc = Array.isArray(caseData.procedure_types)
    ? caseData.procedure_types[0]
    : caseData.procedure_types
  return proc?.id ?? null
}

/**
 * Find the previous case in the same room, ordered by patient_in time.
 * Returns null if this is the first case in the room.
 */
function findPreviousCaseInRoom(
  caseData: CaseWithMilestones,
  allDayCases: CaseWithMilestones[],
): CaseWithMilestones | null {
  if (!caseData.or_room_id) return null

  const casePatientIn = getMilestoneMap(caseData).patient_in
  if (!casePatientIn) return null

  // Get all cases in the same room, sorted by patient_in
  const sameRoomCases = allDayCases
    .filter(c => c.or_room_id === caseData.or_room_id && c.id !== caseData.id)
    .map(c => ({ c, patientIn: getMilestoneMap(c).patient_in }))
    .filter((x): x is { c: CaseWithMilestones; patientIn: Date } => x.patientIn !== undefined)
    .filter(x => x.patientIn.getTime() < casePatientIn.getTime())
    .sort((a, b) => b.patientIn.getTime() - a.patientIn.getTime())

  return sameRoomCases.length > 0 ? sameRoomCases[0].c : null
}
