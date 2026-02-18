// ============================================
// lib/analyticsV2.ts
// ============================================
// Enhanced analytics calculations for ORbit
// Supports all 8 Phase 1 KPIs with daily tracking
// ============================================

import type { Color } from '@tremor/react'

// ============================================
// TYPES
// ============================================

export interface CaseWithMilestones {
  id: string
  case_number: string
  facility_id: string
  scheduled_date: string
  start_time: string | null // Scheduled start time (e.g., "07:30:00")
  surgeon_id: string | null
  or_room_id: string | null
  status_id: string
  // Columns fetched directly from cases table
  surgeon_left_at?: string | null       // FIX: Source of truth for surgeon departure
  cancelled_at?: string | null          // FIX: Timestamp for same-day cancellation detection
  is_excluded_from_metrics?: boolean    // FIX: Exclusion flag for test/invalid cases
  surgeon?: { first_name: string; last_name: string } | null
  procedure_types?: { id: string; name: string } | null
  or_rooms?: { id: string; name: string } | null
  case_statuses?: { name: string } | null
  case_milestones: Array<{
    facility_milestone_id: string
    recorded_at: string
    facility_milestones?: { name: string } | null
  }>

}
export interface TurnoverBreakdown {
  standardTurnover: KPIResult    // Same room: Surgeon Done → Incision
  flipRoomTime: KPIResult        // Different room: Surgeon Done → Incision
  totalTransitions: number
  sameRoomCount: number
  flipRoomCount: number
}
export interface MilestoneMap {
  patient_in?: Date
  anes_start?: Date
  anes_end?: Date
  prep_drape_complete?: Date  // RENAMED from 'prepped'
  incision?: Date
  closing?: Date
  closing_complete?: Date
  surgeon_left?: Date 
  patient_out?: Date
  room_cleaned?: Date
}

export interface DailyTrackerData {
  date: string
  color: Color
  tooltip: string
  numericValue: number  // Raw value for sparkline rendering
}

export interface KPIResult {
  value: number
  displayValue: string
  subtitle: string
  target?: number
  targetMet?: boolean
  delta?: number
  deltaType?: 'increase' | 'decrease' | 'unchanged'
  dailyData?: DailyTrackerData[]
}

export interface FlipRoomAnalysis {
  surgeonId: string
  surgeonName: string
  date: string
  cases: Array<{
    caseId: string
    caseNumber: string
    roomId: string
    roomName: string
    scheduledStart: string
    patientIn?: Date
    patientOut?: Date
  }>
  idleGaps: Array<{
    fromCase: string
    toCase: string
    idleMinutes: number
    optimalCallDelta: number // How much earlier to call next patient
    gapType: 'flip' | 'same_room'  // Whether surgeon changed rooms
    fromRoom?: string               // Room name for context
    toRoom?: string
  }>
  avgIdleTime: number
  totalIdleTime: number
  isFlipRoom: boolean  // Whether this surgeon-day involved multiple rooms
}

// Per-room utilization breakdown
export interface RoomUtilizationDetail {
  roomId: string
  roomName: string
  utilization: number       // Percentage
  usedMinutes: number       // Total patient-in-room minutes
  availableHours: number    // Configured or default hours
  caseCount: number         // Cases in this room for the period
  daysActive: number        // Number of days this room was used
  usingRealHours: boolean   // true = from or_rooms.available_hours, false = default
}

// Extended OR Utilization result with room breakdown
export interface ORUtilizationResult extends KPIResult {
  roomBreakdown: RoomUtilizationDetail[]
  roomsWithRealHours: number
  roomsWithDefaultHours: number
}

export interface SurgeonProfile {
  id: string
  closing_workflow: 'surgeon_closes' | 'pa_closes'
  closing_handoff_minutes: number
}

export interface CaseWithMilestonesAndSurgeon extends CaseWithMilestones {
  surgeon_profile?: SurgeonProfile | null
}

// NEW: FCOTS configuration
export interface FCOTSConfig {
  milestone: 'patient_in' | 'incision'  // Which milestone defines "start"
  graceMinutes: number                   // Allowed buffer (default 2)
  targetPercent: number                  // Target on-time % (default 85)
}

// NEW: Room available hours map
export interface RoomHoursMap {
  [roomId: string]: number  // room_id → available_hours
}

// ============================================
// FACILITY ANALYTICS CONFIG
// ============================================

/**
 * Unified config for all facility-level KPI targets.
 * Fetched from facility_analytics_settings + facilities.or_hourly_rate.
 * All analytics consumers should use this instead of hard-coded values.
 */
export interface FacilityAnalyticsConfig {
  // FCOTS
  fcotsMilestone: 'patient_in' | 'incision'
  fcotsGraceMinutes: number
  fcotsTargetPercent: number
  // Surgical Turnovers
  sameRoomTurnoverTarget: number       // minutes (default 45)
  flipRoomTurnoverTarget: number       // minutes (default 15)
  turnoverThresholdMinutes: number     // room turnover compliance threshold (default 30)
  turnoverComplianceTarget: number     // percent (default 80)
  // OR Utilization
  utilizationTargetPercent: number     // percent (default 75)
  // Cancellations
  cancellationTargetPercent: number    // percent (default 5)
  // Surgeon Idle Time
  idleCombinedTargetMinutes: number    // minutes (default 10)
  idleFlipTargetMinutes: number        // minutes (default 5)
  idleSameRoomTargetMinutes: number    // minutes (default 10)
  // Tardiness & Non-Operative Time
  tardinessTargetMinutes: number       // minutes (default 45)
  nonOpWarnMinutes: number             // minutes (default 20)
  nonOpBadMinutes: number              // minutes (default 30)
  // Operational
  operatingDaysPerYear: number         // days (default 250)
  // Revenue (from facilities table, not facility_analytics_settings)
  orHourlyRate: number | null          // $/hr (from facilities.or_hourly_rate)
}

/** Default values for all analytics config fields */
export const ANALYTICS_CONFIG_DEFAULTS: FacilityAnalyticsConfig = {
  fcotsMilestone: 'patient_in',
  fcotsGraceMinutes: 2,
  fcotsTargetPercent: 85,
  sameRoomTurnoverTarget: 45,
  flipRoomTurnoverTarget: 15,
  turnoverThresholdMinutes: 30,
  turnoverComplianceTarget: 80,
  utilizationTargetPercent: 75,
  cancellationTargetPercent: 5,
  idleCombinedTargetMinutes: 10,
  idleFlipTargetMinutes: 5,
  idleSameRoomTargetMinutes: 10,
  tardinessTargetMinutes: 45,
  nonOpWarnMinutes: 20,
  nonOpBadMinutes: 30,
  operatingDaysPerYear: 250,
  orHourlyRate: null,
}

// Per-transition detail for room turnovers
export interface TurnoverDetail {
  date: string
  roomName: string
  fromCaseNumber: string
  toCaseNumber: string
  fromSurgeonName: string
  toSurgeonName: string
  turnoverMinutes: number
  isCompliant: boolean // under threshold
}

// Extended turnover result with detail data
export interface TurnoverResult extends KPIResult {
  details: TurnoverDetail[]
  compliantCount: number
  nonCompliantCount: number
  complianceRate: number
}

// Per-case cancellation detail
export interface CancellationDetail {
  caseId: string
  caseNumber: string
  date: string
  roomName: string
  surgeonName: string
  scheduledStart: string
  cancellationType: 'same_day' | 'prior_day' | 'other'
}

// Same-day cancellation result
export interface CancellationResult extends KPIResult {
  sameDayCount: number
  sameDayRate: number
  totalCancelledCount: number
  details: CancellationDetail[]
}


export interface FCOTSDetail {
  caseId: string
  caseNumber: string
  scheduledDate: string
  roomName: string
  surgeonName: string
  scheduledStart: string
  actualStart: string
  delayMinutes: number
  isOnTime: boolean
}

export interface FCOTSResult extends KPIResult {
  firstCaseDetails: FCOTSDetail[]
}

export interface CaseVolumeResult extends KPIResult {
  weeklyVolume: Array<{ week: string; count: number }>
}

export interface AnalyticsOverview {
  // Volume
  totalCases: number
  completedCases: number
  cancelledCases: number
  
  // KPIs
  fcots: FCOTSResult
  turnoverTime: TurnoverResult
  orUtilization: ORUtilizationResult
  caseVolume: CaseVolumeResult
  cancellationRate: CancellationResult
  cumulativeTardiness: KPIResult
  nonOperativeTime: KPIResult
  surgeonIdleTime: KPIResult       // Combined idle time
  surgeonIdleFlip: KPIResult       // Flip room idle only
  surgeonIdleSameRoom: KPIResult   // Same room idle only
  
  // Flip room details
  standardSurgicalTurnover: KPIResult   // Same room turnover
  flipRoomTime: KPIResult               // Different room turnover
  flipRoomAnalysis: FlipRoomAnalysis[]  // Detailed idle data for modal
  surgeonIdleSummaries: SurgeonIdleSummary[]  // Per-surgeon aggregated summaries

  // Time breakdown
  avgTotalCaseTime: number
  avgSurgicalTime: number
  avgPreOpTime: number
  avgAnesthesiaTime: number
  avgClosingTime: number
  avgEmergenceTime: number
}
// ============================================
// STATUS UTILITY
// ============================================

/**
 * 3-tier KPI status based on value vs target.
 * Returns 'good' if at or above target, 'warn' if ≥70%, 'bad' otherwise.
 * For inverse metrics (lower is better), pass inverse=true.
 */
export function getKPIStatus(
  value: number,
  target: number,
  inverse: boolean = false
): 'good' | 'warn' | 'bad' {
  const ratio = inverse
    ? target / Math.max(value, 0.01)
    : value / Math.max(target, 0.01)
  if (ratio >= 1) return 'good'
  if (ratio >= 0.7) return 'warn'
  return 'bad'
}

// ============================================
// TARGET-RELATIVE COLOR UTILITY
// ============================================

/**
 * Target-relative color for daily tracker sparklines.
 * - "Lower is better" (turnovers, idle, tardiness, non-op):
 *   green ≤ target, yellow ≤ target × 1.2, red > target × 1.2
 * - "Higher is better" (FCOTS, utilization):
 *   green ≥ target, yellow ≥ target × 0.8, red < target × 0.8
 */
function getTargetRelativeColor(value: number, target: number, lowerIsBetter: boolean): Color {
  if (lowerIsBetter) {
    if (value <= target) return 'green'
    if (value <= target * 1.2) return 'yellow'
    return 'red'
  } else {
    if (value >= target) return 'green'
    if (value >= target * 0.8) return 'yellow'
    return 'red'
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert case milestones array to a map for easy access
 */
export function getMilestoneMap(caseData: CaseWithMilestones): MilestoneMap {
  const map: MilestoneMap = {}
  
  caseData.case_milestones.forEach(m => {
    const name = m.facility_milestones?.name
    if (name && m.recorded_at) {
      const date = new Date(m.recorded_at)
      switch (name) {
        case 'patient_in': map.patient_in = date; break
        case 'anes_start': map.anes_start = date; break
        case 'anes_end': map.anes_end = date; break
        // FIX: Updated from 'prepped' to 'prep_drape_complete'
        case 'prep_drape_complete': map.prep_drape_complete = date; break
        case 'incision': map.incision = date; break
        case 'closing': map.closing = date; break
        case 'closing_complete': map.closing_complete = date; break
        case 'surgeon_left': map.surgeon_left = date; break
        case 'patient_out': map.patient_out = date; break
        case 'room_cleaned': map.room_cleaned = date; break
      }
    }
  })
  
  // FIX: Inject surgeon_left_at from cases table column.
  // The "Surgeon Left" button writes to cases.surgeon_left_at, NOT case_milestones.
  // This is the primary source of truth for when the surgeon left the room.
  if (caseData.surgeon_left_at && !map.surgeon_left) {
    map.surgeon_left = new Date(caseData.surgeon_left_at)
  }
  
  return map
}

/**
 * Get time difference in seconds between two dates
 */
export function getTimeDiffSeconds(start?: Date, end?: Date): number | null {
  if (!start || !end) return null
  return (end.getTime() - start.getTime()) / 1000
}

/**
 * Get time difference in minutes between two dates
 */
export function getTimeDiffMinutes(start?: Date, end?: Date): number | null {
  const seconds = getTimeDiffSeconds(start, end)
  return seconds !== null ? seconds / 60 : null
}

/**
 * Format seconds to HH:MM:SS
 */
export function formatSecondsToHHMMSS(seconds: number | null): string {
  if (seconds === null || isNaN(seconds)) return '--:--'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format minutes to human readable
 */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null || isNaN(minutes)) return '--'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const hrs = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
}
/**
 * Format seconds to human readable (e.g., "1h 23m 45s")
 */
export function formatSecondsHuman(totalSeconds: number | null): string {
  if (totalSeconds === null) return '-'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.round(totalSeconds % 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

/**
 * Format time from timestamp to display time (e.g., "06:06 am")
 */
export function formatTimeFromTimestamp(timestamp: string | Date | null): string {
  if (!timestamp) return '--:-- --'
  
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  const hours = date.getHours()
  const minutes = date.getMinutes()
  
  const ampm = hours >= 12 ? 'pm' : 'am'
  const displayHour = hours % 12 || 12
  return `${displayHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`
}

/**
 * Alias for formatSecondsToHHMMSS (v1 compatibility)
 * Note: Despite the name, this expects SECONDS
 */
export function formatMinutesToHHMMSS(seconds: number | null): string {
  return formatSecondsToHHMMSS(seconds)
}

/**
 * Alias for formatSecondsToHHMMSS (v1 compatibility)
 */
export function formatDurationHHMMSS(totalSeconds: number | null): string {
  return formatSecondsToHHMMSS(totalSeconds)
}
/**
 * Calculate average of numbers, ignoring nulls
 */
export function calculateAverage(values: (number | null)[]): number {
  const valid = values.filter((v): v is number => v !== null && !isNaN(v))
  if (valid.length === 0) return 0
  return valid.reduce((a, b) => a + b, 0) / valid.length
}
/**
 * Calculate sum of numbers, ignoring nulls
 */
export function calculateSum(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && !isNaN(v))
  if (valid.length === 0) return null
  return valid.reduce((a, b) => a + b, 0)
}

/**
 * Calculate standard deviation
 */
export function calculateStdDev(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && !isNaN(v))
  if (valid.length < 2) return null
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length
  const squareDiffs = valid.map(n => Math.pow(n - avg, 2))
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / valid.length
  return Math.round(Math.sqrt(avgSquareDiff))
}

/**
 * Calculate median of numbers
 */
export function calculateMedian(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && !isNaN(v)).sort((a, b) => a - b)
  if (valid.length === 0) return null
  const mid = Math.floor(valid.length / 2)
  return valid.length % 2 !== 0
    ? valid[mid]
    : Math.round((valid[mid - 1] + valid[mid]) / 2)
}

/**
 * Calculate percentage change between current and baseline
 * Returns positive if current is lower (improved), negative if higher
 */
export function calculatePercentageChange(current: number | null, baseline: number | null): number | null {
  if (current === null || baseline === null || baseline === 0) return null
  return Math.round(((baseline - current) / baseline) * 100)
}
export function getSurgeonDoneTime(
  milestones: MilestoneMap,
  surgeonProfile?: SurgeonProfile | null
): Date | null {
  // Priority 1: If surgeon_left milestone was recorded, always use it
  if (milestones.surgeon_left) {
    return milestones.surgeon_left
  }

  // Priority 2: Use surgeon profile settings
  if (!surgeonProfile || surgeonProfile.closing_workflow === 'surgeon_closes') {
    // Surgeon closes entirely - use closing_complete (or closing as fallback)
    return milestones.closing_complete || milestones.closing || null
  }

  // PA closes - calculate from closing_start + handoff minutes
  if (milestones.closing) {
    const handoffMs = (surgeonProfile.closing_handoff_minutes || 0) * 60 * 1000
    return new Date(milestones.closing.getTime() + handoffMs)
  }

  return null
}
// ============================================
// PHASE DURATION FUNCTIONS (SECONDS)
// These return durations in SECONDS for v1 compatibility
// ============================================

/**
 * Total OR Time: patient_in -> patient_out (returns seconds)
 */
export function getTotalORTime(milestones: MilestoneMap): number | null {
  return getTimeDiffSeconds(milestones.patient_in, milestones.patient_out)
}

/**
 * Surgical Time: incision -> closing (returns seconds)
 */
export function getSurgicalTime(milestones: MilestoneMap): number | null {
  return getTimeDiffSeconds(milestones.incision, milestones.closing)
}

/**
 * Wheels-in to Incision: patient_in -> incision (returns seconds)
 */
export function getWheelsInToIncision(milestones: MilestoneMap): number | null {
  return getTimeDiffSeconds(milestones.patient_in, milestones.incision)
}

/**
 * Incision to Closing: incision -> closing (returns seconds)
 */
export function getIncisionToClosing(milestones: MilestoneMap): number | null {
  return getTimeDiffSeconds(milestones.incision, milestones.closing)
}

/**
 * Closing Time: closing -> closing_complete (returns seconds)
 */
export function getClosingTime(milestones: MilestoneMap): number | null {
  return getTimeDiffSeconds(milestones.closing, milestones.closing_complete)
}

/**
 * Closed to Wheels-Out: closing_complete -> patient_out (returns seconds)
 */
export function getClosedToWheelsOut(milestones: MilestoneMap): number | null {
  return getTimeDiffSeconds(milestones.closing_complete, milestones.patient_out)
}

/**
 * Anesthesia Time: anes_start -> anes_end (returns seconds)
 */
export function getAnesthesiaTime(milestones: MilestoneMap): number | null {
  return getTimeDiffSeconds(milestones.anes_start, milestones.anes_end)
}

/**
 * Pre-Op Time: patient_in -> incision (returns seconds)
 * Alias for getWheelsInToIncision
 */
export function getPreOpTime(milestones: MilestoneMap): number | null {
  return getTimeDiffSeconds(milestones.patient_in, milestones.incision)
}

/**
 * Room Turnover Time: patient_out -> room_cleaned (returns seconds)
 */
export function getRoomTurnoverTime(milestones: MilestoneMap): number | null {
  return getTimeDiffSeconds(milestones.patient_out, milestones.room_cleaned)
}

/**
 * Total Case Time - alias for getTotalORTime (v1 compatibility)
 */
export function getTotalCaseTime(milestones: MilestoneMap): number | null {
  return getTotalORTime(milestones)
}

/**
 * Get duration between any two milestones (returns seconds)
 */
export function getMilestoneDuration(
  milestones: MilestoneMap,
  startMilestone: keyof MilestoneMap,
  endMilestone: keyof MilestoneMap
): number | null {
  return getTimeDiffSeconds(milestones[startMilestone], milestones[endMilestone])
}

/**
 * Parse scheduled start time and date into a Date object
 * FIXED: Creates date in local time to avoid timezone issues
 */
export function parseScheduledDateTime(date: string, time: string | null): Date | null {
  if (!time) return null
  try {
    const [hours, minutes] = time.split(':').map(Number)
    const [year, month, day] = date.split('-').map(Number)
    // Create date directly in local time (month is 0-indexed)
    return new Date(year, month - 1, day, hours, minutes, 0, 0)
  } catch {
    return null
  }
}

/**
 * Group cases by date
 */
export function groupCasesByDate(cases: CaseWithMilestones[]): Map<string, CaseWithMilestones[]> {
  const grouped = new Map<string, CaseWithMilestones[]>()
  cases.forEach(c => {
    const existing = grouped.get(c.scheduled_date) || []
    existing.push(c)
    grouped.set(c.scheduled_date, existing)
  })
  return grouped
}

/**
 * Get unique dates in range for tracker
 */
export function getDateRange(startDate: Date, endDate: Date): string[] {
  const dates: string[] = []
  const current = new Date(startDate)
  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  return dates
}

/**
 * Calculate delta between current and previous values
 * Returns { delta, deltaType } for trend display
 */
function calculateDelta(
  current: number, 
  previous: number | undefined,
  lowerIsBetter: boolean = false
): { delta?: number; deltaType?: 'increase' | 'decrease' | 'unchanged' } {
  if (previous === undefined || previous === 0) {
    return {}
  }
  
  const rawDelta = Math.round(((current - previous) / previous) * 100)
  const delta = Math.abs(rawDelta)
  
  let deltaType: 'increase' | 'decrease' | 'unchanged'
  if (rawDelta > 0) {
    deltaType = lowerIsBetter ? 'decrease' : 'increase' // If lower is better, increase is bad
  } else if (rawDelta < 0) {
    deltaType = lowerIsBetter ? 'increase' : 'decrease' // If lower is better, decrease is good
  } else {
    deltaType = 'unchanged'
  }
  
  return { delta, deltaType }
}
// ============================================
// CASE FILTERING
// ============================================

/**
 * Filter out cases that should not be included in metrics.
 * Removes: excluded cases, test cases flagged by admins.
 */
export function filterActiveCases(cases: CaseWithMilestones[]): CaseWithMilestones[] {
  return cases.filter(c => !c.is_excluded_from_metrics)
}

/**
 * Check if a cancellation was same-day (cancelled_at local date matches scheduled_date).
 * Uses cancelled_at timestamp if available, falls back to status check.
 * 
 * FIXED: Uses local date components instead of toISOString() (which converts to UTC
 * and can shift the date at timezone boundaries, e.g. 11pm EST → next day UTC).
 */
function isSameDayCancellation(c: CaseWithMilestones): boolean {
  if (c.cancelled_at) {
    const d = new Date(c.cancelled_at)
    const cancelDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return cancelDate === c.scheduled_date
  }
  // Fallback: if no cancelled_at, treat any cancelled case as potentially same-day
  return c.case_statuses?.name === 'cancelled'
}

// ============================================
// NEW: Calculate Both Turnover Types
// ============================================

/**
 * Calculate Surgical Turnover split by same room vs different room
 * 
 * For each surgeon's consecutive cases on the same day:
 * - Same Room: Standard Surgical Turnover (room cleanup + next case prep)
 * - Different Room: Flip Room Time (surgeon walking between prepared rooms)
 * 
 * Uses getSurgeonDoneTime() to respect workflow preferences.
 */
export function calculateSurgicalTurnovers(
  cases: CaseWithMilestonesAndSurgeon[],
  previousPeriodCases?: CaseWithMilestonesAndSurgeon[],
  config?: { sameRoomTurnoverTarget?: number; flipRoomTurnoverTarget?: number }
): TurnoverBreakdown {
  const sameRoomTurnovers: number[] = []
  const flipRoomTurnovers: number[] = []
  
  const sameRoomDaily = new Map<string, number[]>()
  const flipRoomDaily = new Map<string, number[]>()

  // Group cases by surgeon and date
  const bySurgeonDate = new Map<string, CaseWithMilestonesAndSurgeon[]>()
  cases.forEach(c => {
    if (!c.surgeon_id) return
    const key = `${c.surgeon_id}|${c.scheduled_date}`
    const existing = bySurgeonDate.get(key) || []
    existing.push(c)
    bySurgeonDate.set(key, existing)
  })

  // Calculate turnovers for each surgeon's day
  bySurgeonDate.forEach((surgeonCases, key) => {
    const date = key.split('|')[1]
    
    // Sort by incision time (or start_time as fallback)
    const sorted = surgeonCases
      .filter(c => {
        const m = getMilestoneMap(c)
        return m.incision // Must have incision to calculate
      })
      .sort((a, b) => {
        const aIncision = getMilestoneMap(a).incision?.getTime() || 0
        const bIncision = getMilestoneMap(b).incision?.getTime() || 0
        return aIncision - bIncision
      })

    // Calculate turnover between consecutive cases
    for (let i = 0; i < sorted.length - 1; i++) {
      const currentCase = sorted[i]
      const nextCase = sorted[i + 1]

      const currentMilestones = getMilestoneMap(currentCase)
      const nextMilestones = getMilestoneMap(nextCase)

      // Get when surgeon finished current case
      const surgeonDone = getSurgeonDoneTime(
        currentMilestones,
        currentCase.surgeon_profile
      )

      // Get when surgeon started next case (incision)
      const nextIncision = nextMilestones.incision

      if (!surgeonDone || !nextIncision) continue

      const turnoverMinutes = getTimeDiffMinutes(surgeonDone, nextIncision)

      // Filter out unreasonable values
      // Can be negative if overlapping (surgeon started before "done") - treat as 0
      // Filter out values > 180 min (3 hours) as likely lunch break or scheduling gap
      if (turnoverMinutes === null) continue
      if (turnoverMinutes > 180) continue // Probably a gap, not turnover

      const effectiveTurnover = Math.max(0, turnoverMinutes)

      // Categorize by same room vs different room
      const sameRoom = currentCase.or_room_id === nextCase.or_room_id

      if (sameRoom) {
        sameRoomTurnovers.push(effectiveTurnover)
        const dayData = sameRoomDaily.get(date) || []
        dayData.push(effectiveTurnover)
        sameRoomDaily.set(date, dayData)
      } else {
        flipRoomTurnovers.push(effectiveTurnover)
        const dayData = flipRoomDaily.get(date) || []
        dayData.push(effectiveTurnover)
        flipRoomDaily.set(date, dayData)
      }
    }
  })

  // Calculate medians
  const medianSameRoom = calculateMedian(sameRoomTurnovers) ?? 0
  const medianFlipRoom = calculateMedian(flipRoomTurnovers) ?? 0

  // Calculate previous period for deltas
  let prevMedianSameRoom: number | undefined
  let prevMedianFlipRoom: number | undefined

  if (previousPeriodCases && previousPeriodCases.length > 0) {
    const prevSameRoom: number[] = []
    const prevFlipRoom: number[] = []

    const prevBySurgeonDate = new Map<string, CaseWithMilestonesAndSurgeon[]>()
    previousPeriodCases.forEach(c => {
      if (!c.surgeon_id) return
      const key = `${c.surgeon_id}|${c.scheduled_date}`
      const existing = prevBySurgeonDate.get(key) || []
      existing.push(c)
      prevBySurgeonDate.set(key, existing)
    })

    prevBySurgeonDate.forEach((surgeonCases) => {
      const sorted = surgeonCases
        .filter(c => getMilestoneMap(c).incision)
        .sort((a, b) => {
          const aInc = getMilestoneMap(a).incision?.getTime() || 0
          const bInc = getMilestoneMap(b).incision?.getTime() || 0
          return aInc - bInc
        })

      for (let i = 0; i < sorted.length - 1; i++) {
        const currentCase = sorted[i]
        const nextCase = sorted[i + 1]
        const currentMilestones = getMilestoneMap(currentCase)
        const nextMilestones = getMilestoneMap(nextCase)

        const surgeonDone = getSurgeonDoneTime(currentMilestones, currentCase.surgeon_profile)
        const nextIncision = nextMilestones.incision

        if (!surgeonDone || !nextIncision) continue

        const turnoverMinutes = getTimeDiffMinutes(surgeonDone, nextIncision)
        if (turnoverMinutes === null || turnoverMinutes > 180) continue

        const effectiveTurnover = Math.max(0, turnoverMinutes)
        const sameRoom = currentCase.or_room_id === nextCase.or_room_id

        if (sameRoom) {
          prevSameRoom.push(effectiveTurnover)
        } else {
          prevFlipRoom.push(effectiveTurnover)
        }
      }
    })

    if (prevSameRoom.length > 0) prevMedianSameRoom = calculateMedian(prevSameRoom) ?? undefined
    if (prevFlipRoom.length > 0) prevMedianFlipRoom = calculateMedian(prevFlipRoom) ?? undefined
  }

  // Build KPI results
  const sameRoomDelta = calculateDelta(medianSameRoom, prevMedianSameRoom, true)
  const flipRoomDelta = calculateDelta(medianFlipRoom, prevMedianFlipRoom, true)

  // Target compliance (configurable)
  const sameRoomTarget = config?.sameRoomTurnoverTarget ?? ANALYTICS_CONFIG_DEFAULTS.sameRoomTurnoverTarget
  const flipRoomTarget = config?.flipRoomTurnoverTarget ?? ANALYTICS_CONFIG_DEFAULTS.flipRoomTurnoverTarget

  const sameRoomMetTarget = sameRoomTurnovers.filter(t => t <= sameRoomTarget).length
  const sameRoomCompliance = sameRoomTurnovers.length > 0 
    ? Math.round((sameRoomMetTarget / sameRoomTurnovers.length) * 100)
    : 0

  const flipRoomMetTarget = flipRoomTurnovers.filter(t => t <= flipRoomTarget).length
  const flipRoomCompliance = flipRoomTurnovers.length > 0
    ? Math.round((flipRoomMetTarget / flipRoomTurnovers.length) * 100)
    : 0

  // Build daily tracker data for same room (target-relative colors)
  const sameRoomDailyData: DailyTrackerData[] = Array.from(sameRoomDaily.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, turnovers]) => {
      const dayMedian = calculateMedian(turnovers) ?? 0
      return {
        date,
        color: getTargetRelativeColor(dayMedian, sameRoomTarget, true),
        tooltip: `${date}: ${Math.round(dayMedian)} min median (${turnovers.length} turnovers)`,
        numericValue: dayMedian
      }
    })

  // Build daily tracker data for flip room (target-relative colors)
  const flipRoomDailyData: DailyTrackerData[] = Array.from(flipRoomDaily.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, turnovers]) => {
      const dayMedian = calculateMedian(turnovers) ?? 0
      return {
        date,
        color: getTargetRelativeColor(dayMedian, flipRoomTarget, true),
        tooltip: `${date}: ${Math.round(dayMedian)} min median (${turnovers.length} flips)`,
        numericValue: dayMedian
      }
    })

  return {
    standardTurnover: {
      value: Math.round(medianSameRoom),
      displayValue: sameRoomTurnovers.length > 0 ? `${Math.round(medianSameRoom)} min` : '--',
      subtitle: sameRoomTurnovers.length > 0
        ? `${sameRoomCompliance}% ≤${sameRoomTarget} min · ${sameRoomTurnovers.length} turnovers`
        : 'No same-room turnovers',
      target: sameRoomTarget,
      targetMet: medianSameRoom <= sameRoomTarget,
      ...sameRoomDelta,
      dailyData: sameRoomDailyData
    },
    flipRoomTime: {
      value: Math.round(medianFlipRoom),
      displayValue: flipRoomTurnovers.length > 0 ? `${Math.round(medianFlipRoom)} min` : '--',
      subtitle: flipRoomTurnovers.length > 0
        ? `${flipRoomCompliance}% ≤${flipRoomTarget} min · ${flipRoomTurnovers.length} flips`
        : 'No flip room data',
      target: flipRoomTarget,
      targetMet: medianFlipRoom <= flipRoomTarget,
      ...flipRoomDelta,
      dailyData: flipRoomDailyData
    },
    totalTransitions: sameRoomTurnovers.length + flipRoomTurnovers.length,
    sameRoomCount: sameRoomTurnovers.length,
    flipRoomCount: flipRoomTurnovers.length
  }
}
// ============================================
// METRIC CALCULATIONS
// ============================================

/**
 * 1. FCOTS - First Case On-Time Start
 * 
 * Configurable:
 * - milestone: Which milestone defines "start" (patient_in or incision)
 * - graceMinutes: Allowed buffer before counted as late (default 2)
 * - targetPercent: Target on-time % (default 85)
 */
export function calculateFCOTS(
  cases: CaseWithMilestones[],
  previousPeriodCases?: CaseWithMilestones[],
  config?: FCOTSConfig
): FCOTSResult {
  const milestone = config?.milestone || 'patient_in'
  const grace = config?.graceMinutes ?? 2
  const targetPercent = config?.targetPercent ?? 85

  const casesByDateRoom = new Map<string, CaseWithMilestones>()

  // Find first case per room per day
  cases.forEach(c => {
    if (!c.or_room_id || !c.start_time) return
    const key = `${c.scheduled_date}|${c.or_room_id}`
    const existing = casesByDateRoom.get(key)

    if (!existing || (c.start_time < (existing.start_time || ''))) {
      casesByDateRoom.set(key, c)
    }
  })

  const firstCases = Array.from(casesByDateRoom.values())
  let onTimeCount = 0
  let lateCount = 0
  const dailyResults = new Map<string, { onTime: number; late: number }>()
  const firstCaseDetails: FCOTSDetail[] = []

  firstCases.forEach(c => {
    const milestones = getMilestoneMap(c)
    const scheduled = parseScheduledDateTime(c.scheduled_date, c.start_time)
    // Use configured milestone for "actual start"
    const actual = milestone === 'incision' ? milestones.incision : milestones.patient_in

    if (!scheduled || !actual) return

    const delayMinutes = getTimeDiffMinutes(scheduled, actual) || 0
    const isOnTime = delayMinutes <= grace

    if (isOnTime) {
      onTimeCount++
    } else {
      lateCount++
    }

    // Collect per-case detail for drill-through
    const surgeonName = c.surgeon
      ? `Dr. ${c.surgeon.last_name}`
      : 'Unknown'
    const scheduledTime = c.start_time
      ? c.start_time.substring(0, 5) // "07:30:00" → "07:30"
      : '--'
    const actualTime = actual
      ? `${String(actual.getHours()).padStart(2, '0')}:${String(actual.getMinutes()).padStart(2, '0')}`
      : '--'

    firstCaseDetails.push({
      caseId: c.id,
      caseNumber: c.case_number,
      scheduledDate: c.scheduled_date,
      roomName: c.or_rooms?.name || 'Unknown',
      surgeonName,
      scheduledStart: scheduledTime,
      actualStart: actualTime,
      delayMinutes: Math.max(0, delayMinutes),
      isOnTime
    })

    // Track daily
    const dayData = dailyResults.get(c.scheduled_date) || { onTime: 0, late: 0 }
    if (isOnTime) dayData.onTime++
    else dayData.late++
    dailyResults.set(c.scheduled_date, dayData)
  })
  
  const total = onTimeCount + lateCount
  const rate = total > 0 ? Math.round((onTimeCount / total) * 100) : 0
  
  // Calculate previous period rate for delta
  let previousRate: number | undefined
  if (previousPeriodCases && previousPeriodCases.length > 0) {
    const prevByDateRoom = new Map<string, CaseWithMilestones>()
    previousPeriodCases.forEach(c => {
      if (!c.or_room_id || !c.start_time) return
      const key = `${c.scheduled_date}|${c.or_room_id}`
      const existing = prevByDateRoom.get(key)
      if (!existing || (c.start_time < (existing.start_time || ''))) {
        prevByDateRoom.set(key, c)
      }
    })
    
    let prevOnTime = 0
    let prevTotal = 0
    Array.from(prevByDateRoom.values()).forEach(c => {
      const milestones = getMilestoneMap(c)
      const scheduled = parseScheduledDateTime(c.scheduled_date, c.start_time)
      const actual = milestone === 'incision' ? milestones.incision : milestones.patient_in
      if (!scheduled || !actual) return
      prevTotal++
      const delayMinutes = getTimeDiffMinutes(scheduled, actual) || 0
      if (delayMinutes <= grace) prevOnTime++
    })
    
    if (prevTotal > 0) {
      previousRate = Math.round((prevOnTime / prevTotal) * 100)
    }
  }
  
  const { delta, deltaType } = calculateDelta(rate, previousRate)
  
  // Build daily tracker data
  const dailyData: DailyTrackerData[] = Array.from(dailyResults.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30) // Last 30 days
    .map(([date, data]) => {
      const dayRate = data.onTime + data.late > 0
        ? (data.onTime / (data.onTime + data.late)) * 100
        : 100
      return {
        date,
        color: getTargetRelativeColor(dayRate, targetPercent, false),
        tooltip: `${date}: ${data.onTime}/${data.onTime + data.late} on-time`,
        numericValue: dayRate
      }
    })
  
  const milestoneLabel = milestone === 'incision' ? 'incision' : 'wheels-in'
  
  return {
    value: rate,
    displayValue: `${rate}%`,
    subtitle: `${lateCount} late of ${total} first cases (${milestoneLabel}, ${grace} min grace)`,
    target: targetPercent,
    targetMet: rate >= targetPercent,
    delta,
    deltaType,
    dailyData,
    firstCaseDetails: firstCaseDetails.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
  }
}

/**
 * 2. Turnover Time
 * Time from patient_out of one case to patient_in of the next case in same room
 */
export function calculateTurnoverTime(
  cases: CaseWithMilestones[],
  previousPeriodCases?: CaseWithMilestones[],
  config?: { turnoverThresholdMinutes?: number; turnoverComplianceTarget?: number }
): TurnoverResult {
  const turnovers: number[] = []
  const turnoverDetails: TurnoverDetail[] = []
  const dailyResults = new Map<string, number[]>()

  const thresholdMinutes = config?.turnoverThresholdMinutes ?? ANALYTICS_CONFIG_DEFAULTS.turnoverThresholdMinutes

  // Group by room and date, sort by time
  const byRoomDate = new Map<string, CaseWithMilestones[]>()
  cases.forEach(c => {
    if (!c.or_room_id) return
    const key = `${c.scheduled_date}|${c.or_room_id}`
    const existing = byRoomDate.get(key) || []
    existing.push(c)
    byRoomDate.set(key, existing)
  })

  // Calculate turnovers between consecutive cases
  byRoomDate.forEach((roomCases, key) => {
    const date = key.split('|')[0]
    const sorted = roomCases.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = getMilestoneMap(sorted[i])
      const next = getMilestoneMap(sorted[i + 1])

      if (current.patient_out && next.patient_in) {
        const turnoverMinutes = getTimeDiffMinutes(current.patient_out, next.patient_in)
        if (turnoverMinutes !== null && turnoverMinutes > 0 && turnoverMinutes < 180) {
          turnovers.push(turnoverMinutes)

          const dayTurnovers = dailyResults.get(date) || []
          dayTurnovers.push(turnoverMinutes)
          dailyResults.set(date, dayTurnovers)

          // Build per-transition detail
          const fromSurgeon = sorted[i].surgeon
          const toSurgeon = sorted[i + 1].surgeon
          turnoverDetails.push({
            date,
            roomName: sorted[i].or_rooms?.name || 'Unknown',
            fromCaseNumber: sorted[i].case_number,
            toCaseNumber: sorted[i + 1].case_number,
            fromSurgeonName: fromSurgeon ? `${fromSurgeon.first_name} ${fromSurgeon.last_name}` : 'Unknown',
            toSurgeonName: toSurgeon ? `${toSurgeon.first_name} ${toSurgeon.last_name}` : 'Unknown',
            turnoverMinutes: Math.round(turnoverMinutes),
            isCompliant: turnoverMinutes <= thresholdMinutes,
          })
        }
      }
    }
  })

  const complianceTarget = config?.turnoverComplianceTarget ?? ANALYTICS_CONFIG_DEFAULTS.turnoverComplianceTarget

  const medianTurnover = calculateMedian(turnovers) ?? 0
  const metTarget = turnovers.filter(t => t <= thresholdMinutes).length
  const complianceRate = turnovers.length > 0 ? Math.round((metTarget / turnovers.length) * 100) : 0
  
  // Calculate previous period median for delta
  let previousMedian: number | undefined
  if (previousPeriodCases && previousPeriodCases.length > 0) {
    const prevTurnovers: number[] = []
    const prevByRoomDate = new Map<string, CaseWithMilestones[]>()
    previousPeriodCases.forEach(c => {
      if (!c.or_room_id) return
      const key = `${c.scheduled_date}|${c.or_room_id}`
      const existing = prevByRoomDate.get(key) || []
      existing.push(c)
      prevByRoomDate.set(key, existing)
    })
    
    prevByRoomDate.forEach((roomCases) => {
      const sorted = roomCases.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = getMilestoneMap(sorted[i])
        const next = getMilestoneMap(sorted[i + 1])
        if (current.patient_out && next.patient_in) {
          const turnoverMinutes = getTimeDiffMinutes(current.patient_out, next.patient_in)
          if (turnoverMinutes !== null && turnoverMinutes > 0 && turnoverMinutes < 180) {
            prevTurnovers.push(turnoverMinutes)
          }
        }
      }
    })
    
    if (prevTurnovers.length > 0) {
      previousMedian = calculateMedian(prevTurnovers) ?? undefined
    }
  }
  

  
  // For turnover, lower is better
  const { delta, deltaType } = calculateDelta(medianTurnover, previousMedian, true)
  
  // Build daily tracker
  const dailyData: DailyTrackerData[] = Array.from(dailyResults.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, dayTurnovers]) => {
      const dayMedian = calculateMedian(dayTurnovers) ?? 0
      return {
        date,
        color: getTargetRelativeColor(dayMedian, thresholdMinutes, true),
        tooltip: `${date}: ${Math.round(dayMedian)} min median`,
        numericValue: dayMedian
      }
    })
  
  return {
    value: Math.round(medianTurnover),
    displayValue: `${Math.round(medianTurnover)} min`,
    subtitle: `${complianceRate}% under ${thresholdMinutes} min target`,
    target: complianceTarget,
    targetMet: complianceRate >= complianceTarget,
    delta,
    deltaType,
    dailyData,
    // Detail data for drill-through panel
    details: turnoverDetails.sort((a, b) => a.date.localeCompare(b.date) || a.roomName.localeCompare(b.roomName)),
    compliantCount: metTarget,
    nonCompliantCount: turnovers.length - metTarget,
    complianceRate,
  }
}


/**
 * 3. OR Utilization
 * Patient-in-room time as percentage of available OR hours.
 * 
 * Returns per-room breakdown with:
 * - Individual room utilization %
 * - Whether each room uses real configured hours or the default
 * - Case count and active days per room
 */
export function calculateORUtilization(
  cases: CaseWithMilestones[],
  defaultHours: number = 10,
  previousPeriodCases?: CaseWithMilestones[],
  roomHoursMap?: RoomHoursMap,
  config?: { utilizationTargetPercent?: number }
): ORUtilizationResult {
  // Track per room-day: minutes used, room metadata
  const roomDays = new Map<string, { minutes: number; roomId: string; roomName: string; caseCount: number }>()
  
  cases.forEach(c => {
    if (!c.or_room_id) return
    const milestones = getMilestoneMap(c)
    const caseMinutes = getTimeDiffMinutes(milestones.patient_in, milestones.patient_out)
    
    if (caseMinutes !== null && caseMinutes > 0) {
      const key = `${c.scheduled_date}|${c.or_room_id}`
      const existing = roomDays.get(key) || {
        minutes: 0,
        roomId: c.or_room_id,
        roomName: c.or_rooms?.name || 'Unknown',
        caseCount: 0
      }
      existing.minutes += caseMinutes
      existing.caseCount++
      roomDays.set(key, existing)
    }
  })
  
  // Aggregate per-room across all days
  const roomAgg = new Map<string, {
    roomId: string
    roomName: string
    totalMinutes: number
    totalCases: number
    daysActive: number
    dailyUtils: number[]
  }>()
  
  const dailyResults = new Map<string, number[]>()
  
  roomDays.forEach(({ minutes, roomId, roomName, caseCount }, key) => {
    const date = key.split('|')[0]
    const availableHours = roomHoursMap?.[roomId] ?? defaultHours
    const utilization = Math.min((minutes / (availableHours * 60)) * 100, 150) // Cap at 150% for sanity
    
    // Aggregate by room
    const agg = roomAgg.get(roomId) || {
      roomId,
      roomName,
      totalMinutes: 0,
      totalCases: 0,
      daysActive: 0,
      dailyUtils: []
    }
    agg.totalMinutes += minutes
    agg.totalCases += caseCount
    agg.daysActive++
    agg.dailyUtils.push(utilization)
    roomAgg.set(roomId, agg)
    
    // Daily tracker
    const dayUtils = dailyResults.get(date) || []
    dayUtils.push(utilization)
    dailyResults.set(date, dayUtils)
  })
  
  // Build per-room breakdown
  const roomBreakdown: RoomUtilizationDetail[] = Array.from(roomAgg.values()).map(agg => {
    const usingRealHours = roomHoursMap?.[agg.roomId] !== undefined
    const availableHours = roomHoursMap?.[agg.roomId] ?? defaultHours
    const avgUtilization = calculateAverage(agg.dailyUtils)
    
    return {
      roomId: agg.roomId,
      roomName: agg.roomName,
      utilization: Math.round(avgUtilization),
      usedMinutes: Math.round(agg.totalMinutes),
      availableHours,
      caseCount: agg.totalCases,
      daysActive: agg.daysActive,
      usingRealHours
    }
  }).sort((a, b) => a.utilization - b.utilization) // Lowest first = action items
  
  // Overall average utilization
  const allDailyUtils = Array.from(roomAgg.values()).flatMap(a => a.dailyUtils)
  const avgUtilization = calculateAverage(allDailyUtils)
  
  const utilizationTarget = config?.utilizationTargetPercent ?? ANALYTICS_CONFIG_DEFAULTS.utilizationTargetPercent

  const roomsWithRealHours = roomBreakdown.filter(r => r.usingRealHours).length
  const roomsWithDefaultHours = roomBreakdown.filter(r => !r.usingRealHours).length
  const totalRooms = roomBreakdown.length
  const roomsAboveTarget = roomBreakdown.filter(r => r.utilization >= utilizationTarget).length
  
  // Previous period delta
  let previousAvg: number | undefined
  if (previousPeriodCases && previousPeriodCases.length > 0) {
    const prevRoomDays = new Map<string, { minutes: number; roomId: string }>()
    previousPeriodCases.forEach(c => {
      if (!c.or_room_id) return
      const milestones = getMilestoneMap(c)
      const caseMinutes = getTimeDiffMinutes(milestones.patient_in, milestones.patient_out)
      if (caseMinutes !== null && caseMinutes > 0) {
        const key = `${c.scheduled_date}|${c.or_room_id}`
        const existing = prevRoomDays.get(key) || { minutes: 0, roomId: c.or_room_id }
        existing.minutes += caseMinutes
        prevRoomDays.set(key, existing)
      }
    })
    
    const prevUtilizations: number[] = []
    prevRoomDays.forEach(({ minutes, roomId }) => {
      const availableHours = roomHoursMap?.[roomId] ?? defaultHours
      const utilization = Math.min((minutes / (availableHours * 60)) * 100, 150)
      prevUtilizations.push(utilization)
    })
    
    if (prevUtilizations.length > 0) {
      previousAvg = calculateAverage(prevUtilizations)
    }
  }
  
  const { delta, deltaType } = calculateDelta(avgUtilization, previousAvg)
  
  // Daily tracker
  const dailyData: DailyTrackerData[] = Array.from(dailyResults.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, dayUtils]) => {
      const dayAvg = calculateAverage(dayUtils)
      return {
        date,
        color: getTargetRelativeColor(dayAvg, utilizationTarget, false),
        tooltip: `${date}: ${Math.round(dayAvg)}% utilization`,
        numericValue: dayAvg
      }
    })
  
  // Build subtitle
  const hoursNote = roomsWithDefaultHours > 0 && roomsWithRealHours > 0
    ? ` · ${roomsWithDefaultHours} using default hours`
    : roomsWithDefaultHours === totalRooms && totalRooms > 0
    ? ' · All rooms using default hours'
    : ''
  
  return {
    value: Math.round(avgUtilization),
    displayValue: `${Math.round(avgUtilization)}%`,
    subtitle: `${roomsAboveTarget}/${totalRooms} rooms above ${utilizationTarget}% target${hoursNote}`,
    target: utilizationTarget,
    targetMet: avgUtilization >= utilizationTarget,
    delta,
    deltaType,
    dailyData,
    // Extended fields
    roomBreakdown,
    roomsWithRealHours,
    roomsWithDefaultHours
  }
}

/**
 * 4. Case Volume
 * Total number of cases in the period with trend
 */
export function calculateCaseVolume(
  cases: CaseWithMilestones[],
  previousPeriodCases?: CaseWithMilestones[]
): CaseVolumeResult {
  const totalCases = cases.length
  const previousTotal = previousPeriodCases?.length || 0
  
  let delta: number | undefined
  let deltaType: 'increase' | 'decrease' | 'unchanged' | undefined
  
  if (previousTotal > 0) {
    delta = Math.round(((totalCases - previousTotal) / previousTotal) * 100)
    deltaType = delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'unchanged'
    delta = Math.abs(delta)
  }
  
  // Weekly trend for sparkline
  const weeklyVolume = new Map<string, number>()
  cases.forEach(c => {
    const date = new Date(c.scheduled_date)
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay())
    const weekKey = weekStart.toISOString().split('T')[0]
    weeklyVolume.set(weekKey, (weeklyVolume.get(weekKey) || 0) + 1)
  })
  
  return {
    value: totalCases,
    displayValue: totalCases.toString(),
    subtitle: delta !== undefined ? `${deltaType === 'increase' ? '+' : '-'}${delta}% vs last period` : 'This period',
    delta,
    deltaType,
    weeklyVolume: Array.from(weeklyVolume.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, count]) => ({ week, count }))
  }
}

/**
 * 5. Cancellation Rate (Enhanced)
 * 
 * NEW: Differentiates same-day cancellations from advance cancellations.
 * Same-day = cancelled_at date matches scheduled_date.
 * Uses cancelled_at column when available, falls back to case_statuses check.
 */
export function calculateCancellationRate(
  cases: CaseWithMilestones[],
  previousPeriodCases?: CaseWithMilestones[],
  config?: { cancellationTargetPercent?: number }
): CancellationResult {
  const cancellationTarget = config?.cancellationTargetPercent ?? ANALYTICS_CONFIG_DEFAULTS.cancellationTargetPercent

  const allCancelled = cases.filter(c => c.case_statuses?.name === 'cancelled')
  const sameDayCancelled = allCancelled.filter(c => isSameDayCancellation(c))

  const total = cases.length
  const sameDayRate = total > 0 ? (sameDayCancelled.length / total) * 100 : 0

  // Build per-case cancellation details
  const cancellationDetails: CancellationDetail[] = allCancelled.map(c => {
    const surgeon = c.surgeon
    const isSameDay = isSameDayCancellation(c)
    let cancellationType: CancellationDetail['cancellationType'] = 'other'
    if (c.cancelled_at) {
      cancellationType = isSameDay ? 'same_day' : 'prior_day'
    } else if (isSameDay) {
      cancellationType = 'same_day'
    }
    return {
      caseId: c.id,
      caseNumber: c.case_number,
      date: c.scheduled_date,
      roomName: c.or_rooms?.name || 'Unknown',
      surgeonName: surgeon ? `${surgeon.first_name} ${surgeon.last_name}` : 'Unknown',
      scheduledStart: c.start_time || '--',
      cancellationType,
    }
  }).sort((a, b) => a.date.localeCompare(b.date))

  // Calculate previous period rate for delta
  let previousRate: number | undefined
  if (previousPeriodCases && previousPeriodCases.length > 0) {
    const prevCancelled = previousPeriodCases.filter(c => c.case_statuses?.name === 'cancelled')
    const prevSameDay = prevCancelled.filter(c => isSameDayCancellation(c))
    previousRate = (prevSameDay.length / previousPeriodCases.length) * 100
  }

  // For cancellation rate, lower is better
  const { delta, deltaType } = calculateDelta(sameDayRate, previousRate, true)

  // Daily tracker for zero-cancellation days
  const dailyResults = new Map<string, { total: number; cancelled: number; sameDay: number }>()
  cases.forEach(c => {
    const data = dailyResults.get(c.scheduled_date) || { total: 0, cancelled: 0, sameDay: 0 }
    data.total++
    if (c.case_statuses?.name === 'cancelled') {
      data.cancelled++
      if (isSameDayCancellation(c)) data.sameDay++
    }
    dailyResults.set(c.scheduled_date, data)
  })

  const dailyData: DailyTrackerData[] = Array.from(dailyResults.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, data]) => {
      const dayRate = data.total > 0 ? (data.sameDay / data.total) * 100 : 0
      return {
        date,
        color: getTargetRelativeColor(dayRate, cancellationTarget, true),
        tooltip: data.sameDay === 0
          ? `${date}: No same-day cancellations`
          : `${date}: ${data.sameDay} same-day, ${data.cancelled} total cancelled`,
        numericValue: data.sameDay
      }
    })

  return {
    value: Math.round(sameDayRate * 10) / 10,
    displayValue: `${(Math.round(sameDayRate * 10) / 10).toFixed(1)}%`,
    subtitle: `${sameDayCancelled.length} same-day of ${allCancelled.length} total cancellations`,
    target: cancellationTarget,
    targetMet: sameDayRate <= cancellationTarget,
    delta,
    deltaType,
    dailyData,
    // Extra cancellation fields
    sameDayCount: sameDayCancelled.length,
    sameDayRate: Math.round(sameDayRate * 10) / 10,
    totalCancelledCount: allCancelled.length,
    details: cancellationDetails,
  }
}

/**
 * 6. Cumulative Tardiness
 * Sum of all late start delays per day (average across days)
 */
export function calculateCumulativeTardiness(
  cases: CaseWithMilestones[],
  config?: { tardinessTargetMinutes?: number }
): KPIResult {
  const tardinessTarget = config?.tardinessTargetMinutes ?? ANALYTICS_CONFIG_DEFAULTS.tardinessTargetMinutes
  const dailyTardiness = new Map<string, number>()
  
  cases.forEach(c => {
    if (!c.start_time) return
    const milestones = getMilestoneMap(c)
    const scheduled = parseScheduledDateTime(c.scheduled_date, c.start_time)
    const actual = milestones.patient_in
    
    if (!scheduled || !actual) return
    
    const delayMinutes = getTimeDiffMinutes(scheduled, actual) || 0
    if (delayMinutes > 0) { // Only count late starts
      const existing = dailyTardiness.get(c.scheduled_date) || 0
      dailyTardiness.set(c.scheduled_date, existing + delayMinutes)
    }
  })
  
  const dailyValues = Array.from(dailyTardiness.values())
  const avgTardiness = calculateAverage(dailyValues)
  
  // Build daily tracker
  const dailyData: DailyTrackerData[] = Array.from(dailyTardiness.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, minutes]) => ({
      date,
      color: getTargetRelativeColor(minutes, tardinessTarget, true),
      tooltip: `${date}: ${Math.round(minutes)} min total delays`,
      numericValue: minutes
    }))
  
  return {
    value: Math.round(avgTardiness),
    displayValue: `${Math.round(avgTardiness)} min`,
    subtitle: 'Average daily delay',
    target: tardinessTarget,
    targetMet: avgTardiness <= tardinessTarget,
    dailyData
  }
}

/**
 * 7. Non-Operative Time
 * Time patient is in room but not being operated on
 * Pre-op: patient_in → incision
 * Post-op: closing_complete → patient_out (NO fallback to closing — that includes active work)
 * 
 * Only includes cases with patient_in + incision at minimum.
 * Post-op segment only counted when closing_complete is recorded.
 */
export function calculateNonOperativeTime(
  cases: CaseWithMilestones[],
  config?: { nonOpWarnMinutes?: number; nonOpBadMinutes?: number }
): KPIResult {
  const warnMinutes = config?.nonOpWarnMinutes ?? ANALYTICS_CONFIG_DEFAULTS.nonOpWarnMinutes
  const badMinutes = config?.nonOpBadMinutes ?? ANALYTICS_CONFIG_DEFAULTS.nonOpBadMinutes
  const notTimes: number[] = []
  const totalTimes: number[] = []
  const dailyResults = new Map<string, number[]>()

  cases.forEach(c => {
    const m = getMilestoneMap(c)

    // Must have at least patient_in and incision to calculate any non-operative time
    if (!m.patient_in || !m.incision) return

    // Pre-op time: patient_in to incision (always available if we get here)
    const preOp = getTimeDiffMinutes(m.patient_in, m.incision)
    if (preOp === null || preOp < 0) return // Skip invalid data

    // Post-closing time: ONLY use closing_complete → patient_out
    // Do NOT fall back to closing — that segment includes active surgical closing work
    let postClose: number | null = null
    if (m.closing_complete && m.patient_out) {
      postClose = getTimeDiffMinutes(m.closing_complete, m.patient_out)
      if (postClose !== null && postClose < 0) postClose = null // Skip invalid
    }

    // Total case time
    const total = getTimeDiffMinutes(m.patient_in, m.patient_out)

    // Sum non-operative segments (pre-op always, post-op when available)
    const nonOpTime = preOp + (postClose ?? 0)
    notTimes.push(nonOpTime)

    if (total !== null && total > 0) {
      totalTimes.push(total)
    }

    // Track daily
    const dayTimes = dailyResults.get(c.scheduled_date) || []
    dayTimes.push(nonOpTime)
    dailyResults.set(c.scheduled_date, dayTimes)
  })

  const avgNOT = calculateAverage(notTimes)
  const avgTotal = calculateAverage(totalTimes)
  const notPercent = avgTotal > 0 ? Math.round((avgNOT / avgTotal) * 100) : 0

  // Build daily tracker
  const dailyData: DailyTrackerData[] = Array.from(dailyResults.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, dayTimes]) => {
      const dayAvg = calculateAverage(dayTimes)
      return {
        date,
        color: (dayAvg <= warnMinutes ? 'green' : dayAvg <= badMinutes ? 'yellow' : 'red') as Color,
        tooltip: `${date}: ${Math.round(dayAvg)} min avg non-op (${dayTimes.length} cases)`,
        numericValue: dayAvg
      }
    })

  return {
    value: Math.round(avgNOT),
    displayValue: formatMinutes(avgNOT),
    subtitle: `${notPercent}% of total case time · ${notTimes.length} cases`,
    target: warnMinutes,
    targetMet: avgNOT <= warnMinutes,
    dailyData
  }
}

/**
 * 8. Surgeon Idle Time (Comprehensive Analysis)
 * 
 * Tracks ALL idle gaps between a surgeon's consecutive cases:
 * - Flip room gaps: Surgeon switches rooms (surgeonDone → next patient_in, different room)
 * - Same-room gaps: Surgeon stays in same room (surgeonDone → next patient_in, same room)
 * 
 * Returns split KPIs for combined, flip-only, and same-room-only idle time,
 * plus detailed per-surgeon-day analysis for the modal.
 */
export function calculateSurgeonIdleTime(
  cases: CaseWithMilestonesAndSurgeon[],
  config?: { idleCombinedTargetMinutes?: number; idleFlipTargetMinutes?: number; idleSameRoomTargetMinutes?: number }
): {
  kpi: KPIResult           // Combined idle
  flipKpi: KPIResult       // Flip room idle only
  sameRoomKpi: KPIResult   // Same room idle only
  details: FlipRoomAnalysis[]
} {
  const idleCombinedTarget = config?.idleCombinedTargetMinutes ?? ANALYTICS_CONFIG_DEFAULTS.idleCombinedTargetMinutes
  const idleFlipTarget = config?.idleFlipTargetMinutes ?? ANALYTICS_CONFIG_DEFAULTS.idleFlipTargetMinutes
  const idleSameRoomTarget = config?.idleSameRoomTargetMinutes ?? ANALYTICS_CONFIG_DEFAULTS.idleSameRoomTargetMinutes
  const allAnalysis: FlipRoomAnalysis[] = []
  const allIdleTimes: number[] = []
  const flipIdleTimes: number[] = []
  const sameRoomIdleTimes: number[] = []
  
  // Group by surgeon and date
  const bySurgeonDate = new Map<string, CaseWithMilestonesAndSurgeon[]>()
  cases.forEach(c => {
    if (!c.surgeon_id) return
    const key = `${c.surgeon_id}|${c.scheduled_date}`
    const existing = bySurgeonDate.get(key) || []
    existing.push(c)
    bySurgeonDate.set(key, existing)
  })
  
  // Process ALL surgeon-days with 2+ cases (not just flip room days)
  bySurgeonDate.forEach((surgeonCases, key) => {
    if (surgeonCases.length < 2) return // Need at least 2 cases for a gap
    
    const [surgeonId, date] = key.split('|')
    const rooms = new Set(surgeonCases.map(c => c.or_room_id).filter(Boolean))
    const isFlipRoom = rooms.size >= 2
    
    const sorted = surgeonCases
      .filter(c => c.start_time)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
    
    if (sorted.length < 2) return
    
    const surgeonName = sorted[0]?.surgeon 
      ? `Dr. ${sorted[0].surgeon.last_name}` 
      : 'Unknown'
    
    const idleGaps: FlipRoomAnalysis['idleGaps'] = []
    
    // Calculate gaps between ALL consecutive cases
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i]
      const next = sorted[i + 1]
      
      const currentMilestones = getMilestoneMap(current)
      const nextMilestones = getMilestoneMap(next)
      
      // Use getSurgeonDoneTime (accounts for pa_closes workflow)
      const surgeonDone = getSurgeonDoneTime(currentMilestones, current.surgeon_profile)
      
      // For same-room: surgeonDone → next incision (surgeon perspective)
      // For flip: surgeonDone → next patient_in (travel + setup time)
      const isRoomSwitch = current.or_room_id !== next.or_room_id
      const nextStart = isRoomSwitch ? nextMilestones.patient_in : (nextMilestones.incision || nextMilestones.patient_in)
      
      if (surgeonDone && nextStart) {
        const idleMinutes = getTimeDiffMinutes(surgeonDone, nextStart)
        
        if (idleMinutes !== null && idleMinutes > 0) {
          const gapType: 'flip' | 'same_room' = isRoomSwitch ? 'flip' : 'same_room'
          
          allIdleTimes.push(idleMinutes)
          if (gapType === 'flip') {
            flipIdleTimes.push(idleMinutes)
          } else {
            sameRoomIdleTimes.push(idleMinutes)
          }
          
          // Optimal call delta differs by gap type
          // Flip: How much earlier to call next patient to the other room
          // Same-room: How much turnover time could be reduced  
          const buffer = gapType === 'flip' ? 5 : 3 // Tighter buffer for same-room
          const optimalCallDelta = Math.max(0, idleMinutes - buffer)
          
          idleGaps.push({
            fromCase: current.case_number,
            toCase: next.case_number,
            idleMinutes,
            optimalCallDelta,
            gapType,
            fromRoom: current.or_rooms?.name || 'Unknown',
            toRoom: next.or_rooms?.name || 'Unknown'
          })
        }
      }
    }
    
    if (idleGaps.length > 0) {
      allAnalysis.push({
        surgeonId,
        surgeonName,
        date,
        isFlipRoom,
        cases: sorted.map(c => ({
          caseId: c.id,
          caseNumber: c.case_number,
          roomId: c.or_room_id || '',
          roomName: c.or_rooms?.name || 'Unknown',
          scheduledStart: c.start_time || '',
          patientIn: getMilestoneMap(c).patient_in,
          patientOut: getMilestoneMap(c).patient_out
        })),
        idleGaps,
        avgIdleTime: calculateAverage(idleGaps.map(g => g.idleMinutes)),
        totalIdleTime: idleGaps.reduce((sum, g) => sum + g.idleMinutes, 0)
      })
    }
  })
  
  // Combined KPI
  const avgIdleTime = calculateAverage(allIdleTimes)
  const flipDays = allAnalysis.filter(a => a.isFlipRoom).length
  const totalSurgeonDays = allAnalysis.length
  
  // Flip KPI
  const avgFlipIdle = calculateAverage(flipIdleTimes)
  const avgFlipDelta = calculateAverage(
    allAnalysis
      .flatMap(f => f.idleGaps.filter(g => g.gapType === 'flip').map(g => g.optimalCallDelta))
  )
  
  // Same-room KPI
  const avgSameRoomIdle = calculateAverage(sameRoomIdleTimes)
  const surgeonsWithHighSameRoom = new Set(
    allAnalysis
      .filter(a => a.idleGaps.some(g => g.gapType === 'same_room' && g.idleMinutes > 15))
      .map(a => a.surgeonId)
  ).size
  
  return {
    kpi: {
      value: Math.round(avgIdleTime),
      displayValue: `${Math.round(avgIdleTime)} min`,
      subtitle: `${totalSurgeonDays} surgeon-days · ${allIdleTimes.length} gaps analyzed`,
      target: idleCombinedTarget,
      targetMet: avgIdleTime <= idleCombinedTarget
    },
    flipKpi: {
      value: Math.round(avgFlipIdle),
      displayValue: flipIdleTimes.length > 0 ? `${Math.round(avgFlipIdle)} min` : '—',
      subtitle: avgFlipDelta > 0 && flipIdleTimes.length > 0
        ? `Call patients ${Math.round(avgFlipDelta)} min earlier · ${flipIdleTimes.length} transitions`
        : flipIdleTimes.length > 0
        ? `${flipIdleTimes.length} transitions · ${flipDays} surgeon-days`
        : 'No flip room transitions found',
      target: idleFlipTarget,
      targetMet: avgFlipIdle <= idleFlipTarget || flipIdleTimes.length === 0
    },
    sameRoomKpi: {
      value: Math.round(avgSameRoomIdle),
      displayValue: sameRoomIdleTimes.length > 0 ? `${Math.round(avgSameRoomIdle)} min` : '—',
      subtitle: surgeonsWithHighSameRoom > 0
        ? `${surgeonsWithHighSameRoom} surgeon${surgeonsWithHighSameRoom > 1 ? 's' : ''} with >15 min gaps · ${sameRoomIdleTimes.length} gaps`
        : sameRoomIdleTimes.length > 0
        ? `${sameRoomIdleTimes.length} same-room gaps analyzed`
        : 'No same-room gaps found',
      target: idleSameRoomTarget,
      targetMet: avgSameRoomIdle <= idleSameRoomTarget || sameRoomIdleTimes.length === 0
    },
    details: allAnalysis.sort((a, b) => b.totalIdleTime - a.totalIdleTime) // Worst offenders first
  }
}

// ============================================
// SURGEON IDLE SUMMARY (Per-Surgeon Aggregation)
// ============================================

export interface SurgeonIdleSummary {
  surgeonId: string
  surgeonName: string
  caseCount: number              // Total cases in period
  gapCount: number               // Number of idle gaps analyzed
  medianIdleTime: number         // Median idle minutes across ALL gaps
  medianCallbackDelta: number    // Median optimalCallDelta from FLIP gaps only (callback only applies to flip)
  flipGapCount: number
  sameRoomGapCount: number
  medianFlipIdle: number
  medianSameRoomIdle: number
  hasFlipData: boolean           // Whether this surgeon has any flip room transitions
  status: 'on_track' | 'call_sooner' | 'call_later' | 'turnover_only'
  statusLabel: string
}

/**
 * Aggregate FlipRoomAnalysis[] into per-surgeon summaries with medians.
 * 
 * Callback optimization ONLY applies to flip room gaps — you can't call a patient
 * sooner if the next case is in the same room (that's a turnover problem, not callback).
 * 
 * Status logic:
 * - turnover_only: Surgeon has NO flip room gaps — callback timing is not applicable
 * - on_track:      Surgeon has flip gaps, but median flip idle ≤ 5 min (good timing)
 * - call_sooner:   Median flip idle > 5 min AND median flip callback delta > 3 min
 * - call_later:    Median flip idle ≤ 2 min (surgeon arriving before room ready)
 */
export function aggregateSurgeonIdleSummaries(
  details: FlipRoomAnalysis[],
  cases: CaseWithMilestonesAndSurgeon[]
): SurgeonIdleSummary[] {
  // Group all gaps by surgeon
  const bySurgeon = new Map<string, {
    surgeonName: string
    idleTimes: number[]
    flipCallbackDeltas: number[]    // Only from flip gaps
    flipIdles: number[]
    sameRoomIdles: number[]
    gapCount: number
    flipGapCount: number
    sameRoomGapCount: number
  }>()

  details.forEach(analysis => {
    const existing = bySurgeon.get(analysis.surgeonId) || {
      surgeonName: analysis.surgeonName,
      idleTimes: [],
      flipCallbackDeltas: [],
      flipIdles: [],
      sameRoomIdles: [],
      gapCount: 0,
      flipGapCount: 0,
      sameRoomGapCount: 0,
    }

    analysis.idleGaps.forEach(gap => {
      existing.idleTimes.push(gap.idleMinutes)
      existing.gapCount++

      if (gap.gapType === 'flip') {
        existing.flipIdles.push(gap.idleMinutes)
        existing.flipCallbackDeltas.push(gap.optimalCallDelta)
        existing.flipGapCount++
      } else {
        existing.sameRoomIdles.push(gap.idleMinutes)
        existing.sameRoomGapCount++
      }
    })

    existing.surgeonName = analysis.surgeonName
    bySurgeon.set(analysis.surgeonId, existing)
  })

  // Count cases per surgeon
  const caseCountBySurgeon = new Map<string, number>()
  cases.forEach(c => {
    if (!c.surgeon_id) return
    caseCountBySurgeon.set(c.surgeon_id, (caseCountBySurgeon.get(c.surgeon_id) || 0) + 1)
  })

  // Build summaries
  const summaries: SurgeonIdleSummary[] = []

  bySurgeon.forEach((data, surgeonId) => {
    const medianIdle = calculateMedian(data.idleTimes) ?? 0
    const medianFlip = calculateMedian(data.flipIdles) ?? 0
    const medianSameRoom = calculateMedian(data.sameRoomIdles) ?? 0
    const hasFlipData = data.flipGapCount > 0

    // Callback delta ONLY from flip gaps (calling patient to a different room earlier)
    const medianCallback = hasFlipData
      ? (calculateMedian(data.flipCallbackDeltas) ?? 0)
      : 0

    // Status determination — based on flip room data only
    let status: SurgeonIdleSummary['status']
    let statusLabel: string

    if (!hasFlipData) {
      // No flip room transitions — callback timing doesn't apply
      status = 'turnover_only'
      statusLabel = 'Turnover Only'
    } else if (medianFlip <= 2) {
      // Surgeon arriving before room is ready — slow down callbacks
      status = 'call_later'
      statusLabel = 'Call Later'
    } else if (medianFlip <= 5) {
      // Good callback timing
      status = 'on_track'
      statusLabel = 'On Track'
    } else if (medianCallback > 3) {
      // Meaningful idle time that could be recovered by earlier callbacks
      status = 'call_sooner'
      statusLabel = 'Call Sooner'
    } else {
      status = 'on_track'
      statusLabel = 'On Track'
    }

    summaries.push({
      surgeonId,
      surgeonName: data.surgeonName,
      caseCount: caseCountBySurgeon.get(surgeonId) || 0,
      gapCount: data.gapCount,
      medianIdleTime: medianIdle,
      medianCallbackDelta: medianCallback,
      flipGapCount: data.flipGapCount,
      sameRoomGapCount: data.sameRoomGapCount,
      medianFlipIdle: medianFlip,
      medianSameRoomIdle: medianSameRoom,
      hasFlipData,
      status,
      statusLabel,
    })
  })

  // Sort: call_sooner first (most actionable), then by flip callback delta desc
  return summaries.sort((a, b) => {
    // Status priority: call_sooner > call_later > on_track > turnover_only
    const statusPriority = { call_sooner: 0, call_later: 1, on_track: 2, turnover_only: 3 }
    const statusDiff = statusPriority[a.status] - statusPriority[b.status]
    if (statusDiff !== 0) return statusDiff
    return b.medianCallbackDelta - a.medianCallbackDelta
  })
}

// ============================================
// TIME BREAKDOWN CALCULATIONS
// ============================================

export function calculateTimeBreakdown(cases: CaseWithMilestones[]) {
  const completedCases = cases.filter(c => {
    const m = getMilestoneMap(c)
    return m.patient_in && m.patient_out
  })
  
  const totalTimes: number[] = []
  const surgicalTimes: number[] = []
  const preOpTimes: number[] = []
  const anesthesiaTimes: number[] = []
  const closingTimes: number[] = []
  const emergenceTimes: number[] = []
  
  completedCases.forEach(c => {
    const m = getMilestoneMap(c)
    
    // Total: patient_in → patient_out
    const total = getTimeDiffMinutes(m.patient_in, m.patient_out)
    if (total) totalTimes.push(total)
    
    // Surgical: incision → closing
    const surgical = getTimeDiffMinutes(m.incision, m.closing)
    if (surgical) surgicalTimes.push(surgical)
    
    // Pre-op: patient_in → incision
    const preOp = getTimeDiffMinutes(m.patient_in, m.incision)
    if (preOp) preOpTimes.push(preOp)
    
    // Anesthesia: anes_start → anes_end
    const anesthesia = getTimeDiffMinutes(m.anes_start, m.anes_end)
    if (anesthesia) anesthesiaTimes.push(anesthesia)
    
    // Closing: closing → closing_complete (or patient_out if no closing_complete)
    const closing = getTimeDiffMinutes(m.closing, m.closing_complete || m.patient_out)
    if (closing) closingTimes.push(closing)
    
    // Emergence: closing_complete → patient_out
    if (m.closing_complete) {
      const emergence = getTimeDiffMinutes(m.closing_complete, m.patient_out)
      if (emergence) emergenceTimes.push(emergence)
    }
  })
  
  return {
    avgTotalTime: calculateAverage(totalTimes),
    avgSurgicalTime: calculateAverage(surgicalTimes),
    avgPreOpTime: calculateAverage(preOpTimes),
    avgAnesthesiaTime: calculateAverage(anesthesiaTimes),
    avgClosingTime: calculateAverage(closingTimes),
    avgEmergenceTime: calculateAverage(emergenceTimes),
    nonOperativeTime: calculateAverage(preOpTimes) + calculateAverage(closingTimes) + calculateAverage(emergenceTimes)
  }
}

/**
 * Calculate average case time with delta
 */
export function calculateAvgCaseTime(
  cases: CaseWithMilestones[],
  previousPeriodCases?: CaseWithMilestones[]
): KPIResult {
  const completedCases = cases.filter(c => {
    const m = getMilestoneMap(c)
    return m.patient_in && m.patient_out
  })
  
  const totalTimes: number[] = []
  completedCases.forEach(c => {
    const m = getMilestoneMap(c)
    const total = getTimeDiffMinutes(m.patient_in, m.patient_out)
    if (total && total > 0) totalTimes.push(total)
  })
  
  const avgTime = calculateAverage(totalTimes)
  
  // Calculate previous period average for delta
  let previousAvg: number | undefined
  if (previousPeriodCases && previousPeriodCases.length > 0) {
    const prevCompleted = previousPeriodCases.filter(c => {
      const m = getMilestoneMap(c)
      return m.patient_in && m.patient_out
    })
    
    const prevTimes: number[] = []
    prevCompleted.forEach(c => {
      const m = getMilestoneMap(c)
      const total = getTimeDiffMinutes(m.patient_in, m.patient_out)
      if (total && total > 0) prevTimes.push(total)
    })
    
    if (prevTimes.length > 0) {
      previousAvg = calculateAverage(prevTimes)
    }
  }
  
  // For case time, lower is generally better (more efficient)
  const { delta, deltaType } = calculateDelta(avgTime, previousAvg, true)
  
  return {
    value: Math.round(avgTime),
    displayValue: formatMinutes(avgTime),
    subtitle: `${completedCases.length} completed cases`,
    delta,
    deltaType
  }
}

// ============================================
// MAIN ANALYTICS FUNCTION
// ============================================

/**
 * Calculate all analytics for the overview dashboard.
 *
 * Accepts a unified FacilityAnalyticsConfig that is forwarded to each
 * individual calculate* function. Falls back to ANALYTICS_CONFIG_DEFAULTS
 * for any missing field.
 */
export function calculateAnalyticsOverview(
  cases: CaseWithMilestonesAndSurgeon[],
  previousPeriodCases?: CaseWithMilestonesAndSurgeon[],
  config?: Partial<FacilityAnalyticsConfig>,
  roomHoursMap?: RoomHoursMap
): AnalyticsOverview {
  // FIX: Filter out excluded cases before any calculations
  const activeCases = filterActiveCases(cases) as CaseWithMilestonesAndSurgeon[]
  const activePrevCases = previousPeriodCases 
    ? filterActiveCases(previousPeriodCases) as CaseWithMilestonesAndSurgeon[]
    : undefined

  const completedCases = activeCases.filter(c => {
    const m = getMilestoneMap(c)
    return m.patient_in && m.patient_out
  })
  
  const cancelledCases = activeCases.filter(c => c.case_statuses?.name === 'cancelled')
  
  // Build FCOTS config from unified config (backward-compatible with FCOTSConfig)
  const fcotsConfig: FCOTSConfig = {
    milestone: config?.fcotsMilestone ?? ANALYTICS_CONFIG_DEFAULTS.fcotsMilestone,
    graceMinutes: config?.fcotsGraceMinutes ?? ANALYTICS_CONFIG_DEFAULTS.fcotsGraceMinutes,
    targetPercent: config?.fcotsTargetPercent ?? ANALYTICS_CONFIG_DEFAULTS.fcotsTargetPercent,
  }

  const surgeonIdleResult = calculateSurgeonIdleTime(activeCases, {
    idleCombinedTargetMinutes: config?.idleCombinedTargetMinutes,
    idleFlipTargetMinutes: config?.idleFlipTargetMinutes,
    idleSameRoomTargetMinutes: config?.idleSameRoomTargetMinutes,
  })
  const surgeonIdleSummaries = aggregateSurgeonIdleSummaries(surgeonIdleResult.details, activeCases)
  const timeBreakdown = calculateTimeBreakdown(activeCases)

  // Calculate the split turnovers (same room vs flip room)
  const turnoverBreakdown = calculateSurgicalTurnovers(activeCases, activePrevCases, {
    sameRoomTurnoverTarget: config?.sameRoomTurnoverTarget,
    flipRoomTurnoverTarget: config?.flipRoomTurnoverTarget,
  })

 return {
    // Volume
    totalCases: activeCases.length,
    completedCases: completedCases.length,
    cancelledCases: cancelledCases.length,

    // KPIs
    fcots: calculateFCOTS(activeCases, activePrevCases, fcotsConfig),
    turnoverTime: calculateTurnoverTime(activeCases, activePrevCases, {
      turnoverThresholdMinutes: config?.turnoverThresholdMinutes,
      turnoverComplianceTarget: config?.turnoverComplianceTarget,
    }),
    orUtilization: calculateORUtilization(activeCases, 10, activePrevCases, roomHoursMap, {
      utilizationTargetPercent: config?.utilizationTargetPercent,
    }),
    caseVolume: calculateCaseVolume(activeCases, activePrevCases),
    cancellationRate: calculateCancellationRate(activeCases, activePrevCases, {
      cancellationTargetPercent: config?.cancellationTargetPercent,
    }),
    cumulativeTardiness: calculateCumulativeTardiness(activeCases, {
      tardinessTargetMinutes: config?.tardinessTargetMinutes,
    }),
    nonOperativeTime: calculateNonOperativeTime(activeCases, {
      nonOpWarnMinutes: config?.nonOpWarnMinutes,
      nonOpBadMinutes: config?.nonOpBadMinutes,
    }),
    surgeonIdleTime: surgeonIdleResult.kpi,
    surgeonIdleFlip: surgeonIdleResult.flipKpi,
    surgeonIdleSameRoom: surgeonIdleResult.sameRoomKpi,

    // Split surgical turnovers
    standardSurgicalTurnover: turnoverBreakdown.standardTurnover,
    flipRoomTime: turnoverBreakdown.flipRoomTime,
    flipRoomAnalysis: surgeonIdleResult.details,
    surgeonIdleSummaries,

    // Time breakdown
    avgTotalCaseTime: timeBreakdown.avgTotalTime,
    avgSurgicalTime: timeBreakdown.avgSurgicalTime,
    avgPreOpTime: timeBreakdown.avgPreOpTime,
    avgAnesthesiaTime: timeBreakdown.avgAnesthesiaTime,
    avgClosingTime: timeBreakdown.avgClosingTime,
    avgEmergenceTime: timeBreakdown.avgEmergenceTime
  }
}
// ============================================
// LEGACY TURNOVER FUNCTIONS (v1 COMPATIBILITY)
// These provide simple arrays of turnover durations in seconds
// Used by Surgeons page for basic turnover calculations
// ============================================

/**
 * Get all room turnovers for a set of cases
 * Room Turnover = patient_out (Case A) → patient_in (Case B) in same room
 * Returns array of turnover durations in SECONDS
 */
export function getAllTurnovers(cases: CaseWithMilestones[]): number[] {
  const turnovers: number[] = []
  
  // Group cases by room and date
  const byRoomDate = new Map<string, CaseWithMilestones[]>()
  cases.forEach(c => {
    if (!c.or_room_id) return
    const key = `${c.scheduled_date}|${c.or_room_id}`
    const existing = byRoomDate.get(key) || []
    existing.push(c)
    byRoomDate.set(key, existing)
  })
  
  // Calculate turnovers between consecutive cases in same room
  byRoomDate.forEach((roomCases) => {
    const sorted = roomCases.sort((a, b) => 
      (a.start_time || '').localeCompare(b.start_time || '')
    )
    
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = getMilestoneMap(sorted[i])
      const next = getMilestoneMap(sorted[i + 1])
      
      if (current.patient_out && next.patient_in) {
        const turnoverSeconds = getTimeDiffSeconds(current.patient_out, next.patient_in)
        // Only include reasonable turnovers (5 min to 6 hours)
        if (turnoverSeconds !== null && turnoverSeconds >= 300 && turnoverSeconds <= 21600) {
          turnovers.push(turnoverSeconds)
        }
      }
    }
  })
  
  return turnovers
}

/**
 * Alias for getAllTurnovers (v1 compatibility)
 */
export function calculateRoomTurnovers(cases: CaseWithMilestones[]): number[] {
  return getAllTurnovers(cases)
}

/**
 * Get all surgical turnovers for a set of cases
 * Surgical Turnover = closing_complete (Case A) → incision (Case B) in same room
 * Returns array of turnover durations in SECONDS
 */
export function getAllSurgicalTurnovers(cases: CaseWithMilestones[]): number[] {
  const turnovers: number[] = []
  
  // Group cases by room and date
  const byRoomDate = new Map<string, CaseWithMilestones[]>()
  cases.forEach(c => {
    if (!c.or_room_id) return
    const key = `${c.scheduled_date}|${c.or_room_id}`
    const existing = byRoomDate.get(key) || []
    existing.push(c)
    byRoomDate.set(key, existing)
  })
  
  // Calculate surgical turnovers between consecutive cases
  byRoomDate.forEach((roomCases) => {
    const sorted = roomCases.sort((a, b) => 
      (a.start_time || '').localeCompare(b.start_time || '')
    )
    
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = getMilestoneMap(sorted[i])
      const next = getMilestoneMap(sorted[i + 1])
      
      // Surgical turnover: closing_complete → incision
      if (current.closing_complete && next.incision) {
        const turnoverSeconds = getTimeDiffSeconds(current.closing_complete, next.incision)
        // Only include reasonable turnovers (5 min to 6 hours)
        if (turnoverSeconds !== null && turnoverSeconds >= 300 && turnoverSeconds <= 21600) {
          turnovers.push(turnoverSeconds)
        }
      }
    }
  })
  
  return turnovers
}