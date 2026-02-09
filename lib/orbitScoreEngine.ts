// lib/orbitScoreEngine.ts
// ═══════════════════════════════════════════════════════════════════
// ORbit Score Calculation Engine v2.2
// ═══════════════════════════════════════════════════════════════════
//
// PURPOSE
// ───────
// Produces a single composite score (0-100) per surgeon per time period,
// measuring ONLY surgeon-controllable operational behaviors. Designed to
// be fair, explainable, and actionable for surgery centers with 3-20
// surgeons doing overlapping procedure types.
//
// The system deliberately avoids:
//   • Clinical outcome measurement (not a quality score)
//   • Peer speed comparison (doesn't penalize careful surgeons)
//   • Uncontrollable delays (equipment failure, anesthesia delays)
//
// ═══════════════════════════════════════════════════════════════════
// 4-PILLAR MODEL
// ═══════════════════════════════════════════════════════════════════
//
// ┌─────────────────────────────┬────────┬────────────────────────┐
// │ Pillar                      │ Weight │ Scoring Method         │
// ├─────────────────────────────┼────────┼────────────────────────┤
// │ 1. Profitability            │  30%   │ MAD-relative to peers  │
// │ 2. Consistency              │  25%   │ MAD-relative to peers  │
// │ 3. Schedule Adherence       │  25%   │ Raw graduated decay    │
// │ 4. Availability             │  20%   │ Raw graduated decay    │
// └─────────────────────────────┴────────┴────────────────────────┘
//
// RELATIVE PILLARS (1 & 2) — "How do you compare to peers?"
// ──────────────────────────────────────────────────────────
// Use median-anchored MAD (Median Absolute Deviation) scoring:
//
//   score = 50 + (value - cohort_median) / effectiveMAD × 16.67
//
// Key parameters:
//   • MAD_BAND = 3 — it takes 3 MADs from median to reach 0 or 100
//   • MIN_MAD_PERCENT = 5% — percentage floor prevents noise amplification
//     in tightly-clustered cohorts (e.g., all surgeons within $1/min)
//   • MIN_ABSOLUTE_MAD_CV = 0.01 — absolute floor for CV scoring where
//     percentage floors are ineffective (5% of 0.045 = 0.002, too small)
//   • MIN_PILLAR_SCORE = 10 — no pillar scores below 10, prevents
//     mathematically unrecoverable composites
//
// Scoring is done within procedure-type cohorts (THA vs THA, not THA vs
// TKA), then volume-weighted across the surgeon's case mix. This ensures
// surgeons are only compared against peers doing the same procedure.
//
// Why MAD over standard deviation?
//   MAD is robust to outliers. One surgeon with an extreme value doesn't
//   distort the entire cohort's spread measure. Critical for small ASC
//   cohorts where n=5 is common.
//
// Why 3 MAD band instead of 2?
//   With 5 surgeons, being 2 MADs from median just means you're the
//   best or worst — not necessarily an outlier. 3 MAD gives:
//     1 MAD from median → ~33 or ~67 (below/above average)
//     2 MAD from median → ~17 or ~83 (poor/excellent)
//     3 MAD from median →  10 or 100 (extreme outlier)
//
// GRADUATED PILLARS (3 & 4) — "How well do you perform against standards?"
// ────────────────────────────────────────────────────────────────────────
// Use raw graduated decay — NO peer comparison layer:
//
//   case_score = max(0, 1.0 - minutes_over_grace / floor_minutes)
//   pillar_score = mean(all case_scores) × 100
//
// Design decision: The graduated decay already produces a meaningful
// absolute score (77% = "77% on-time effectiveness"). Adding MAD scoring
// on top would create a second relative layer that amplifies small
// differences between peers and makes scores harder to explain.
//
// Schedule Adherence (25%):
//   Measures how close actual case start times are to scheduled times.
//   Each case gets a 0.0-1.0 score based on how far past the grace
//   period it started. Cases within grace = 1.0 (perfect).
//
// Availability (20%):
//   Two sub-metrics blended 50/50:
//   A. Prep-to-Incision Gap — graduated decay of the time between
//      prep/drape completion and incision (surgeon readiness)
//   B. Surgeon Delay Rate — percentage of cases flagged with surgeon-
//      caused delays. 0% delays = 100 score, linearly decays.
//
// ═══════════════════════════════════════════════════════════════════
// GRADE THRESHOLDS
// ═══════════════════════════════════════════════════════════════════
//
// ┌───────┬────────┬───────────────────────────────────────────────┐
// │ Grade │ Score  │ Meaning                                       │
// ├───────┼────────┼───────────────────────────────────────────────┤
// │ A     │ ≥ 80   │ Elite — top performer, aspirational target    │
// │ B     │ ≥ 65   │ Strong — above average, minor improvements    │
// │ C     │ ≥ 50   │ Developing — meeting expectations, room to    │
// │       │        │   grow in specific pillars                     │
// │ D     │ < 50   │ Needs Improvement — clear action items needed │
// └───────┴────────┴───────────────────────────────────────────────┘
//
// Score distribution rationale:
//   Relative pillars center at 50 (median performer). Graduated
//   pillars naturally sit higher (70-95 range for competent surgeons).
//   With weights of 55% relative + 45% graduated, an average surgeon's
//   composite lands around 61-68. This means:
//     • A (≥80): Requires genuine excellence across multiple pillars
//     • B (≥65): Solidly above the average composite
//     • C (≥50): Average, meeting expectations
//     • D (<50): Clear underperformance needing attention
//
// Realistic ceiling: ~89 (top of every cohort + perfect on-time)
// Realistic floor: ~20 (bottom of every cohort + poor adherence)
// This keeps grades meaningful and earned.
//
// ═══════════════════════════════════════════════════════════════════
// DATA REQUIREMENTS
// ═══════════════════════════════════════════════════════════════════
//
// Per case: patient_in_at, patient_out_at, incision_at, prep_drape_
//   complete_at, closing_at, start_time (scheduled), scheduled_date,
//   procedure_type_id, surgeon_id, or_room_id
//
// Per case financials: profit (null allowed = skipped, 0 = break-even)
//
// Settings: start_time_milestone, start_time_grace_minutes,
//   start_time_floor_minutes, waiting_on_surgeon_minutes,
//   waiting_on_surgeon_floor_minutes, min_procedure_cases
//
// Minimum cases: MIN_CASE_THRESHOLD (15) overall per surgeon.
//   min_procedure_cases (facility setting) per procedure cohort.
//
// ═══════════════════════════════════════════════════════════════════
// DIAGNOSTICS
// ═══════════════════════════════════════════════════════════════════
//
// When enableDiagnostics: true, each scorecard includes per-pillar
// diagnostic data showing intermediate calculations:
//   • Profitability: per-procedure MPM, cohort median, MAD, effectiveMAD
//   • Consistency: per-procedure CV, cohort median, MAD, effectiveMAD
//   • Schedule Adherence: avgCaseScore, casesWithinGrace, casesAtZero
//   • Availability: avgGapScore, delayRate, sub-metric scores
//
// ═══════════════════════════════════════════════════════════════════
// VERSION HISTORY
// ═══════════════════════════════════════════════════════════════════
//
// v2.2 — Graduated pillars use raw scores (no peer MAD layer).
//         Absolute MAD floor (0.01) for CV consistency scoring.
//         Grade thresholds recalibrated: A≥80, B≥65, C≥50, D<50.
//         Comprehensive documentation added.
//
// v2.1 — 3 MAD scoring band (was 2). MIN_PILLAR_SCORE floor of 10.
//         5% minimum MAD percentage floor for profitability.
//
// v2.0 — 4-pillar model with MAD-based scoring. Volume-weighted
//         procedure cohorts. Graduated decay for adherence/availability.
//         Fixed: profit === 0 treated as valid data (not missing).
//         Fixed: data_validated filter, correct financials query.
//

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
 * Absolute minimum MAD for CV (consistency) scoring.
 * CV values cluster tightly (0.04-0.06 typical), so the percentage floor
 * (5% of 0.045 = 0.002) is useless. 0.01 means a CV difference of 0.01
 * = 1 effective MAD = ~17 point score difference. Clinically meaningful
 * threshold: "your 90-min case varies by ±0.9 more minutes than peers."
 */
const MIN_ABSOLUTE_MAD_CV = 0.01

/**
 * Median-anchored MAD scoring with minimum MAD floors.
 *
 * Maps a value to 0-100 based on its position relative to the cohort:
 *   - At median = 50
 *   - 1 effective MAD above/below = 50 ± 16.67
 *   - 3 effective MAD = 10 or 100 (floored at MIN_PILLAR_SCORE)
 *
 * Effective MAD = max(actualMAD, |cohortMedian| * MIN_MAD_PERCENT, absoluteMinMAD)
 * This prevents tiny MAD from amplifying noise in tightly-clustered cohorts.
 * The absoluteMinMAD parameter handles domains like CV where percentage floors
 * are ineffective (5% of 0.045 = 0.002 — too small to matter).
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
  absoluteMinMAD: number = 0,
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

  // Apply minimum MAD floor: max of (actual MAD, percentage floor, absolute floor)
  const percentFloor = Math.abs(cohortMed) * MIN_MAD_PERCENT
  const effectiveMAD = Math.max(actualMAD, percentFloor, absoluteMinMAD)

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
  if (score >= 80) return { letter: 'A', label: 'Elite', text: '#059669', bg: '#ECFDF5' }
  if (score >= 65) return { letter: 'B', label: 'Strong', text: '#2563EB', bg: '#EFF6FF' }
  if (score >= 50) return { letter: 'C', label: 'Developing', text: '#D97706', bg: '#FFFBEB' }
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

    // Score via MAD (lower CV = better, with absolute MAD floor for CV values)
    const score = madScore(surgeonCV, peerCVs, false, MIN_ABSOLUTE_MAD_CV)
    scores.push({ score, volume: durations.length })

    if (diag) {
      const peerMed = median(peerCVs)
      const peerActualMAD = mad(peerCVs)
      const peerEffMAD = Math.max(peerActualMAD, Math.abs(peerMed) * MIN_MAD_PERCENT, MIN_ABSOLUTE_MAD_CV)
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
// Final pillar score: mean(case scores) * 100 — direct, no peer comparison.
// The graduated decay already produces a meaningful absolute score.

interface AdherenceDiag {
  totalCasesScored: number
  avgCaseScore: number
  casesWithin_grace: number
  casesAtZero: number
  finalScore: number
}

function calculateScheduleAdherence(
  surgeonCases: ScorecardCase[],
  settings: ScorecardSettings,
  timezone: string,
  diag?: AdherenceDiag,
): number {
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

  // Direct score: mean of per-case graduated scores, scaled to 0-100
  const final = clamp(Math.round(mean(caseScores) * 100), MIN_PILLAR_SCORE, 100)

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


// ═════════════════════════════════════════════════════════════
// PILLAR 4: AVAILABILITY (20%)
// ═════════════════════════════════════════════════════════════
// Two sub-metrics blended 50/50:
// A. Prep-to-Incision Gap (graduated, raw score — no peer comparison)
// B. Surgeon Delay Rate (direct: 0% delays = 100, scaled linearly)

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
  flags: ScorecardFlag[],
  settings: ScorecardSettings,
  diag?: AvailabilityDiag,
): number {
  const surgeonId = surgeonCases[0]?.surgeon_id
  if (!surgeonId) return 50

  // ── Sub-Metric A: Prep-to-Incision Gap (graduated, direct) ──
  const gapScores = scoreCasesForAvailability(surgeonCases, settings)

  let gapPillarScore = 50
  if (gapScores.length >= 3) {
    gapPillarScore = clamp(Math.round(mean(gapScores) * 100), MIN_PILLAR_SCORE, 100)
  }

  // ── Sub-Metric B: Delay Rate (direct: lower rate = higher score) ──
  const surgeonCaseIds = new Set(surgeonCases.map(c => c.id))
  const surgeonDelayCount = flags.filter(f =>
    surgeonCaseIds.has(f.case_id) && f.flag_type === 'delay'
  ).length
  const delayRate = surgeonCases.length > 0
    ? (surgeonDelayCount / surgeonCases.length) * 100
    : 0

  // Direct scoring: 0% delay = 100, 50%+ delay = 10 (floor)
  // Linear: score = 100 - (delayRate * 2), clamped
  const delayScore = clamp(Math.round(100 - delayRate * 2), MIN_PILLAR_SCORE, 100)

  const final = clamp(Math.round(gapPillarScore * 0.5 + delayScore * 0.5), MIN_PILLAR_SCORE, 100)

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
        schedAdherence: calculateScheduleAdherence(surgeonCases, settings, timezone),
        availability: calculateAvailability(surgeonCases, input.previousPeriodFlags || flags, settings),
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
      schedAdherence: calculateScheduleAdherence(surgeonCases, settings, timezone, adhereDiag),
      availability: calculateAvailability(surgeonCases, flags, settings, availDiag),
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


// ═════════════════════════════════════════════════════════════
// IMPROVEMENT PLAN GENERATOR
// ═════════════════════════════════════════════════════════════

export interface ImprovementRecommendation {
  pillar: keyof PillarScores
  pillarLabel: string
  pillarColor: string
  priority: number
  currentScore: number
  targetScore: number
  compositeImpact: number

  // Human-readable
  headline: string
  insight: string
  actions: string[]

  // Quantified impact
  projectedMinutesSaved: number
  projectedAnnualHours: number
  projectedAnnualDollars: number
}

export interface ImprovementPlan {
  surgeonName: string
  currentComposite: number
  currentGrade: GradeInfo
  projectedComposite: number
  projectedGrade: GradeInfo
  totalProjectedHours: number
  totalProjectedDollars: number
  recommendations: ImprovementRecommendation[]
  strengths: { pillarLabel: string; score: number; message: string }[]
}

interface ImprovementConfig {
  orCostPerMinute?: number
  annualCaseMultiplier?: number  // how many periods per year (e.g., 4 for quarterly)
  improvementThreshold?: number  // pillars below this get recommendations
}

/**
 * Generate an actionable improvement plan from a scorecard.
 *
 * For each pillar below the threshold, produces:
 *   - A data-driven insight explaining *why* the score is low
 *   - 2-4 specific actions the surgeon can take
 *   - Projected time and dollar impact of improvement
 *
 * Impact calculations assume facility-standard OR cost per minute
 * and annualize based on the scoring period.
 */
export function generateImprovementPlan(
  scorecard: ORbitScorecard,
  settings: ScorecardSettings,
  config: ImprovementConfig = {},
): ImprovementPlan {
  const {
    orCostPerMinute = 60,
    annualCaseMultiplier = 4,  // default: quarterly data → multiply by 4
    improvementThreshold = 65, // below B = needs improvement
  } = config

  const annualCases = scorecard.caseCount * annualCaseMultiplier
  const diag = scorecard.diagnostics
  const recommendations: ImprovementRecommendation[] = []
  const strengths: { pillarLabel: string; score: number; message: string }[] = []

  // ── Evaluate each pillar ──

  for (const p of PILLARS) {
    const score = scorecard.pillars[p.key]

    if (score >= improvementThreshold) {
      // This is a strength
      if (score >= 75) {
        strengths.push({
          pillarLabel: p.label,
          score,
          message: score >= 85
            ? `Top-tier ${p.label.toLowerCase()} — a model for peers`
            : `Strong ${p.label.toLowerCase()} — above facility average`,
        })
      }
      continue
    }

    // Target: get to B threshold, or if close, aim for 75
    const targetScore = score >= 55 ? 75 : improvementThreshold
    const weight = p.weight
    const compositeImpact = Math.round((targetScore - score) * weight)

    let headline = ''
    let insight = ''
    let actions: string[] = []
    let projectedMinutesSaved = 0

    // ── Pillar-specific analysis ──

    if (p.key === 'profitability' && diag?.profitability) {
      const scoredCohorts = diag.profitability.procedureCohorts.filter(c => !c.skippedReason)
      const worstCohort = scoredCohorts.sort((a, b) => a.rawScore - b.rawScore)[0]

      if (worstCohort) {
        const mpmGap = worstCohort.cohortMedian - worstCohort.surgeonMedianMPM
        const avgCaseMins = 90 // reasonable OR time estimate
        const potentialPerCase = mpmGap * avgCaseMins

        headline = mpmGap > 0
          ? `$${mpmGap.toFixed(0)}/min below peers on ${worstCohort.procedureName}`
          : `Close to peer median — small optimizations add up`

        insight = worstCohort.surgeonMedianMPM > 0
          ? `Your ${worstCohort.procedureName} cases generate $${worstCohort.surgeonMedianMPM.toFixed(2)}/min vs the peer median of $${worstCohort.cohortMedian.toFixed(2)}/min. ${mpmGap > 5 ? 'This suggests longer OR times are diluting per-minute revenue.' : 'The gap is modest — focus on consistency to maximize scheduling.'}`
          : `Your ${worstCohort.procedureName} cases are operating at a loss ($${worstCohort.surgeonMedianMPM.toFixed(2)}/min). Reducing OR time is the most direct path to profitability.`

        actions = [
          'Review case setup and equipment positioning protocols to reduce non-cutting time',
          'Identify the 10% longest cases — look for common patterns (equipment, team, time of day)',
          'Work with OR coordinator to ensure preferred instrument trays are pre-staged',
        ]
        if (mpmGap > 10) {
          actions.push('Consider a focused OR time reduction initiative with a target of reducing average case time by 10-15 minutes')
        }

        // Impact: closing half the MPM gap over annualized cases
        const casesInCohort = worstCohort.validCases * annualCaseMultiplier
        projectedMinutesSaved = Math.round((mpmGap > 0 ? mpmGap * 0.5 : 2) * casesInCohort)
      }
    }

    else if (p.key === 'consistency' && diag?.consistency) {
      const scoredCohorts = diag.consistency.procedureCohorts.filter(c => !c.skippedReason)
      const worstCohort = scoredCohorts.sort((a, b) => b.surgeonCV - a.surgeonCV)[0]

      if (worstCohort) {
        const cvPercent = (worstCohort.surgeonCV * 100).toFixed(1)
        const peerCVPercent = (worstCohort.cohortMedian * 100).toFixed(1)
        const avgDuration = 90 // estimate
        const variabilityMins = Math.round(worstCohort.surgeonCV * avgDuration)
        const peerVariabilityMins = Math.round(worstCohort.cohortMedian * avgDuration)

        headline = `±${variabilityMins} min variability on ${worstCohort.procedureName} (peers: ±${peerVariabilityMins} min)`

        insight = `Your ${worstCohort.procedureName} CV is ${cvPercent}% vs the peer median of ${peerCVPercent}%. This means your case durations vary by approximately ±${variabilityMins} minutes around your average — making it harder for schedulers to plan accurately.`

        actions = [
          'Request consistent OR team assignments — familiar teams reduce variability',
          'Standardize your pre-incision checklist to eliminate variable setup time',
          'Track cases that run 20%+ over your average and identify the root cause',
          'Consider dictating expected duration to the scheduler per case rather than using defaults',
        ]

        // Impact: reducing variability improves scheduling accuracy
        const cohortCases = worstCohort.validCases * annualCaseMultiplier
        const excessVariability = Math.max(0, variabilityMins - peerVariabilityMins)
        projectedMinutesSaved = Math.round(excessVariability * 0.5 * cohortCases)
      }
    }

    else if (p.key === 'schedAdherence' && diag?.schedAdherence) {
      const { avgCaseScore, casesAtZero, totalCasesScored } = diag.schedAdherence
      const currentPercent = Math.round(avgCaseScore * 100)
      const targetPercent = targetScore
      const floor = settings.start_time_floor_minutes
      const grace = settings.start_time_grace_minutes

      // Estimate average minutes late from the decay score
      // Score of X means (1-X) × floor minutes past grace
      const avgMinutesLate = Math.round((1 - avgCaseScore) * floor)
      const targetMinutesLate = Math.round((1 - targetPercent / 100) * floor)

      headline = `Starting ~${avgMinutesLate} min late on average (${casesAtZero} cases severely late)`

      insight = `Your average on-time score is ${currentPercent}% across ${totalCasesScored} cases. ${casesAtZero} cases scored zero (${Math.round(casesAtZero / totalCasesScored * 100)}%), meaning they started ${floor}+ minutes late. Late starts cascade through the schedule, pushing every subsequent case later.`

      actions = [
        `Arrive to pre-op ${grace + 5} minutes before scheduled start to complete assessments within the grace window`,
        casesAtZero > 3
          ? `Investigate the ${casesAtZero} severely late cases — are they clustered on certain days, rooms, or case positions?`
          : 'Maintain awareness of the scheduled start time for each case position',
        'Coordinate with the OR front desk to receive 15-minute pre-start alerts',
        'For first cases of the day, verify that pre-op assessment is complete before scheduled OR time',
      ]

      // Impact: average minutes saved per case × annual cases
      const minutesSavedPerCase = Math.max(0, avgMinutesLate - targetMinutesLate)
      projectedMinutesSaved = minutesSavedPerCase * annualCases
    }

    else if (p.key === 'availability' && diag?.availability) {
      const { avgGapScore, delayRate, gapCasesScored } = diag.availability
      const gapFloor = settings.waiting_on_surgeon_floor_minutes
      const gapGrace = settings.waiting_on_surgeon_minutes

      // Estimate average gap from the decay score
      const avgExcessGap = Math.round((1 - avgGapScore) * gapFloor)

      headline = avgExcessGap > 0
        ? `OR team waiting ~${avgExcessGap} min per case for surgeon`
        : delayRate > 0
        ? `${delayRate.toFixed(0)}% of cases have surgeon-caused delays`
        : `Availability score below target`

      insight = avgExcessGap > 0
        ? `Your average prep-to-incision gap score is ${Math.round(avgGapScore * 100)}% across ${gapCasesScored} cases. The team completes patient prep and waits approximately ${avgExcessGap} minutes for you beyond the expected ${gapGrace}-minute window. This is idle OR time with full staff standing by.`
        : `Your delay rate of ${delayRate.toFixed(1)}% indicates surgeon-caused delays are impacting the schedule.`

      actions = [
        'Scrub in during patient prep — be present in the OR before draping is complete',
        `Target being gowned and gloved within ${gapGrace} minutes of the patient entering the room`,
        'Use the callback system to time your arrival precisely with prep completion',
        'For flip-room setups, transition to the next room immediately after closing',
      ]

      // Impact: reducing gap minutes
      const targetGapScore = targetScore / 100
      const targetExcessGap = Math.round((1 - targetGapScore) * gapFloor)
      const minutesSavedPerCase = Math.max(0, avgExcessGap - targetExcessGap)
      projectedMinutesSaved = minutesSavedPerCase * annualCases
    }

    // Fallback if no diagnostics
    if (!headline) {
      headline = `${p.label} at ${score} — below the facility target of ${improvementThreshold}`
      insight = `This pillar is scoring below the facility B threshold. Review the detailed diagnostics for specific areas to address.`
      actions = ['Review pillar diagnostics with your OR director', 'Identify the top 2-3 cases that scored lowest']
      projectedMinutesSaved = Math.round(annualCases * 2) // conservative 2 min/case estimate
    }

    const projectedAnnualHours = Math.round(projectedMinutesSaved / 60 * 10) / 10
    const projectedAnnualDollars = Math.round(projectedMinutesSaved * orCostPerMinute)

    recommendations.push({
      pillar: p.key,
      pillarLabel: p.label,
      pillarColor: p.color,
      priority: 0, // set below
      currentScore: score,
      targetScore,
      compositeImpact,
      headline,
      insight,
      actions,
      projectedMinutesSaved,
      projectedAnnualHours,
      projectedAnnualDollars,
    })
  }

  // Priority: sort by composite impact (highest first)
  recommendations.sort((a, b) => b.compositeImpact - a.compositeImpact)
  recommendations.forEach((r, i) => { r.priority = i + 1 })

  // Projected composite if all improvements achieved
  const projectedPillars = { ...scorecard.pillars }
  for (const r of recommendations) {
    projectedPillars[r.pillar] = r.targetScore
  }
  const projectedComposite = computeComposite(projectedPillars)

  const totalProjectedHours = Math.round(recommendations.reduce((s, r) => s + r.projectedAnnualHours, 0) * 10) / 10
  const totalProjectedDollars = recommendations.reduce((s, r) => s + r.projectedAnnualDollars, 0)

  return {
    surgeonName: scorecard.surgeonName,
    currentComposite: scorecard.composite,
    currentGrade: scorecard.grade,
    projectedComposite,
    projectedGrade: getGrade(projectedComposite),
    totalProjectedHours,
    totalProjectedDollars,
    recommendations,
    strengths,
  }
}