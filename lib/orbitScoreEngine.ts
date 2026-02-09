// lib/orbitScoreEngine.ts
// ORbit Score Calculation Engine v2
// ─────────────────────────────────────────────────────────────
// 4-pillar scoring system measuring only surgeon-controllable behaviors.
//
// Pillars:
//   1. Profitability  (30%) — Margin per OR minute, peer-ranked within procedure cohort
//   2. Consistency     (25%) — CV of case duration, peer-ranked within procedure cohort
//   3. Sched Adherence (25%) — Graduated: did cases start on/before scheduled time?
//   4. Availability    (20%) — Graduated: was surgeon ready when room was ready?
//
// Graduated pillars use linear decay:
//   case_score = max(0, 1.0 - minutes_over_grace / floor)
//
// Continuous pillars use percentile ranking within procedure cohorts.

// ─── TYPES ────────────────────────────────────────────────────

export interface PillarScores {
  profitability: number
  consistency: number
  schedAdherence: number
  availability: number
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
}

export interface GradeInfo {
  letter: string
  label: string
  text: string   // color
  bg: string     // background color
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
  scheduled_date: string       // YYYY-MM-DD
  start_time: string | null    // HH:MM scheduled start
  // Milestone timestamps (UTC ISO strings, null if not recorded)
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
  total_case_minutes: number | null
}

export interface ScorecardFlag {
  case_id: string
  flag_type: string            // 'threshold' | 'delay'
  severity: string
  delay_type_name: string | null
  created_by: string | null    // null = auto, user_id = manual
}

export interface ScorecardSettings {
  // Schedule Adherence
  start_time_milestone: 'patient_in' | 'incision'
  start_time_grace_minutes: number       // default 3
  start_time_floor_minutes: number       // default 20 — minutes over grace until score = 0

  // Availability
  waiting_on_surgeon_minutes: number     // default 3 — expected prep-to-incision gap
  waiting_on_surgeon_floor_minutes: number // default 10 — minutes over threshold until score = 0

  // Cohort
  min_procedure_cases: number            // default 3
}

export interface ScorecardInput {
  cases: ScorecardCase[]
  financials: ScorecardFinancials[]
  flags: ScorecardFlag[]
  settings: ScorecardSettings
  dateRange: { start: string; end: string }
  timezone: string                        // IANA timezone e.g. 'America/New_York'
  previousPeriodCases?: ScorecardCase[]
  previousPeriodFinancials?: ScorecardFinancials[]
  previousPeriodFlags?: ScorecardFlag[]
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

/** Convert a UTC ISO timestamp to minutes-since-midnight in the facility's local timezone */
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

function percentileRank(value: number, allValues: number[], lowerIsBetter: boolean = false): number {
  if (allValues.length <= 1) return 50
  const sorted = [...allValues].sort((a, b) => a - b)
  let rank = 0
  for (const v of sorted) {
    if (lowerIsBetter ? v >= value : v <= value) rank++
  }
  return (rank / sorted.length) * 100
}

function clampScore(percentile: number, floor: number = 20, ceiling: number = 95): number {
  if (percentile <= floor) return 0
  if (percentile >= ceiling) return 100
  return Math.round(((percentile - floor) / (ceiling - floor)) * 100)
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

// ─── CASE DURATION EXTRACTION ────────────────────────────────

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
// Median margin per OR minute, percentile-ranked within procedure type cohort.
// Higher MPM = better. Volume-weighted across procedure types.

function calculateProfitability(
  surgeonCases: ScorecardCase[],
  allCases: ScorecardCase[],
  financialsMap: Map<string, ScorecardFinancials>,
  minProcCases: number,
): number {
  const surgeonByProc = groupByProcedure(surgeonCases)
  const scores: { score: number; volume: number }[] = []

  for (const [procId, cases] of Object.entries(surgeonByProc)) {
    const surgeonMPMs = cases
      .map(c => {
        const fin = financialsMap.get(c.id)
        const duration = getCaseDuration(c)
        if (!fin?.profit || !duration || duration <= 0) return null
        return fin.profit / duration
      })
      .filter((v): v is number => v !== null)

    if (surgeonMPMs.length < minProcCases) continue

    const surgeonMedianMPM = median(surgeonMPMs)
    const peerMPMs = getPeerMedianMPMs(allCases, financialsMap, procId, minProcCases)
    const pctile = percentileRank(surgeonMedianMPM, peerMPMs)
    scores.push({ score: clampScore(pctile), volume: surgeonMPMs.length })
  }

  if (scores.length === 0) return 50
  const totalVolume = scores.reduce((s, x) => s + x.volume, 0)
  return Math.round(scores.reduce((s, x) => s + x.score * (x.volume / totalVolume), 0))
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
    if (!fin?.profit || !duration || duration <= 0) continue
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
// CV of case duration within procedure type, percentile-ranked.
// Lower CV = more predictable = better. Volume-weighted across procedure types.

function calculateConsistency(
  surgeonCases: ScorecardCase[],
  allCases: ScorecardCase[],
  minProcCases: number,
): number {
  const surgeonByProc = groupByProcedure(surgeonCases)
  const scores: { score: number; volume: number }[] = []

  for (const [procId, cases] of Object.entries(surgeonByProc)) {
    const durations = cases
      .map(c => getCaseDuration(c))
      .filter((d): d is number => d !== null && d > 0)

    if (durations.length < minProcCases) continue

    const surgeonCV = coefficientOfVariation(durations)
    const peerCVs = getPeerCVs(allCases, procId, minProcCases)
    const pctile = percentileRank(surgeonCV, peerCVs, true) // lower CV is better
    scores.push({ score: clampScore(pctile), volume: durations.length })
  }

  if (scores.length === 0) return 50
  const totalVolume = scores.reduce((s, x) => s + x.volume, 0)
  return Math.round(scores.reduce((s, x) => s + x.score * (x.volume / totalVolume), 0))
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
// Each case scored 0.0-1.0 via linear decay:
//   - Early or within grace → 1.0
//   - Each minute over grace costs 1/floor points
//   - At or beyond floor → 0.0
//
// Absorbs FCOTS — first cases are evaluated identically to all others.

function calculateScheduleAdherence(
  surgeonCases: ScorecardCase[],
  allCases: ScorecardCase[],
  settings: ScorecardSettings,
  timezone: string,
): number {
  const surgeonId = surgeonCases[0]?.surgeon_id
  if (!surgeonId) return 50

  const caseScores = scoreCasesForAdherence(surgeonCases, settings, timezone)

  if (caseScores.length === 0) return 50

  // Surgeon's raw score = mean of graduated case scores, scaled to 0-100
  const surgeonRaw = mean(caseScores) * 100

  // Percentile rank against peers
  const peerRawScores = getPeerAdherenceScores(allCases, settings, timezone)
  const pctile = percentileRank(surgeonRaw, peerRawScores) // higher is better
  return clampScore(pctile)
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
    const deltaMin = actualMin - scheduledMin // negative = early, positive = late

    // Minutes over grace (0 if early or within grace)
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
//
// A. Prep-to-Incision Gap (50%) — Graduated scoring
//    How long did the team wait after prep/drape for surgeon to begin?
//    Linear decay: within threshold → 1.0, each minute over costs 1/floor.
//
// B. Surgeon Delay Rate (50%) — Percentile ranked
//    % of cases with a delay flag attributed to the surgeon.

function calculateAvailability(
  surgeonCases: ScorecardCase[],
  allCases: ScorecardCase[],
  flags: ScorecardFlag[],
  settings: ScorecardSettings,
): number {
  const surgeonId = surgeonCases[0]?.surgeon_id
  if (!surgeonId) return 50

  // ── Sub-Metric A: Prep-to-Incision Gap (graduated) ──
  const gapScores = scoreCasesForAvailability(surgeonCases, settings)

  let gapPillarScore = 50
  if (gapScores.length >= 3) {
    const surgeonRaw = mean(gapScores) * 100
    const peerRawScores = getPeerAvailabilityScores(allCases, settings)
    const pctile = percentileRank(surgeonRaw, peerRawScores) // higher is better
    gapPillarScore = clampScore(pctile)
  }

  // ── Sub-Metric B: Delay Rate (percentile) ──
  const surgeonCaseIds = new Set(surgeonCases.map(c => c.id))
  const surgeonDelayCount = flags.filter(f =>
    surgeonCaseIds.has(f.case_id) && f.flag_type === 'delay'
  ).length
  const delayRate = surgeonCases.length > 0
    ? (surgeonDelayCount / surgeonCases.length) * 100
    : 0

  const peerDelayRates = getPeerDelayRates(allCases, flags)
  const delayPctile = percentileRank(delayRate, peerDelayRates, true) // lower is better
  const delayScore = clampScore(delayPctile)

  // Blend 50/50
  return Math.round(gapPillarScore * 0.5 + delayScore * 0.5)
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
  const { cases, financials, flags, settings, timezone } = input
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

    // Calculate each pillar
    const pillars: PillarScores = {
      profitability: calculateProfitability(surgeonCases, cases, financialsMap, minProcCases),
      consistency: calculateConsistency(surgeonCases, cases, minProcCases),
      schedAdherence: calculateScheduleAdherence(surgeonCases, cases, settings, timezone),
      availability: calculateAvailability(surgeonCases, cases, flags, settings),
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
    })
  }

  // Sort by composite descending
  scorecards.sort((a, b) => b.composite - a.composite)

  return scorecards
}