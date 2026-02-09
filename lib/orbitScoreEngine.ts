// lib/orbitScoreEngine.ts
// ORbit Score Calculation Engine
// ─────────────────────────────────────────────────────────────
// Computes 5 pillar scores for each surgeon based on operational metrics.
// Each pillar: raw metric → percentile within procedure cohort → volume-weighted blend → clamped 0-100
// Composite = weighted sum of all pillars.

// ─── TYPES ────────────────────────────────────────────────────

export interface PillarScores {
  consistency: number
  profitability: number
  schedAccuracy: number
  onTime: number
  availability: number
}

export interface ORbitScorecard {
  surgeonId: string
  surgeonName: string
  firstName: string
  lastName: string
  caseCount: number
  procedures: string[]          // unique procedure names
  procedureBreakdown: { name: string; count: number }[]
  flipRoom: boolean             // had cases in multiple rooms on same day
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
  { key: 'consistency',   label: 'Consistency',    weight: 0.20, color: '#059669', description: 'Case duration predictability' },
  { key: 'profitability', label: 'Profitability',   weight: 0.20, color: '#2563EB', description: 'Margin per OR minute' },
  { key: 'schedAccuracy', label: 'Schedule Acc.',    weight: 0.20, color: '#DB2777', description: 'Actual vs scheduled time' },
  { key: 'onTime',        label: 'On-Time',          weight: 0.20, color: '#D97706', description: 'Start time adherence' },
  { key: 'availability',  label: 'Availability',     weight: 0.20, color: '#7C3AED', description: 'Ready when room is ready' },
]

export const MIN_CASE_THRESHOLD = 15

// ─── INPUT TYPES (from Supabase queries) ──────────────────────

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
  fcots_milestone: 'patient_in' | 'incision'
  fcots_grace_minutes: number
  fcots_target_percent: number
  turnover_target_same_surgeon: number
  turnover_target_flip_room: number
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

// ─── UTILITY FUNCTIONS ────────────────────────────────────────

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
  // Intl.DateTimeFormat gives us the local hour/minute in the target timezone
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
  // Maps percentile to 0-100 score with floor and ceiling
  if (percentile <= floor) return 0
  if (percentile >= ceiling) return 100
  return Math.round(((percentile - floor) / (ceiling - floor)) * 100)
}

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

// ─── CASE DURATION EXTRACTION ─────────────────────────────────

function getCaseDuration(c: ScorecardCase): number | null {
  return minutesBetween(c.patient_in_at!, c.patient_out_at!)
}

function getSurgicalDuration(c: ScorecardCase): number | null {
  return minutesBetween(c.incision_at!, c.closing_at!)
}

function getPrepToIncision(c: ScorecardCase): number | null {
  return minutesBetween(c.prep_drape_complete_at!, c.incision_at!)
}

// ─── PILLAR 1: SURGICAL CONSISTENCY (20%) ─────────────────────
// CV of case duration within procedure type, volume-weighted
// Lower CV = more predictable = better score

function calculateConsistency(
  surgeonCases: ScorecardCase[],
  allCases: ScorecardCase[],
): number {
  // Group surgeon's cases by procedure type
  const surgeonByProc = groupByProcedure(surgeonCases)
  
  // For each procedure type, compute CV and get peer CVs for percentile ranking
  const scores: { score: number; volume: number }[] = []

  for (const [procId, cases] of Object.entries(surgeonByProc)) {
    const durations = cases
      .map(c => getCaseDuration(c))
      .filter((d): d is number => d !== null && d > 0)

    if (durations.length < 3) continue // need at least 3 cases for meaningful CV

    const surgeonCV = coefficientOfVariation(durations)

    // Get all surgeons' CVs for this procedure type (peer cohort)
    const peerCVs = getPeerCVs(allCases, procId)

    // Percentile rank (lower CV is better)
    const pctile = percentileRank(surgeonCV, peerCVs, true)
    const score = clampScore(pctile)
    scores.push({ score, volume: durations.length })
  }

  if (scores.length === 0) return 50 // neutral if insufficient data

  // Volume-weighted blend
  const totalVolume = scores.reduce((s, x) => s + x.volume, 0)
  return Math.round(scores.reduce((s, x) => s + x.score * (x.volume / totalVolume), 0))
}

function getPeerCVs(allCases: ScorecardCase[], procedureTypeId: string): number[] {
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
    if (durations.length >= 3) {
      cvs.push(coefficientOfVariation(durations))
    }
  }
  return cvs
}

// ─── PILLAR 2: CASE PROFITABILITY (20%) ───────────────────────
// Contribution margin per OR minute, percentile-ranked within procedure type

function calculateProfitability(
  surgeonCases: ScorecardCase[],
  allCases: ScorecardCase[],
  financialsMap: Map<string, ScorecardFinancials>,
): number {
  const surgeonByProc = groupByProcedure(surgeonCases)
  const scores: { score: number; volume: number }[] = []

  for (const [procId, cases] of Object.entries(surgeonByProc)) {
    // Calculate margin per OR minute for this surgeon's cases of this type
    const surgeonMPMs = cases
      .map(c => {
        const fin = financialsMap.get(c.id)
        const duration = getCaseDuration(c)
        if (!fin?.profit || !duration || duration <= 0) return null
        return fin.profit / duration
      })
      .filter((v): v is number => v !== null)

    if (surgeonMPMs.length < 2) continue

    const surgeonMedianMPM = median(surgeonMPMs)

    // Get all surgeons' median MPMs for this procedure type
    const peerMPMs = getPeerMarginPerMinute(allCases, financialsMap, procId)

    const pctile = percentileRank(surgeonMedianMPM, peerMPMs)
    const score = clampScore(pctile)
    scores.push({ score, volume: surgeonMPMs.length })
  }

  if (scores.length === 0) return 50

  const totalVolume = scores.reduce((s, x) => s + x.volume, 0)
  return Math.round(scores.reduce((s, x) => s + x.score * (x.volume / totalVolume), 0))
}

function getPeerMarginPerMinute(
  allCases: ScorecardCase[],
  financialsMap: Map<string, ScorecardFinancials>,
  procedureTypeId: string,
): number[] {
  const bySurgeon: Record<string, number[]> = {}

  for (const c of allCases) {
    if (c.procedure_type_id !== procedureTypeId) continue
    const fin = financialsMap.get(c.id)
    const duration = getCaseDuration(c)
    if (!fin?.profit || !duration || duration <= 0) continue
    const mpm = fin.profit / duration
    if (!bySurgeon[c.surgeon_id]) bySurgeon[c.surgeon_id] = []
    bySurgeon[c.surgeon_id].push(mpm)
  }

  return Object.values(bySurgeon)
    .filter(mpms => mpms.length >= 2)
    .map(mpms => median(mpms))
}

// ─── PILLAR 3: SCHEDULE ACCURACY (15%) ────────────────────────
// Ratio of actual case duration to expected duration
// Expected = surgeon's own median for that procedure type (from surgeon_procedure_averages or computed)
// Ratio close to 1.0 = accurate scheduling

function calculateScheduleAccuracy(
  surgeonCases: ScorecardCase[],
  allCases: ScorecardCase[],
): number {
  const surgeonByProc = groupByProcedure(surgeonCases)
  const scores: { score: number; volume: number }[] = []

  for (const [procId, cases] of Object.entries(surgeonByProc)) {
    const durations = cases
      .map(c => getCaseDuration(c))
      .filter((d): d is number => d !== null && d > 0)

    if (durations.length < 3) continue

    // Surgeon's own median for this procedure type = their "expected" duration
    const surgeonMedian = median(durations)

    // Calculate how close each case is to their own median
    // ratio = actual / median — closer to 1.0 is better
    const ratios = durations.map(d => d / surgeonMedian)

    // Score = how tight the ratios cluster around 1.0
    // Use the mean absolute deviation from 1.0
    const deviations = ratios.map(r => Math.abs(r - 1.0))
    const surgeonMAD = mean(deviations)

    // Get peer MADs for percentile ranking
    const peerMADs = getPeerScheduleMADs(allCases, procId)

    // Lower MAD is better
    const pctile = percentileRank(surgeonMAD, peerMADs, true)
    const score = clampScore(pctile)
    scores.push({ score, volume: durations.length })
  }

  if (scores.length === 0) return 50

  const totalVolume = scores.reduce((s, x) => s + x.volume, 0)
  return Math.round(scores.reduce((s, x) => s + x.score * (x.volume / totalVolume), 0))
}

function getPeerScheduleMADs(allCases: ScorecardCase[], procedureTypeId: string): number[] {
  const bySurgeon: Record<string, number[]> = {}
  for (const c of allCases) {
    if (c.procedure_type_id !== procedureTypeId) continue
    const d = getCaseDuration(c)
    if (d && d > 0) {
      if (!bySurgeon[c.surgeon_id]) bySurgeon[c.surgeon_id] = []
      bySurgeon[c.surgeon_id].push(d)
    }
  }

  return Object.values(bySurgeon)
    .filter(ds => ds.length >= 3)
    .map(ds => {
      const med = median(ds)
      const ratios = ds.map(d => d / med)
      return mean(ratios.map(r => Math.abs(r - 1.0)))
    })
}

// ─── PILLAR 4: ON-TIME PERFORMANCE (15%) ──────────────────────
// FCOTS + start time adherence for non-first cases
// Uses facility-configured start milestone (patient_in or incision)
// FCOTS compares against scheduled case start time, NOT block start time

function calculateOnTimePerformance(
  surgeonCases: ScorecardCase[],
  allCases: ScorecardCase[],
  settings: ScorecardSettings,
  timezone: string,
): number {
  const surgeonId = surgeonCases[0]?.surgeon_id
  if (!surgeonId) return 50

  // Group cases by date and room to identify first cases
  const casesByDateRoom: Record<string, ScorecardCase[]> = {}
  for (const c of allCases) {
    const key = `${c.scheduled_date}|${c.or_room_id}`
    if (!casesByDateRoom[key]) casesByDateRoom[key] = []
    casesByDateRoom[key].push(c)
  }

  // Sort each group by start time
  for (const cases of Object.values(casesByDateRoom)) {
    cases.sort((a, b) => {
      const ta = a.patient_in_at || a.start_time || ''
      const tb = b.patient_in_at || b.start_time || ''
      return ta.localeCompare(tb)
    })
  }

  // FCOTS: Check surgeon's first cases against scheduled start time
  let fcotsOnTime = 0
  let fcotsTotal = 0

  // Start adherence: for non-first cases, how close to scheduled start
  const startDeltas: number[] = [] // minutes late (positive = late)

  for (const c of surgeonCases) {
    const key = `${c.scheduled_date}|${c.or_room_id}`
    const roomCases = casesByDateRoom[key] || []
    const isFirst = roomCases.length > 0 && roomCases[0].id === c.id

    // Get the relevant timestamp based on facility setting
    const actualStart = settings.fcots_milestone === 'incision'
      ? c.incision_at
      : c.patient_in_at

    if (!actualStart || !c.start_time) continue

    const scheduledMin = timeToMinutes(c.start_time)
    const actualMin = utcToLocalMinutes(actualStart, timezone)
    const deltaMin = actualMin - scheduledMin

    if (isFirst) {
      // FCOTS: compare actual milestone against the case's own scheduled start
      fcotsTotal++
      if (deltaMin <= settings.fcots_grace_minutes) {
        fcotsOnTime++
      }
    } else {
      // Non-first case: same delta calculation for adherence
      startDeltas.push(deltaMin)
    }
  }

  // FCOTS score (50% weight within this pillar)
  const fcotsRate = fcotsTotal > 0 ? (fcotsOnTime / fcotsTotal) * 100 : 50

  // Start adherence score (50% weight)
  // Median minutes late — lower is better
  let adherenceScore = 50
  if (startDeltas.length >= 3) {
    const surgeonMedianLate = median(startDeltas)

    // Get peer median-late values for percentile ranking
    const peerMedianLates = getPeerStartDeltas(allCases, settings, timezone)
    const pctile = percentileRank(surgeonMedianLate, peerMedianLates, true) // lower is better
    adherenceScore = clampScore(pctile)
  }

  // Blend: 50% FCOTS rate (as direct percentage), 50% adherence percentile
  const fcotsScore = clampScore(fcotsRate, 50, 100) // 50% on-time = floor, 100% = ceiling
  return Math.round(fcotsScore * 0.5 + adherenceScore * 0.5)
}

function getPeerStartDeltas(
  allCases: ScorecardCase[],
  settings: ScorecardSettings,
  timezone: string,
): number[] {
  const bySurgeon: Record<string, number[]> = {}

  for (const c of allCases) {
    if (!c.start_time) continue
    const actualStart = settings.fcots_milestone === 'incision' ? c.incision_at : c.patient_in_at
    if (!actualStart) continue

    const scheduledMin = timeToMinutes(c.start_time)
    const actualMin = utcToLocalMinutes(actualStart, timezone)
    const delta = actualMin - scheduledMin

    if (!bySurgeon[c.surgeon_id]) bySurgeon[c.surgeon_id] = []
    bySurgeon[c.surgeon_id].push(delta)
  }

  return Object.values(bySurgeon)
    .filter(ds => ds.length >= 3)
    .map(ds => median(ds))
}

// ─── PILLAR 5: SURGEON AVAILABILITY (15%) ─────────────────────
// Prep-to-incision excess gap + surgeon-attributable delay flag rate

const PREP_TO_INCISION_BASELINE_MINUTES = 7 // reasonable scrub + site marking time

function calculateAvailability(
  surgeonCases: ScorecardCase[],
  allCases: ScorecardCase[],
  flags: ScorecardFlag[],
): number {
  const surgeonId = surgeonCases[0]?.surgeon_id
  if (!surgeonId) return 50

  // 1. Prep-to-incision excess gaps (50% of this pillar)
  const surgeonExcessGaps = surgeonCases
    .map(c => {
      const gap = getPrepToIncision(c)
      if (gap === null) return null
      return Math.max(0, gap - PREP_TO_INCISION_BASELINE_MINUTES)
    })
    .filter((g): g is number => g !== null)

  let gapScore = 50
  if (surgeonExcessGaps.length >= 3) {
    const surgeonMedianExcess = median(surgeonExcessGaps)

    // Get peer median excess gaps
    const peerExcessGaps = getPeerExcessGaps(allCases)
    const pctile = percentileRank(surgeonMedianExcess, peerExcessGaps, true) // lower is better
    gapScore = clampScore(pctile)
  }

  // 2. Surgeon-attributable delay rate (50% of this pillar)
  const surgeonCaseIds = new Set(surgeonCases.map(c => c.id))
  const surgeonFlags = flags.filter(f =>
    surgeonCaseIds.has(f.case_id) && f.flag_type === 'delay'
  )
  const delayRate = surgeonCases.length > 0
    ? (surgeonFlags.length / surgeonCases.length) * 100
    : 0

  // Get peer delay rates
  const peerDelayRates = getPeerDelayRates(allCases, flags)
  const delayPctile = percentileRank(delayRate, peerDelayRates, true) // lower is better
  const delayScore = clampScore(delayPctile)

  return Math.round(gapScore * 0.5 + delayScore * 0.5)
}

function getPeerExcessGaps(allCases: ScorecardCase[]): number[] {
  const bySurgeon: Record<string, number[]> = {}
  for (const c of allCases) {
    const gap = getPrepToIncision(c)
    if (gap === null) continue
    const excess = Math.max(0, gap - PREP_TO_INCISION_BASELINE_MINUTES)
    if (!bySurgeon[c.surgeon_id]) bySurgeon[c.surgeon_id] = []
    bySurgeon[c.surgeon_id].push(excess)
  }
  return Object.values(bySurgeon)
    .filter(gs => gs.length >= 3)
    .map(gs => median(gs))
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

// ─── HELPER FUNCTIONS ─────────────────────────────────────────

function groupByProcedure(cases: ScorecardCase[]): Record<string, ScorecardCase[]> {
  const grouped: Record<string, ScorecardCase[]> = {}
  for (const c of cases) {
    if (!grouped[c.procedure_type_id]) grouped[c.procedure_type_id] = []
    grouped[c.procedure_type_id].push(c)
  }
  return grouped
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function detectFlipRoom(cases: ScorecardCase[]): boolean {
  // Group by date, check if multiple rooms used
  const byDate: Record<string, Set<string>> = {}
  for (const c of cases) {
    if (!byDate[c.scheduled_date]) byDate[c.scheduled_date] = new Set()
    byDate[c.scheduled_date].add(c.or_room_id)
  }
  return Object.values(byDate).some(rooms => rooms.size > 1)
}

// ─── MAIN CALCULATION ─────────────────────────────────────────

export function calculateORbitScores(input: ScorecardInput): ORbitScorecard[] {
  const { cases, financials, flags, settings, dateRange, timezone } = input

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
        consistency: calculateConsistency(surgeonCases, input.previousPeriodCases),
        profitability: calculateProfitability(surgeonCases, input.previousPeriodCases, prevFinMap),
        schedAccuracy: calculateScheduleAccuracy(surgeonCases, input.previousPeriodCases),
        onTime: calculateOnTimePerformance(surgeonCases, input.previousPeriodCases, settings, timezone),
        availability: calculateAvailability(surgeonCases, input.previousPeriodCases, input.previousPeriodFlags || flags),
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
      consistency: calculateConsistency(surgeonCases, cases),
      profitability: calculateProfitability(surgeonCases, cases, financialsMap),
      schedAccuracy: calculateScheduleAccuracy(surgeonCases, cases),
      onTime: calculateOnTimePerformance(surgeonCases, cases, settings, timezone),
      availability: calculateAvailability(surgeonCases, cases, flags),
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