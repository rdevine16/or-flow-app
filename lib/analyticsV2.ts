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
  surgeon?: { first_name: string; last_name: string } | null
  procedure_types?: { id: string; name: string } | null
  or_rooms?: { id: string; name: string } | null
  case_statuses?: { name: string } | null
  case_milestones: Array<{
    milestone_type_id: string
    recorded_at: string
    milestone_types?: { name: string } | null
  }>
}

export interface MilestoneMap {
  patient_in?: Date
  anes_start?: Date
  anes_end?: Date
  prepped?: Date
  incision?: Date
  closing?: Date
  closing_complete?: Date
  patient_out?: Date
  room_cleaned?: Date
}

export interface DailyTrackerData {
  date: string
  color: Color
  tooltip: string
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
  }>
  avgIdleTime: number
  totalIdleTime: number
}

export interface AnalyticsOverview {
  // Volume
  totalCases: number
  completedCases: number
  cancelledCases: number
  
  // KPIs
  fcots: KPIResult
  turnoverTime: KPIResult
  orUtilization: KPIResult
  caseVolume: KPIResult
  cancellationRate: KPIResult
  cumulativeTardiness: KPIResult
  nonOperativeTime: KPIResult
  surgeonIdleTime: KPIResult
  
  // Flip room details
  flipRoomAnalysis: FlipRoomAnalysis[]
  
  // Time breakdown
  avgTotalCaseTime: number
  avgSurgicalTime: number
  avgPreOpTime: number
  avgAnesthesiaTime: number
  avgClosingTime: number
  avgEmergenceTime: number
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
    const name = m.milestone_types?.name
    if (name && m.recorded_at) {
      const date = new Date(m.recorded_at)
      switch (name) {
        case 'patient_in': map.patient_in = date; break
        case 'anes_start': map.anes_start = date; break
        case 'anes_end': map.anes_end = date; break
        case 'prepped': map.prepped = date; break
        case 'incision': map.incision = date; break
        case 'closing': map.closing = date; break
        case 'closing_complete': map.closing_complete = date; break
        case 'patient_out': map.patient_out = date; break
        case 'room_cleaned': map.room_cleaned = date; break
      }
    }
  })
  
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
 * Calculate average of numbers, ignoring nulls
 */
export function calculateAverage(values: (number | null)[]): number {
  const valid = values.filter((v): v is number => v !== null && !isNaN(v))
  if (valid.length === 0) return 0
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

/**
 * Parse scheduled start time and date into a Date object
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

// ============================================
// METRIC CALCULATIONS
// ============================================

/**
 * 1. FCOTS - First Case On-Time Start
 * Measures if the first case of each OR room starts within 5 minutes of scheduled time
 */
export function calculateFCOTS(cases: CaseWithMilestones[]): KPIResult {
  const casesByDateRoom = new Map<string, CaseWithMilestones>()
  
  // Find first case per room per day
  cases.forEach(c => {
    if (!c.or_room_id || !c.start_time) return
    const key = `${c.scheduled_date}-${c.or_room_id}`
    const existing = casesByDateRoom.get(key)
    
    if (!existing || (c.start_time < (existing.start_time || ''))) {
      casesByDateRoom.set(key, c)
    }
  })
  
  const firstCases = Array.from(casesByDateRoom.values())
  let onTimeCount = 0
  let lateCount = 0
  const dailyResults = new Map<string, { onTime: number; late: number }>()
  
  firstCases.forEach(c => {
    const milestones = getMilestoneMap(c)
    const scheduled = parseScheduledDateTime(c.scheduled_date, c.start_time)
    const actual = milestones.patient_in
    
    if (!scheduled || !actual) return
    
    const delayMinutes = getTimeDiffMinutes(scheduled, actual) || 0
    const isOnTime = delayMinutes <= 2 // Within 2 minutes is considered on-time
    
    if (isOnTime) {
      onTimeCount++
    } else {
      lateCount++
    }
    
    // Track daily
    const dayData = dailyResults.get(c.scheduled_date) || { onTime: 0, late: 0 }
    if (isOnTime) dayData.onTime++
    else dayData.late++
    dailyResults.set(c.scheduled_date, dayData)
  })
  
  const total = onTimeCount + lateCount
  const rate = total > 0 ? Math.round((onTimeCount / total) * 100) : 0
  
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
        color: dayRate >= 100 ? 'emerald' : dayRate >= 80 ? 'yellow' : 'red' as Color,
        tooltip: `${date}: ${data.onTime}/${data.onTime + data.late} on-time`
      }
    })
  
  return {
    value: rate,
    displayValue: `${rate}%`,
    subtitle: `${lateCount} late of ${total} first cases`,
    target: 85,
    targetMet: rate >= 85,
    dailyData
  }
}

/**
 * 2. Turnover Time
 * Time from patient_out of one case to patient_in of the next case in same room
 */
export function calculateTurnoverTime(cases: CaseWithMilestones[]): KPIResult {
  const turnovers: number[] = []
  const dailyResults = new Map<string, number[]>()
  
  // Group by room and date, sort by time
  const byRoomDate = new Map<string, CaseWithMilestones[]>()
  cases.forEach(c => {
    if (!c.or_room_id) return
    const key = `${c.scheduled_date}-${c.or_room_id}`
    const existing = byRoomDate.get(key) || []
    existing.push(c)
    byRoomDate.set(key, existing)
  })
  
  // Calculate turnovers between consecutive cases
  byRoomDate.forEach((roomCases, key) => {
    const date = key.split('-')[0]
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
        }
      }
    }
  })
  
  const avgTurnover = calculateAverage(turnovers)
  const metTarget = turnovers.filter(t => t <= 30).length
  const complianceRate = turnovers.length > 0 ? Math.round((metTarget / turnovers.length) * 100) : 0
  
  // Build daily tracker
  const dailyData: DailyTrackerData[] = Array.from(dailyResults.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, dayTurnovers]) => {
      const dayAvg = calculateAverage(dayTurnovers)
      return {
        date,
        color: dayAvg <= 25 ? 'emerald' : dayAvg <= 30 ? 'yellow' : 'red' as Color,
        tooltip: `${date}: ${Math.round(dayAvg)} min avg`
      }
    })
  
  return {
    value: Math.round(avgTurnover),
    displayValue: `${Math.round(avgTurnover)} min`,
    subtitle: `${complianceRate}% under 30 min target`,
    target: 80,
    targetMet: complianceRate >= 80,
    dailyData
  }
}

/**
 * 3. OR Utilization
 * Patient-in-room time as percentage of available OR hours (assumed 10 hours/day)
 */
export function calculateORUtilization(
  cases: CaseWithMilestones[], 
  availableHoursPerRoom: number = 10
): KPIResult {
  const roomDays = new Map<string, number>() // Total minutes used per room-day
  const uniqueRoomDays = new Set<string>()
  
  cases.forEach(c => {
    if (!c.or_room_id) return
    const milestones = getMilestoneMap(c)
    const caseMinutes = getTimeDiffMinutes(milestones.patient_in, milestones.patient_out)
    
    if (caseMinutes !== null && caseMinutes > 0) {
      const key = `${c.scheduled_date}-${c.or_room_id}`
      uniqueRoomDays.add(key)
      const existing = roomDays.get(key) || 0
      roomDays.set(key, existing + caseMinutes)
    }
  })
  
  // Calculate utilization per room-day
  const utilizations: number[] = []
  const dailyResults = new Map<string, number[]>()
  
  roomDays.forEach((minutes, key) => {
    const [date] = key.split('-')
    const utilization = (minutes / (availableHoursPerRoom * 60)) * 100
    utilizations.push(utilization)
    
    const dayUtils = dailyResults.get(date) || []
    dayUtils.push(utilization)
    dailyResults.set(date, dayUtils)
  })
  
  const avgUtilization = calculateAverage(utilizations)
  
  // Build daily tracker
  const dailyData: DailyTrackerData[] = Array.from(dailyResults.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, dayUtils]) => {
      const dayAvg = calculateAverage(dayUtils)
      return {
        date,
        color: dayAvg >= 75 ? 'emerald' : dayAvg >= 60 ? 'yellow' : 'slate' as Color,
        tooltip: `${date}: ${Math.round(dayAvg)}% utilization`
      }
    })
  
  return {
    value: Math.round(avgUtilization),
    displayValue: `${Math.round(avgUtilization)}%`,
    subtitle: `Across ${new Set(cases.map(c => c.or_room_id).filter(Boolean)).size} rooms`,
    target: 75,
    targetMet: avgUtilization >= 75,
    dailyData
  }
}

/**
 * 4. Case Volume
 * Total number of cases in the period with trend
 */
export function calculateCaseVolume(
  cases: CaseWithMilestones[],
  previousPeriodCases?: CaseWithMilestones[]
): KPIResult {
  const totalCases = cases.length
  const previousTotal = previousPeriodCases?.length || 0
  
  let delta: number | undefined
  let deltaType: 'increase' | 'decrease' | 'unchanged' | undefined
  
  if (previousTotal > 0) {
    delta = Math.round(((totalCases - previousTotal) / previousTotal) * 100)
    deltaType = delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'unchanged'
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
    subtitle: delta !== undefined ? `${delta > 0 ? '+' : ''}${delta}% vs last period` : 'This period',
    delta: delta !== undefined ? Math.abs(delta) : undefined,
    deltaType
  }
}

/**
 * 5. Cancellation Rate
 * Percentage of cases that were cancelled
 */
export function calculateCancellationRate(cases: CaseWithMilestones[]): KPIResult {
  const cancelled = cases.filter(c => c.case_statuses?.name === 'cancelled')
  const total = cases.length
  const rate = total > 0 ? (cancelled.length / total) * 100 : 0
  
  // Daily tracker for zero-cancellation days
  const dailyResults = new Map<string, { total: number; cancelled: number }>()
  cases.forEach(c => {
    const data = dailyResults.get(c.scheduled_date) || { total: 0, cancelled: 0 }
    data.total++
    if (c.case_statuses?.name === 'cancelled') data.cancelled++
    dailyResults.set(c.scheduled_date, data)
  })
  
  const dailyData: DailyTrackerData[] = Array.from(dailyResults.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, data]) => ({
      date,
      color: data.cancelled === 0 ? 'emerald' : 'red' as Color,
      tooltip: data.cancelled === 0 
        ? `${date}: No cancellations` 
        : `${date}: ${data.cancelled} cancelled`
    }))
  
  return {
    value: Math.round(rate * 10) / 10,
    displayValue: `${(Math.round(rate * 10) / 10).toFixed(1)}%`,
    subtitle: `${cancelled.length} of ${total} cases`,
    target: 5,
    targetMet: rate <= 5,
    dailyData
  }
}

/**
 * 6. Cumulative Tardiness
 * Sum of all late start delays per day (average across days)
 */
export function calculateCumulativeTardiness(cases: CaseWithMilestones[]): KPIResult {
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
      color: minutes <= 30 ? 'emerald' : minutes <= 45 ? 'yellow' : 'red' as Color,
      tooltip: `${date}: ${Math.round(minutes)} min total delays`
    }))
  
  return {
    value: Math.round(avgTardiness),
    displayValue: `${Math.round(avgTardiness)} min`,
    subtitle: 'Average daily delay',
    target: 45,
    targetMet: avgTardiness <= 45,
    dailyData
  }
}

/**
 * 7. Non-Operative Time
 * Time patient is in room but not being operated on
 * (patient_in → incision) + (closing_complete → patient_out)
 */
export function calculateNonOperativeTime(cases: CaseWithMilestones[]): KPIResult {
  const notTimes: number[] = []
  const totalTimes: number[] = []
  
  cases.forEach(c => {
    const m = getMilestoneMap(c)
    
    // Pre-op time: patient_in to incision
    const preOp = getTimeDiffMinutes(m.patient_in, m.incision)
    
    // Post-closing time: closing_complete (or closing) to patient_out
    const postClose = getTimeDiffMinutes(m.closing_complete || m.closing, m.patient_out)
    
    // Total case time
    const total = getTimeDiffMinutes(m.patient_in, m.patient_out)
    
    if (preOp !== null && postClose !== null) {
      notTimes.push(preOp + postClose)
    }
    if (total !== null) {
      totalTimes.push(total)
    }
  })
  
  const avgNOT = calculateAverage(notTimes)
  const avgTotal = calculateAverage(totalTimes)
  const notPercent = avgTotal > 0 ? Math.round((avgNOT / avgTotal) * 100) : 0
  
  return {
    value: Math.round(avgNOT),
    displayValue: formatMinutes(avgNOT),
    subtitle: `${notPercent}% of total case time`
  }
}

/**
 * 8. Surgeon Idle Time (Flip Room Analysis)
 * For surgeons running multiple rooms, time they wait between cases
 */
export function calculateSurgeonIdleTime(cases: CaseWithMilestones[]): {
  kpi: KPIResult
  details: FlipRoomAnalysis[]
} {
  const flipAnalysis: FlipRoomAnalysis[] = []
  const allIdleTimes: number[] = []
  
  // Group by surgeon and date
  const bySurgeonDate = new Map<string, CaseWithMilestones[]>()
  cases.forEach(c => {
    if (!c.surgeon_id) return
    const key = `${c.surgeon_id}-${c.scheduled_date}`
    const existing = bySurgeonDate.get(key) || []
    existing.push(c)
    bySurgeonDate.set(key, existing)
  })
  
  // Find flip room patterns (surgeon with 2+ rooms on same day)
  bySurgeonDate.forEach((surgeonCases, key) => {
    const [surgeonId, date] = key.split('-')
    const rooms = new Set(surgeonCases.map(c => c.or_room_id).filter(Boolean))
    
    if (rooms.size < 2) return // Not a flip room day
    
    const sorted = surgeonCases
      .filter(c => c.start_time)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
    
    const surgeonName = sorted[0]?.surgeon 
      ? `Dr. ${sorted[0].surgeon.last_name}` 
      : 'Unknown'
    
    const idleGaps: FlipRoomAnalysis['idleGaps'] = []
    
    // Calculate gaps between consecutive cases in different rooms
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i]
      const next = sorted[i + 1]
      
      // Only count if switching rooms
      if (current.or_room_id === next.or_room_id) continue
      
      const currentMilestones = getMilestoneMap(current)
      const nextMilestones = getMilestoneMap(next)
      
      if (currentMilestones.patient_out && nextMilestones.patient_in) {
        const idleMinutes = getTimeDiffMinutes(currentMilestones.patient_out, nextMilestones.patient_in)
        
        if (idleMinutes !== null && idleMinutes > 0) {
          allIdleTimes.push(idleMinutes)
          
          // Calculate optimal call delta
          // If next room had patient_in before current room's patient_out, we're good
          // Otherwise, that's how much earlier we should have called
          const optimalCallDelta = Math.max(0, idleMinutes - 5) // Allow 5 min buffer
          
          idleGaps.push({
            fromCase: current.case_number,
            toCase: next.case_number,
            idleMinutes,
            optimalCallDelta
          })
        }
      }
    }
    
    if (idleGaps.length > 0) {
      flipAnalysis.push({
        surgeonId,
        surgeonName,
        date,
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
  
  const avgIdleTime = calculateAverage(allIdleTimes)
  const avgOptimalDelta = calculateAverage(
    flipAnalysis.flatMap(f => f.idleGaps.map(g => g.optimalCallDelta))
  )
  
  return {
    kpi: {
      value: Math.round(avgIdleTime),
      displayValue: `${Math.round(avgIdleTime)} min`,
      subtitle: avgOptimalDelta > 0 
        ? `Call patients ${Math.round(avgOptimalDelta)} min earlier`
        : 'No optimization needed',
      target: 5,
      targetMet: avgIdleTime <= 5
    },
    details: flipAnalysis
  }
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

// ============================================
// MAIN ANALYTICS FUNCTION
// ============================================

/**
 * Calculate all analytics for the overview dashboard
 */
export function calculateAnalyticsOverview(
  cases: CaseWithMilestones[],
  previousPeriodCases?: CaseWithMilestones[]
): AnalyticsOverview {
  const completedCases = cases.filter(c => {
    const m = getMilestoneMap(c)
    return m.patient_in && m.patient_out
  })
  
  const cancelledCases = cases.filter(c => c.case_statuses?.name === 'cancelled')
  
  const surgeonIdleResult = calculateSurgeonIdleTime(cases)
  const timeBreakdown = calculateTimeBreakdown(cases)
  
  return {
    // Volume
    totalCases: cases.length,
    completedCases: completedCases.length,
    cancelledCases: cancelledCases.length,
    
    // KPIs
    fcots: calculateFCOTS(cases),
    turnoverTime: calculateTurnoverTime(cases),
    orUtilization: calculateORUtilization(cases),
    caseVolume: calculateCaseVolume(cases, previousPeriodCases),
    cancellationRate: calculateCancellationRate(cases),
    cumulativeTardiness: calculateCumulativeTardiness(cases),
    nonOperativeTime: calculateNonOperativeTime(cases),
    surgeonIdleTime: surgeonIdleResult.kpi,
    
    // Flip room details
    flipRoomAnalysis: surgeonIdleResult.details,
    
    // Time breakdown
    avgTotalCaseTime: timeBreakdown.avgTotalTime,
    avgSurgicalTime: timeBreakdown.avgSurgicalTime,
    avgPreOpTime: timeBreakdown.avgPreOpTime,
    avgAnesthesiaTime: timeBreakdown.avgAnesthesiaTime,
    avgClosingTime: timeBreakdown.avgClosingTime,
    avgEmergenceTime: timeBreakdown.avgEmergenceTime
  }
}