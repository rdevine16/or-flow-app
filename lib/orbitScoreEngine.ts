// lib/orbitScoreEngine.ts
// ORbit Score Calculation Engine v2.1
// ─────────────────────────────────────────────────────────────
// 4-pillar scoring system measuring only surgeon-controllable behaviors.
//
// Pillars:
//   1. Profitability  (30%) — Margin per OR minute, cohort-relative scoring
//   2. Consistency     (25%) — CV of case duration, cohort-relative scoring
//   3. Sched Adherence (25%) — Graduated linear decay per case
//   4. Availability    (20%) — Graduated linear decay per case
//
// Continuous pillars (1 & 2) use median-anchored MAD scoring:
//   score = 50 + (value - cohort_median) / MAD * 25
//   Clamped 0-100. Works for any cohort size ≥ 2.
//   Solo surgeon: compared against facility-wide benchmark.
//
// Graduated pillars (3 & 4) use linear decay:
//   case_score = max(0, 1.0 - minutes_over_grace / floor)

// ─── TYPES ────────────────────────────────────────────────────

export interface PillarScores {
  profitability: number
  consistency: number
  schedAdherence: number
  availability: number
}

export interface PillarDiagnostics {
  profitability: {
    procedureCohorts: {
      procedureId: string
      procedureName: string
      surgeonMedianMPM: number
      cohortMedian: number
      cohortMAD: number
      effectiveMAD: number
      cohortSize: number
      validCases: number
      totalCases: number
      rawScore: number
      skippedReason?: string
    }[]
    finalScore: number
    method: string
  }
  consistency: {
    procedureCohorts: {
      procedureId: string
      procedureName: string
      surgeonCV: number
      cohortMedian: number
      cohortMAD: number
      effectiveMAD: number
      cohortSize: number
      validCases: number
      rawScore: number
      skippedReason?: string
    }[]
    finalScore: number
    method: string
  }
  schedAdherence: {
    totalCasesScored: number
    avgCaseScore: number
    casesWithin_grace: number
    casesAtZero: number
    finalScore: number
  }
  availability: {
    gapCasesScored: number
    avgGapScore: number
    delayRate: number
    gapPillarScore: number
    delayPillarScore: number
    finalScore: number
  }
}

export interface ORbitScorecard {
  surgeonId: string
  surgeonName: string
  firstName: string
  lastName: string
  caseCount: number
  procedures: string[]
  procedureBreakdown: { name: string; count: number }[]
  flipRoom: boolean
  pillars: PillarScores
  composite: number
  grade: GradeInfo
  trend: 'up' | 'down' | 'stable'
  previousComposite: number | null
  diagnostics?: PillarDiagnostics
}

export interface GradeInfo {
  letter: string
  label: string
  text: string
  bg: string
}

export interface PillarDefinition {
  key: keyof PillarScores
  label: string
  weight: number
  color: string
  description: string
}

export const PILLARS: PillarDefinition[] = [
  { key: 'profitability',  label: 'Profitability',      weight: 0.30, color: '#2563EB', description: 'Margin per OR minute' },
  { key: 'consistency',    label: 'Consistency',         weight: 0.25, color: '#059669', description: 'Case duration predictability' },
  { key: 'schedAdherence', label: 'Schedule Adherence',  weight: 0.25, color: '#DB2777', description: 'Cases starting on time' },
  { key: 'availability',   label: 'Availability',        weight: 0.20, color: '#7C3AED', description: 'Surgeon readiness' },
]

export const MIN_CASE_THRESHOLD = 15

// ─── INPUT TYPES ─────────────────────────────────────────────

export interface ScorecardCase {
  id: string
  surgeon_id: string
  surgeon_first_name: string
  surgeon_last_name: string
  procedure_type_id: string
  procedure_name: string
  or_room_id: string
  scheduled_date: string
  start_time: string | null
  patient_in_at: string | null
  incision_at: string | null
  prep_drape_complete_at: string | null
  closing_at: string | null
  patient_out_at: string | null
}

export interface ScorecardFinancials {
  case_id: string
  profit: number | null
  reimbursement: number | null
  or_time_cost: number | null
}

export interface ScorecardFlag {
  case_id: string
  flag_type: string
  severity: string
  delay_type_name: string | null
  created_by: string | null
}

export interface ScorecardSettings {
  start_time_milestone: 'patient_in' | 'incision'
  start_time_grace_minutes: number
  start_time_floor_minutes: number
  waiting_on_surgeon_minutes: number
  waiting_on_surgeon_floor_minutes: number
  min_procedure_cases: number
}

export interface ScorecardInput {
  cases: ScorecardCase[]
  financials: ScorecardFinancials[]
  flags: ScorecardFlag[]
  settings: ScorecardSettings
  dateRange: { start: string; end: string }
  timezone: string
  previousPeriodCases?: ScorecardCase[]
  previousPeriodFinancials?: ScorecardFinancials[]
  previousPeriodFlags?: ScorecardFlag[]
  enableDiagnostics?: boolean
}

// ─── UTILITY FUNCTIONS ───────────────────────────────────────

function minutesBetween(a: string, b: string): number | null {
  if (!a || !b) return null
  const ta = new Date(a).getTime()
  const tb = new Date(b).getTime()
  if (isNaN(ta) || isNaN(tb)) return null
  const mins = (tb - ta) / 60000
  return mins > 0 ? mins : null
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function utcToLocalMinutes(utcIso: string, timezone: string): number {
  const d = new Date(utcIso)
  if (isNaN(d.getTime())) return 0
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(d)
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10)
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10)
  return hour * 60 + minute
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  const variance = arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1)
  return Math.sqrt(variance)
}

function coefficientOfVariation(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  if (m === 0) return 0
  return stddev(arr) / m
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Median Absolute Deviation — robust spread measure */
function mad(arr: number[]): number {
  if (arr.length < 2) return 0
  const med = median(arr)
  const deviations = arr.map(v => Math.abs(v - med))
  return median(deviations)
}

/**
 * Minimum MAD as percentage of cohort median.
 * Prevents hyper-sensitivity when cohort values cluster tightly.
 * 5% means: if median is $20/min, effective MAD is at least $1.00.
 */
const MIN_MAD_PERCENT = 0.05

/** Minimum pillar score — prevents mathematically unrecoverable composites */
const MIN_PILLAR_SCORE = 10

/**
 * Scoring band: how many MADs from median = full range (0 or 100).
 * 3 MAD = forgiving, appropriate for small ASC cohorts (5-15 surgeons).
 *
 *   1 MAD from median → ~33 or ~67
 *   2 MAD from median → ~17 or ~83
 *   3 MAD from median →  10 or 100  (floored at MIN_PILLAR_SCORE)
 */
const MAD_BAND = 3
const MAD_MULTIPLIER = 50 / MAD_BAND // ≈ 16.67 per MAD

/**
 * Median-anchored MAD scoring with minimum MAD floor.
 *
 * Maps a value to 0-100 based on its position relative to the cohort:
 *   - At median = 50
 *   - 1 effective MAD above/below = 50 ± 16.67
 *   - 3 effective MAD = 10 or 100 (floored at MIN_PILLAR_SCORE)
 *
 * Effective MAD = max(actualMAD, |cohortMedian| * MIN_MAD_PERCENT)
 * This prevents tiny MAD from amplifying noise in tightly-clustered cohorts.
 *
 * All scores floored at MIN_PILLAR_SCORE (10) to keep composites recoverable.
 *
 * Fallbacks:
 *   - 0 peers → 50 (no data)
 *   - 1 peer → ratio-based scaling from 50
 *   - MAD=0 and range=0 → 50 (identical values)
 *   - MAD=0 but range>0 → range interpolation
 */
function madScore(
  value: number,
  cohortValues: number[],
  higherIsBetter: boolean = true,
): number {
  if (cohortValues.length === 0) return 50
  if (cohortValues.length === 1) {
    // Solo: compare against the single value
    const peer = cohortValues[0]
    if (peer === 0) return 50
    const ratio = value / peer
    let score: number
    if (higherIsBetter) {
      score = 50 + (ratio - 1) * 100
    } else {
      score = 50 - (ratio - 1) * 100
    }
    return clamp(Math.round(score), MIN_PILLAR_SCORE, 100)
  }

  const cohortMed = median(cohortValues)
  const actualMAD = mad(cohortValues)

  // Apply minimum MAD floor: at least 5% of the absolute cohort median
  const madFloor = Math.abs(cohortMed) * MIN_MAD_PERCENT
  const effectiveMAD = Math.max(actualMAD, madFloor)

  if (effectiveMAD === 0) {
    // Cohort median is 0 and MAD is 0 — try range interpolation
    const min = Math.min(...cohortValues)
    const max = Math.max(...cohortValues)
    if (max === min) return 50
    const position = (value - min) / (max - min)
    const score = higherIsBetter ? position * 100 : (1 - position) * 100
    return clamp(Math.round(score), MIN_PILLAR_SCORE, 100)
  }

  // MAD scoring: 50 ± distance/effectiveMAD * MAD_MULTIPLIER
  const distance = value - cohortMed
  const normalizedDistance = distance / effectiveMAD

  let score: number
  if (higherIsBetter) {
    score = 50 + normalizedDistance * MAD_MULTIPLIER
  } else {
    score = 50 - normalizedDistance * MAD_MULTIPLIER
  }

  return clamp(Math.round(score), MIN_PILLAR_SCORE, 100)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Linear decay: 1.0 within grace, then lose (1/floor) per minute over grace, min 0 */
function graduatedCaseScore(minutesOver: number, floorMinutes: number): number {
  if (minutesOver <= 0) return 1.0
  if (minutesOver >= floorMinutes) return 0.0
  return 1.0 - (minutesOver / floorMinutes)
}

function groupByProcedure(cases: ScorecardCase[]): Record<string, ScorecardCase[]> {
  const grouped: Record<string, ScorecardCase[]> = {}
  for (const c of cases) {
    if (!grouped[c.procedure_type_id]) grouped[c.procedure_type_id] = []
    grouped[c.procedure_type_id].push(c)
  }
  return grouped
}

function detectFlipRoom(cases: ScorecardCase[]): boolean {
  const byDate: Record<string, Set<string>> = {}
  for (const c of cases) {
    if (!byDate[c.scheduled_date]) byDate[c.scheduled_date] = new Set()
    byDate[c.scheduled_date].add(c.or_room_id)
  }
  return Object.values(byDate).some(rooms => rooms.size > 1)
}

function getCaseDuration(c: ScorecardCase): number | null {
  return minutesBetween(c.patient_in_at!, c.patient_out_at!)
}

function getPrepToIncision(c: ScorecardCase): number | null {
  return minutesBetween(c.prep_drape_complete_at!, c.incision_at!)
}

// ─── COMPOSITE & GRADE ───────────────────────────────────────

export function computeComposite(pillars: PillarScores): number {
  return Math.round(
    PILLARS.reduce((sum, p) => sum + (pillars[p.key] || 0) * p.weight, 0)
  )
}

export function getGrade(score: number): GradeInfo {
  if (score >= 90) return { letter: 'A', label: 'Elite', text: '#059669', bg: '#ECFDF5' }
  if (score >= 80) return { letter: 'B', label: 'Strong', text: '#2563EB', bg: '#EFF6FF' }
  if (score >= 70) return { letter: 'C', label: 'Developing', text: '#D97706', bg: '#FFFBEB' }
  return { letter: 'D', label: 'Needs Improvement', text: '#DC2626', bg: '#FEF2F2' }
}


// ═════════════════════════════════════════════════════════════
// PILLAR 1: PROFITABILITY (30%)
// ═════════════════════════════════════════════════════════════
// Median margin per OR minute.
// Scored via MAD-anchored cohort comparison within procedure type.
// Volume-weighted across procedure types.
//
// FIX from v2: profit of 0 is now allowed (break-even is data, not missing).
// Only null/undefined profit is skipped.

interface ProfitabilityDiag {
  procedureCohorts: {
    procedureId: string
    procedureName: string
    surgeonMedianMPM: number
    cohortMedian: number
    cohortMAD: number
    effectiveMAD: number
    cohortSize: number
    validCases: number
    totalCases: number
    rawScore: number
    skippedReason?: string
  }[]
  finalScore: number
  method: string
}

function calculateProfitability(
  surgeonCases: ScorecardCase[],
  allCases: ScorecardCase[],
  financialsMap: Map<string, ScorecardFinancials>,
  minProcCases: number,
  diag?: ProfitabilityDiag,
): number {
  const surgeonByProc = groupByProcedure(surgeonCases)
  const scores: { score: number; volume: number }[] = []

  // Build all peer MPMs upfront for facility-wide fallback
  const allMPMs: number[] = []

  for (const [procId, cases] of Object.entries(surgeonByProc)) {
    const procName = cases[0]?.procedure_name || procId

    // Calculate surgeon's MPMs for this procedure
    const surgeonMPMs: number[] = []
    let totalWithFinancials = 0
    let totalWithDuration = 0

    for (const c of cases) {
      const fin = financialsMap.get(c.id)
      const duration = getCaseDuration(c)

      // FIX: Allow profit === 0. Only skip null/undefined.
      if (fin?.profit == null) continue
      totalWithFinancials++

      if (!duration || duration <= 0) continue
      totalWithDuration++

      surgeonMPMs.push(fin.profit / duration)
    }

    if (surgeonMPMs.length < minProcCases) {
      if (diag) {
        diag.procedureCohorts.push({
          procedureId: procId,
          procedureName: procName,
          surgeonMedianMPM: 0,
          cohortMedian: 0,
          cohortMAD: 0,
          effectiveMAD: 0,
          cohortSize: 0,
          validCases: surgeonMPMs.length,
          totalCases: cases.length,
          rawScore: 0,
          skippedReason: `Only ${surgeonMPMs.length} valid cases (need ${minProcCases}). ${cases.length} total, ${totalWithFinancials} with financials, ${totalWithDuration} with duration.`,
        })
      }
      continue
    }

    const surgeonMedianMPM = median(surgeonMPMs)
    allMPMs.push(surgeonMedianMPM)

    // Get peer median MPMs for this procedure type
    const peerMPMs = getPeerMedianMPMs(allCases, financialsMap, procId, minProcCases)

    // Score via MAD (higher MPM = better)
    const score = madScore(surgeonMedianMPM, peerMPMs, true)
    scores.push({ score, volume: surgeonMPMs.length })

    if (diag) {
      const peerMed = median(peerMPMs)
      const peerActualMAD = mad(peerMPMs)
      const peerEffMAD = Math.max(peerActualMAD, Math.abs(peerMed) * MIN_MAD_PERCENT)
      diag.procedureCohorts.push({
        procedureId: procId,
        procedureName: procName,
        surgeonMedianMPM: Math.round(surgeonMedianMPM * 100) / 100,
        cohortMedian: Math.round(median(peerMPMs) * 100) / 100,
        cohortMAD: Math.round(peerActualMAD * 100) / 100,
        effectiveMAD: Math.round(peerEffMAD * 100) / 100,
        cohortSize: peerMPMs.length,
        validCases: surgeonMPMs.length,
        totalCases: cases.length,
        rawScore: score,
      })
    }
  }

  if (scores.length === 0) {
    if (diag) {
      diag.finalScore = 50
      diag.method = 'default (no valid procedure cohorts)'
    }
    return 50
  }

  // Volume-weighted blend
  const totalVolume = scores.reduce((s, x) => s + x.volume, 0)
  const final = Math.round(scores.reduce((s, x) => s + x.score * (x.volume / totalVolume), 0))

  if (diag) {
    diag.finalScore = final
    diag.method = scores.length === 1 ? 'single cohort' : `volume-weighted across ${scores.length} cohorts`
  }

  return final
}

function getPeerMedianMPMs(
  allCases: ScorecardCase[],
  financialsMap: Map<string, ScorecardFinancials>,
  procedureTypeId: string,
  minCases: number,
): number[] {
  const bySurgeon: Record<string, number[]> = {}

  for (const c of allCases) {
    if (c.procedure_type_id !== procedureTypeId) continue
    const fin = financialsMap.get(c.id)
    const duration = getCaseDuration(c)
    // FIX: Allow profit === 0
    if (fin?.profit == null || !duration || duration <= 0) continue
    if (!bySurgeon[c.surgeon_id]) bySurgeon[c.surgeon_id] = []
    bySurgeon[c.surgeon_id].push(fin.profit / duration)
  }

  return Object.values(bySurgeon)
    .filter(mpms => mpms.length >= minCases)
    .map(mpms => median(mpms))
}


// ═════════════════════════════════════════════════════════════
// PILLAR 2: CONSISTENCY (25%)
// ═════════════════════════════════════════════════════════════
// CV of case duration within procedure type.
// Scored via MAD-anchored cohort comparison (lower CV = better).
// Volume-weighted across procedure types.

interface ConsistencyDiag {
  procedureCohorts: {
    procedureId: string
    procedureName: string
    surgeonCV: number
    cohortMedian: number
    cohortMAD: number
    effectiveMAD: number
    cohortSize: number
    validCases: number
    rawScore: number
    skippedReason?: string
  }[]
  finalScore: number
  method: string
}

function calculateConsistency(
  surgeonCases: ScorecardCase[],
  allCases: ScorecardCase[],
  minProcCases: number,
  diag?: ConsistencyDiag,
): number {
  const surgeonByProc = groupByProcedure(surgeonCases)
  const scores: { score: number; volume: number }[] = []

  for (const [procId, cases] of Object.entries(surgeonByProc)) {
    const procName = cases[0]?.procedure_name || procId
    const durations = cases
      .map(c => getCaseDuration(c))
      .filter((d): d is number => d !== null && d > 0)

    if (durations.length < minProcCases) {
      if (diag) {
        diag.procedureCohorts.push({
          procedureId: procId,
          procedureName: procName,
          surgeonCV: 0,
          cohortMedian: 0,
          cohortMAD: 0,
          effectiveMAD: 0,
          cohortSize: 0,
          validCases: durations.length,
          rawScore: 0,
          skippedReason: `Only ${durations.length} valid durations (need ${minProcCases})`,
        })
      }
      continue
    }

    const surgeonCV = coefficientOfVariation(durations)
    const peerCVs = getPeerCVs(allCases, procId, minProcCases)

    // Score via MAD (lower CV = better)
    const score = madScore(surgeonCV, peerCVs, false)
    scores.push({ score, volume: durations.length })

    if (diag) {
      const peerMed = median(peerCVs)
      const peerActualMAD = mad(peerCVs)
      const peerEffMAD = Math.max(peerActualMAD, Math.abs(peerMed) * MIN_MAD_PERCENT)
      diag.procedureCohorts.push({
        procedureId: procId,
        procedureName: procName,
        surgeonCV: Math.round(surgeonCV * 1000) / 1000,
        cohortMedian: Math.round(peerMed * 1000) / 1000,
        cohortMAD: Math.round(peerActualMAD * 1000) / 1000,
        effectiveMAD: Math.round(peerEffMAD * 1000) / 1000,
        cohortSize: peerCVs.length,
        validCases: durations.length,
        rawScore: score,
      })
    }
  }

  if (scores.length === 0) {
    if (diag) {
      diag.finalScore = 50
      diag.method = 'default (no valid procedure cohorts)'
    }
    return 50
  }

  const totalVolume = scores.reduce((s, x) => s + x.volume, 0)
  const final = Math.round(scores.reduce((s, x) => s + x.score * (x.volume / totalVolume), 0))

  if (diag) {
    diag.finalScore = final
    diag.method = scores.length === 1 ? 'single cohort' : `volume-weighted across ${scores.length} cohorts`
  }

  return final
}

function getPeerCVs(
  allCases: ScorecardCase[],
  procedureTypeId: string,
  minCases: number,
): number[] {
  const bySurgeon: Record<string, ScorecardCase[]> = {}
  for (const c of allCases) {
    if (c.procedure_type_id !== procedureTypeId) continue
    if (!bySurgeon[c.surgeon_id]) bySurgeon[c.surgeon_id] = []
    bySurgeon[c.surgeon_id].push(c)
  }

  const cvs: number[] = []
  for (const cases of Object.values(bySurgeon)) {
    const durations = cases
      .map(c => getCaseDuration(c))
      .filter((d): d is number => d !== null && d > 0)
    if (durations.length >= minCases) {
      cvs.push(coefficientOfVariation(durations))
    }
  }
  return cvs
}


// ═════════════════════════════════════════════════════════════
// PILLAR 3: SCHEDULE ADHERENCE (25%)
// ═════════════════════════════════════════════════════════════
// Graduated scoring for ALL cases (first and subsequent).
// Each case scored 0.0-1.0 via linear decay.
// Final pillar score: MAD-scored against peer raw scores.

interface AdherenceDiag {
  totalCasesScored: number
  avgCaseScore: number
  casesWithin_grace: number
  casesAtZero: number
  finalScore: number
}

function calculateScheduleAdherence(
  surgeonCases: ScorecardCase[],
  allCases: ScorecardCase[],
  settings: ScorecardSettings,
  timezone: string,
  diag?: AdherenceDiag,
): number {
  const surgeonId = surgeonCases[0]?.surgeon_id
  if (!surgeonId) return 50

  const caseScores = scoreCasesForAdherence(surgeonCases, settings, timezone)

  if (caseScores.length === 0) {
    if (diag) {
      diag.totalCasesScored = 0
      diag.avgCaseScore = 0
      diag.casesWithin_grace = 0
      diag.casesAtZero = 0
      diag.finalScore = 50
    }
    return 50
  }

  const surgeonRaw = mean(caseScores) * 100
  const peerRawScores = getPeerAdherenceScores(allCases, settings, timezone)

  // MAD-score against peers (higher raw = better)
  const final = madScore(surgeonRaw, peerRawScores, true)

  if (diag) {
    diag.totalCasesScored = caseScores.length
    diag.avgCaseScore = Math.round(mean(caseScores) * 1000) / 1000
    diag.casesWithin_grace = caseScores.filter(s => s === 1.0).length
    diag.casesAtZero = caseScores.filter(s => s === 0.0).length
    diag.finalScore = final
  }

  return final
}

function scoreCasesForAdherence(
  cases: ScorecardCase[],
  settings: ScorecardSettings,
  timezone: string,
): number[] {
  const scores: number[] = []

  for (const c of cases) {
    const actualStart = settings.start_time_milestone === 'incision'
      ? c.incision_at
      : c.patient_in_at

    if (!actualStart || !c.start_time) continue

    const scheduledMin = timeToMinutes(c.start_time)
    const actualMin = utcToLocalMinutes(actualStart, timezone)
    const deltaMin = actualMin - scheduledMin

    const minutesOver = Math.max(0, deltaMin - settings.start_time_grace_minutes)
    scores.push(graduatedCaseScore(minutesOver, settings.start_time_floor_minutes))
  }

  return scores
}

function getPeerAdherenceScores(
  allCases: ScorecardCase[],
  settings: ScorecardSettings,
  timezone: string,
): number[] {
  const bySurgeon: Record<string, ScorecardCase[]> = {}
  for (const c of allCases) {
    if (!bySurgeon[c.surgeon_id]) bySurgeon[c.surgeon_id] = []
    bySurgeon[c.surgeon_id].push(c)
  }

  return Object.values(bySurgeon)
    .map(surgeonCases => {
      const scores = scoreCasesForAdherence(surgeonCases, settings, timezone)
      if (scores.length === 0) return null
      return mean(scores) * 100
    })
    .filter((v): v is number => v !== null)
}


// ═════════════════════════════════════════════════════════════
// PILLAR 4: AVAILABILITY (20%)
// ═════════════════════════════════════════════════════════════
// Two sub-metrics blended 50/50:
// A. Prep-to-Incision Gap (graduated, MAD-scored against peers)
// B. Surgeon Delay Rate (MAD-scored against peers, lower = better)

interface AvailabilityDiag {
  gapCasesScored: number
  avgGapScore: number
  delayRate: number
  gapPillarScore: number
  delayPillarScore: number
  finalScore: number
}

function calculateAvailability(
  surgeonCases: ScorecardCase[],
  allCases: ScorecardCase[],
  flags: ScorecardFlag[],
  settings: ScorecardSettings,
  diag?: AvailabilityDiag,
): number {
  const surgeonId = surgeonCases[0]?.surgeon_id
  if (!surgeonId) return 50

  // ── Sub-Metric A: Prep-to-Incision Gap (graduated) ──
  const gapScores = scoreCasesForAvailability(surgeonCases, settings)

  let gapPillarScore = 50
  if (gapScores.length >= 3) {
    const surgeonRaw = mean(gapScores) * 100
    const peerRawScores = getPeerAvailabilityScores(allCases, settings)
    gapPillarScore = madScore(surgeonRaw, peerRawScores, true) // higher raw = better
  }

  // ── Sub-Metric B: Delay Rate ──
  const surgeonCaseIds = new Set(surgeonCases.map(c => c.id))
  const surgeonDelayCount = flags.filter(f =>
    surgeonCaseIds.has(f.case_id) && f.flag_type === 'delay'
  ).length
  const delayRate = surgeonCases.length > 0
    ? (surgeonDelayCount / surgeonCases.length) * 100
    : 0

  const peerDelayRates = getPeerDelayRates(allCases, flags)
  const delayScore = madScore(delayRate, peerDelayRates, false) // lower rate = better

  const final = Math.round(gapPillarScore * 0.5 + delayScore * 0.5)

  if (diag) {
    diag.gapCasesScored = gapScores.length
    diag.avgGapScore = gapScores.length > 0 ? Math.round(mean(gapScores) * 1000) / 1000 : 0
    diag.delayRate = Math.round(delayRate * 10) / 10
    diag.gapPillarScore = gapPillarScore
    diag.delayPillarScore = delayScore
    diag.finalScore = final
  }

  return final
}

function scoreCasesForAvailability(
  cases: ScorecardCase[],
  settings: ScorecardSettings,
): number[] {
  const scores: number[] = []

  for (const c of cases) {
    const gap = getPrepToIncision(c)
    if (gap === null) continue

    const minutesOver = Math.max(0, gap - settings.waiting_on_surgeon_minutes)
    scores.push(graduatedCaseScore(minutesOver, settings.waiting_on_surgeon_floor_minutes))
  }

  return scores
}

function getPeerAvailabilityScores(
  allCases: ScorecardCase[],
  settings: ScorecardSettings,
): number[] {
  const bySurgeon: Record<string, ScorecardCase[]> = {}
  for (const c of allCases) {
    if (!bySurgeon[c.surgeon_id]) bySurgeon[c.surgeon_id] = []
    bySurgeon[c.surgeon_id].push(c)
  }

  return Object.values(bySurgeon)
    .map(surgeonCases => {
      const scores = scoreCasesForAvailability(surgeonCases, settings)
      if (scores.length < 3) return null
      return mean(scores) * 100
    })
    .filter((v): v is number => v !== null)
}

function getPeerDelayRates(allCases: ScorecardCase[], flags: ScorecardFlag[]): number[] {
  const bySurgeon: Record<string, { total: number; delayed: number }> = {}
  const delaysByCaseId = new Set(
    flags.filter(f => f.flag_type === 'delay').map(f => f.case_id)
  )

  for (const c of allCases) {
    if (!bySurgeon[c.surgeon_id]) bySurgeon[c.surgeon_id] = { total: 0, delayed: 0 }
    bySurgeon[c.surgeon_id].total++
    if (delaysByCaseId.has(c.id)) bySurgeon[c.surgeon_id].delayed++
  }

  return Object.values(bySurgeon)
    .filter(s => s.total >= 5)
    .map(s => (s.delayed / s.total) * 100)
}


// ═════════════════════════════════════════════════════════════
// MAIN CALCULATION
// ═════════════════════════════════════════════════════════════

export function calculateORbitScores(input: ScorecardInput): ORbitScorecard[] {
  const { cases, financials, flags, settings, timezone, enableDiagnostics } = input
  const minProcCases = settings.min_procedure_cases || 3

  // Build financials lookup
  const financialsMap = new Map<string, ScorecardFinancials>()
  for (const f of financials) {
    financialsMap.set(f.case_id, f)
  }

  // Group cases by surgeon
  const bySurgeon: Record<string, ScorecardCase[]> = {}
  for (const c of cases) {
    if (!bySurgeon[c.surgeon_id]) bySurgeon[c.surgeon_id] = []
    bySurgeon[c.surgeon_id].push(c)
  }

  // Calculate previous period composites if data available
  const previousComposites = new Map<string, number>()
  if (input.previousPeriodCases && input.previousPeriodCases.length > 0) {
    const prevFinMap = new Map<string, ScorecardFinancials>()
    for (const f of (input.previousPeriodFinancials || [])) {
      prevFinMap.set(f.case_id, f)
    }

    const prevBySurgeon: Record<string, ScorecardCase[]> = {}
    for (const c of input.previousPeriodCases) {
      if (!prevBySurgeon[c.surgeon_id]) prevBySurgeon[c.surgeon_id] = []
      prevBySurgeon[c.surgeon_id].push(c)
    }

    for (const [surgeonId, surgeonCases] of Object.entries(prevBySurgeon)) {
      if (surgeonCases.length < MIN_CASE_THRESHOLD) continue
      const pillars: PillarScores = {
        profitability: calculateProfitability(surgeonCases, input.previousPeriodCases, prevFinMap, minProcCases),
        consistency: calculateConsistency(surgeonCases, input.previousPeriodCases, minProcCases),
        schedAdherence: calculateScheduleAdherence(surgeonCases, input.previousPeriodCases, settings, timezone),
        availability: calculateAvailability(surgeonCases, input.previousPeriodCases, input.previousPeriodFlags || flags, settings),
      }
      previousComposites.set(surgeonId, computeComposite(pillars))
    }
  }

  // Build scorecards
  const scorecards: ORbitScorecard[] = []

  for (const [surgeonId, surgeonCases] of Object.entries(bySurgeon)) {
    if (surgeonCases.length < MIN_CASE_THRESHOLD) continue

    const first = surgeonCases[0]

    // Unique procedures
    const procCounts: Record<string, number> = {}
    for (const c of surgeonCases) {
      procCounts[c.procedure_name] = (procCounts[c.procedure_name] || 0) + 1
    }
    const procedureBreakdown = Object.entries(procCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Build diagnostics containers if enabled
    let diagnostics: PillarDiagnostics | undefined
    let profitDiag: ProfitabilityDiag | undefined
    let consistDiag: ConsistencyDiag | undefined
    let adhereDiag: AdherenceDiag | undefined
    let availDiag: AvailabilityDiag | undefined

    if (enableDiagnostics) {
      profitDiag = { procedureCohorts: [], finalScore: 0, method: '' }
      consistDiag = { procedureCohorts: [], finalScore: 0, method: '' }
      adhereDiag = { totalCasesScored: 0, avgCaseScore: 0, casesWithin_grace: 0, casesAtZero: 0, finalScore: 0 }
      availDiag = { gapCasesScored: 0, avgGapScore: 0, delayRate: 0, gapPillarScore: 0, delayPillarScore: 0, finalScore: 0 }
    }

    // Calculate each pillar
    const pillars: PillarScores = {
      profitability: calculateProfitability(surgeonCases, cases, financialsMap, minProcCases, profitDiag),
      consistency: calculateConsistency(surgeonCases, cases, minProcCases, consistDiag),
      schedAdherence: calculateScheduleAdherence(surgeonCases, cases, settings, timezone, adhereDiag),
      availability: calculateAvailability(surgeonCases, cases, flags, settings, availDiag),
    }

    if (enableDiagnostics && profitDiag && consistDiag && adhereDiag && availDiag) {
      diagnostics = {
        profitability: profitDiag,
        consistency: consistDiag,
        schedAdherence: adhereDiag,
        availability: availDiag,
      }
    }

    const composite = computeComposite(pillars)
    const prevComposite = previousComposites.get(surgeonId) ?? null
    const trend: 'up' | 'down' | 'stable' = prevComposite === null
      ? 'stable'
      : composite > prevComposite ? 'up'
      : composite < prevComposite ? 'down'
      : 'stable'

    scorecards.push({
      surgeonId,
      surgeonName: `Dr. ${first.surgeon_last_name}`,
      firstName: first.surgeon_first_name,
      lastName: first.surgeon_last_name,
      caseCount: surgeonCases.length,
      procedures: procedureBreakdown.map(p => p.name),
      procedureBreakdown,
      flipRoom: detectFlipRoom(surgeonCases),
      pillars,
      composite,
      grade: getGrade(composite),
      trend,
      previousComposite: prevComposite,
      diagnostics,
    })
  }

  // Sort by composite descending
  scorecards.sort((a, b) => b.composite - a.composite)

  return scorecards
}
