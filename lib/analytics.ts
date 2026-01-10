// Analytics calculation helpers

export interface CaseWithMilestones {
  id: string
  case_number: string
  scheduled_date: string
  start_time: string | null
  surgeon_id: string | null
  surgeon: { first_name: string; last_name: string } | null
  procedure_types: { id: string; name: string } | null
  or_rooms: { id: string; name: string } | null
  case_milestones: {
    milestone_type_id: string
    recorded_at: string
    milestone_types: { name: string } | null
  }[]
}

export interface MilestoneMap {
  [key: string]: string | null // milestone name -> recorded_at
}

// Build a map of milestone name -> timestamp for a case
export function getMilestoneMap(caseData: CaseWithMilestones): MilestoneMap {
  const map: MilestoneMap = {}
  caseData.case_milestones?.forEach(m => {
    const name = Array.isArray(m.milestone_types) 
      ? m.milestone_types[0]?.name 
      : m.milestone_types?.name
    if (name) {
      map[name] = m.recorded_at
    }
  })
  return map
}

// ============================================
// DURATION CALCULATIONS
// ============================================

// Calculate duration between two timestamps in seconds
export function calculateDurationSeconds(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const diffMs = new Date(end).getTime() - new Date(start).getTime()
  return Math.round(diffMs / 1000)
}

// Calculate duration between two timestamps in minutes
export function calculateDurationMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const diffMs = new Date(end).getTime() - new Date(start).getTime()
  return Math.round(diffMs / (1000 * 60))
}

// ============================================
// FORMATTING FUNCTIONS
// ============================================

// Format seconds to HH:MM:SS
export function formatSecondsToHHMMSS(totalSeconds: number | null): string {
  if (totalSeconds === null) return '--:--:--'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

// Format seconds to human readable (e.g., "1h 23m 45s" or "23m 45s" or "45s")
export function formatSecondsHuman(totalSeconds: number | null): string {
  if (totalSeconds === null) return '-'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

// Format seconds to display (calls formatSecondsToHHMMSS)
export function formatDurationHHMMSS(totalSeconds: number | null): string {
  return formatSecondsToHHMMSS(totalSeconds)
}

// Alias for backwards compatibility - NOW EXPECTS SECONDS
export function formatMinutesToHHMMSS(seconds: number | null): string {
  return formatSecondsToHHMMSS(seconds)
}

// Format minutes to human readable (legacy)
export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '-'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

// Format time from timestamp to display time (e.g., "06:06 am")
export function formatTimeFromTimestamp(timestamp: string | null): string {
  if (!timestamp) return '--:-- --'
  
  let hours: number
  let minutes: number
  
  if (timestamp.includes('T')) {
    const timePart = timestamp.split('T')[1]
    const timeOnly = timePart.split(/[Z+\-]/)[0]
    const [h, m] = timeOnly.split(':')
    hours = parseInt(h)
    minutes = parseInt(m)
  } else {
    const date = new Date(timestamp)
    hours = date.getUTCHours()
    minutes = date.getUTCMinutes()
  }
  
  const ampm = hours >= 12 ? 'pm' : 'am'
  const displayHour = hours % 12 || 12
  return `${displayHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`
}

// ============================================
// PHASE TIME CALCULATIONS (return seconds)
// ============================================

// Total OR Time: patient_in -> patient_out
export function getTotalORTime(milestones: MilestoneMap): number | null {
  return calculateDurationSeconds(milestones.patient_in, milestones.patient_out)
}

// Surgical Time (Working Time): incision -> closing
export function getSurgicalTime(milestones: MilestoneMap): number | null {
  return calculateDurationSeconds(milestones.incision, milestones.closing)
}

// Wheels-in to Incision: patient_in -> incision
export function getWheelsInToIncision(milestones: MilestoneMap): number | null {
  return calculateDurationSeconds(milestones.patient_in, milestones.incision)
}

// Incision to Closing: incision -> closing
export function getIncisionToClosing(milestones: MilestoneMap): number | null {
  return calculateDurationSeconds(milestones.incision, milestones.closing)
}

// Closing Time: closing -> closing_complete
export function getClosingTime(milestones: MilestoneMap): number | null {
  return calculateDurationSeconds(milestones.closing, milestones.closing_complete)
}

// Closed to Wheels-Out: closing_complete -> patient_out
export function getClosedToWheelsOut(milestones: MilestoneMap): number | null {
  return calculateDurationSeconds(milestones.closing_complete, milestones.patient_out)
}

// Room Turnover: patient_out -> room_cleaned
export function getRoomTurnoverTime(milestones: MilestoneMap): number | null {
  return calculateDurationSeconds(milestones.patient_out, milestones.room_cleaned)
}

// ============================================
// LEGACY FUNCTIONS (return seconds now)
// ============================================

export function getTotalCaseTime(milestones: MilestoneMap): number | null {
  return calculateDurationSeconds(milestones.patient_in, milestones.patient_out)
}

export function getPreOpTime(milestones: MilestoneMap): number | null {
  return calculateDurationSeconds(milestones.patient_in, milestones.incision)
}

export function getAnesthesiaTime(milestones: MilestoneMap): number | null {
  return calculateDurationSeconds(milestones.anes_start, milestones.anes_end)
}

// ============================================
// STATISTICS FUNCTIONS
// ============================================

export function calculateAverage(numbers: (number | null)[]): number | null {
  const validNumbers = numbers.filter((n): n is number => n !== null)
  if (validNumbers.length === 0) return null
  return Math.round(validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length)
}

export function calculateSum(numbers: (number | null)[]): number | null {
  const validNumbers = numbers.filter((n): n is number => n !== null)
  if (validNumbers.length === 0) return null
  return validNumbers.reduce((a, b) => a + b, 0)
}

export function calculateStdDev(numbers: (number | null)[]): number | null {
  const validNumbers = numbers.filter((n): n is number => n !== null)
  if (validNumbers.length < 2) return null
  const avg = validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length
  const squareDiffs = validNumbers.map(n => Math.pow(n - avg, 2))
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / validNumbers.length
  return Math.round(Math.sqrt(avgSquareDiff))
}

export function calculateMedian(numbers: (number | null)[]): number | null {
  const validNumbers = numbers.filter((n): n is number => n !== null).sort((a, b) => a - b)
  if (validNumbers.length === 0) return null
  const mid = Math.floor(validNumbers.length / 2)
  return validNumbers.length % 2 !== 0
    ? validNumbers[mid]
    : Math.round((validNumbers[mid - 1] + validNumbers[mid]) / 2)
}

export function calculatePercentageChange(current: number | null, baseline: number | null): number | null {
  if (current === null || baseline === null || baseline === 0) return null
  return Math.round(((baseline - current) / baseline) * 100)
}

export function getMilestoneDuration(
  milestones: MilestoneMap,
  startMilestone: string,
  endMilestone: string
): number | null {
  return calculateDurationSeconds(milestones[startMilestone], milestones[endMilestone])
}

// ============================================
// ON-TIME START CALCULATIONS
// ============================================

// On-time threshold in minutes (case starts within X minutes of scheduled time)
const ON_TIME_THRESHOLD_MINUTES = 5

// Check if a case started on time (within threshold of scheduled start)
export function isOnTimeStart(caseData: CaseWithMilestones, thresholdMinutes: number = ON_TIME_THRESHOLD_MINUTES): boolean | null {
  const milestones = getMilestoneMap(caseData)
  if (!caseData.start_time || !milestones.patient_in) return null
  
  // Parse scheduled start time (HH:MM:SS format)
  const [schedHours, schedMinutes] = caseData.start_time.split(':').map(Number)
  
  // Parse actual start time from patient_in milestone
  const actualStart = new Date(milestones.patient_in)
  const actualHours = actualStart.getUTCHours()
  const actualMinutes = actualStart.getUTCMinutes()
  
  // Calculate difference in minutes
  const scheduledTotalMinutes = schedHours * 60 + schedMinutes
  const actualTotalMinutes = actualHours * 60 + actualMinutes
  const diffMinutes = actualTotalMinutes - scheduledTotalMinutes
  
  // On time if started within threshold (can be early or slightly late)
  return diffMinutes <= thresholdMinutes
}

// Get the delay in minutes (positive = late, negative = early)
export function getStartDelayMinutes(caseData: CaseWithMilestones): number | null {
  const milestones = getMilestoneMap(caseData)
  if (!caseData.start_time || !milestones.patient_in) return null
  
  const [schedHours, schedMinutes] = caseData.start_time.split(':').map(Number)
  const actualStart = new Date(milestones.patient_in)
  const actualHours = actualStart.getUTCHours()
  const actualMinutes = actualStart.getUTCMinutes()
  
  const scheduledTotalMinutes = schedHours * 60 + schedMinutes
  const actualTotalMinutes = actualHours * 60 + actualMinutes
  
  return actualTotalMinutes - scheduledTotalMinutes
}

// Check if this is a first case of the day for its room
export function isFirstCaseOfDay(caseData: CaseWithMilestones, allCases: CaseWithMilestones[]): boolean {
  const room = Array.isArray(caseData.or_rooms) ? caseData.or_rooms[0] : caseData.or_rooms
  if (!room?.id || !caseData.start_time) return false
  
  // Find all cases in the same room on the same day
  const sameDayRoomCases = allCases.filter(c => {
    const cRoom = Array.isArray(c.or_rooms) ? c.or_rooms[0] : c.or_rooms
    return cRoom?.id === room.id && 
           c.scheduled_date === caseData.scheduled_date &&
           c.start_time
  })
  
  // Sort by start time and check if this case is first
  sameDayRoomCases.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
  return sameDayRoomCases[0]?.id === caseData.id
}

// ============================================
// FIRST CASE ON-TIME START ANALYTICS
// ============================================

export interface FirstCaseAnalysis {
  totalFirstCases: number
  onTimeCount: number
  lateCount: number
  onTimeRate: number // percentage
  avgDelayMinutes: number | null
  lateCases: {
    caseData: CaseWithMilestones
    delayMinutes: number
    surgeonName: string
    roomName: string
  }[]
}

export function analyzeFirstCaseStarts(cases: CaseWithMilestones[]): FirstCaseAnalysis {
  const firstCases = cases.filter(c => isFirstCaseOfDay(c, cases))
  
  const analyzed = firstCases.map(c => ({
    caseData: c,
    isOnTime: isOnTimeStart(c),
    delayMinutes: getStartDelayMinutes(c),
    surgeonName: c.surgeon 
      ? `Dr. ${Array.isArray(c.surgeon) ? c.surgeon[0]?.last_name : c.surgeon.last_name}`
      : 'Unknown',
    roomName: Array.isArray(c.or_rooms) ? c.or_rooms[0]?.name : c.or_rooms?.name || 'Unknown'
  })).filter(a => a.isOnTime !== null)
  
  const onTimeCount = analyzed.filter(a => a.isOnTime).length
  const lateCount = analyzed.filter(a => !a.isOnTime).length
  const delays = analyzed.filter(a => a.delayMinutes !== null && a.delayMinutes > 0).map(a => a.delayMinutes!)
  
  return {
    totalFirstCases: analyzed.length,
    onTimeCount,
    lateCount,
    onTimeRate: analyzed.length > 0 ? Math.round((onTimeCount / analyzed.length) * 100) : 0,
    avgDelayMinutes: calculateAverage(delays),
    lateCases: analyzed
      .filter(a => !a.isOnTime && a.delayMinutes !== null)
      .map(a => ({
        caseData: a.caseData,
        delayMinutes: a.delayMinutes!,
        surgeonName: a.surgeonName,
        roomName: a.roomName
      }))
      .sort((a, b) => b.delayMinutes - a.delayMinutes)
  }
}

// ============================================
// OVERALL ON-TIME START ANALYTICS
// ============================================

export interface OnTimeAnalysis {
  totalCases: number
  onTimeCount: number
  lateCount: number
  onTimeRate: number
  avgDelayMinutes: number | null
  lateCases: {
    caseData: CaseWithMilestones
    delayMinutes: number
    surgeonName: string
    roomName: string
    isFirstCase: boolean
  }[]
}

export function analyzeOnTimeStarts(cases: CaseWithMilestones[]): OnTimeAnalysis {
  const analyzed = cases.map(c => ({
    caseData: c,
    isOnTime: isOnTimeStart(c),
    delayMinutes: getStartDelayMinutes(c),
    surgeonName: c.surgeon 
      ? `Dr. ${Array.isArray(c.surgeon) ? c.surgeon[0]?.last_name : c.surgeon.last_name}`
      : 'Unknown',
    roomName: Array.isArray(c.or_rooms) ? c.or_rooms[0]?.name : c.or_rooms?.name || 'Unknown',
    isFirstCase: isFirstCaseOfDay(c, cases)
  })).filter(a => a.isOnTime !== null)
  
  const onTimeCount = analyzed.filter(a => a.isOnTime).length
  const lateCount = analyzed.filter(a => !a.isOnTime).length
  const delays = analyzed.filter(a => a.delayMinutes !== null && a.delayMinutes > 0).map(a => a.delayMinutes!)
  
  return {
    totalCases: analyzed.length,
    onTimeCount,
    lateCount,
    onTimeRate: analyzed.length > 0 ? Math.round((onTimeCount / analyzed.length) * 100) : 0,
    avgDelayMinutes: calculateAverage(delays),
    lateCases: analyzed
      .filter(a => !a.isOnTime && a.delayMinutes !== null)
      .map(a => ({
        caseData: a.caseData,
        delayMinutes: a.delayMinutes!,
        surgeonName: a.surgeonName,
        roomName: a.roomName,
        isFirstCase: a.isFirstCase
      }))
      .sort((a, b) => b.delayMinutes - a.delayMinutes)
  }
}

// ============================================
// TURNOVER CALCULATIONS
// ============================================

const TURNOVER_TARGET_MINUTES = 30

export interface TurnoverData {
  fromCase: CaseWithMilestones
  toCase: CaseWithMilestones
  turnoverMinutes: number
  roomName: string
  date: string
  metTarget: boolean
}

export interface TurnoverAnalysis {
  totalTurnovers: number
  avgTurnoverMinutes: number | null
  medianTurnoverMinutes: number | null
  metTargetCount: number
  exceededTargetCount: number
  complianceRate: number // percentage meeting target
  longestTurnover: number | null
  shortestTurnover: number | null
  turnovers: TurnoverData[]
}

export function analyzeTurnovers(cases: CaseWithMilestones[], targetMinutes: number = TURNOVER_TARGET_MINUTES): TurnoverAnalysis {
  // Group cases by room AND date
  const casesByRoomAndDate: { [key: string]: CaseWithMilestones[] } = {}
  
  cases.forEach(c => {
    const room = Array.isArray(c.or_rooms) ? c.or_rooms[0] : c.or_rooms
    if (!room?.id) return
    
    const key = `${room.id}_${c.scheduled_date}`
    if (!casesByRoomAndDate[key]) {
      casesByRoomAndDate[key] = []
    }
    casesByRoomAndDate[key].push(c)
  })

  const turnovers: TurnoverData[] = []

  Object.entries(casesByRoomAndDate).forEach(([key, roomCases]) => {
    const [roomId, date] = key.split('_')
    
    // Sort by start time
    const sortedCases = roomCases.sort((a, b) => {
      const aTime = a.start_time || ''
      const bTime = b.start_time || ''
      return aTime.localeCompare(bTime)
    })

    // Calculate turnover between consecutive cases
    for (let i = 0; i < sortedCases.length - 1; i++) {
      const currentCase = sortedCases[i]
      const nextCase = sortedCases[i + 1]
      
      const currentMilestones = getMilestoneMap(currentCase)
      const nextMilestones = getMilestoneMap(nextCase)
      
      if (currentMilestones.patient_out && nextMilestones.patient_in) {
        const turnoverTime = calculateDurationMinutes(
          currentMilestones.patient_out,
          nextMilestones.patient_in
        )
        
        // Only include reasonable turnover times (between 5 and 120 minutes)
        if (turnoverTime !== null && turnoverTime >= 5 && turnoverTime <= 120) {
          const room = Array.isArray(currentCase.or_rooms) ? currentCase.or_rooms[0] : currentCase.or_rooms
          turnovers.push({
            fromCase: currentCase,
            toCase: nextCase,
            turnoverMinutes: turnoverTime,
            roomName: room?.name || 'Unknown',
            date: currentCase.scheduled_date,
            metTarget: turnoverTime <= targetMinutes
          })
        }
      }
    }
  })

  const turnoverTimes = turnovers.map(t => t.turnoverMinutes)
  const metTargetCount = turnovers.filter(t => t.metTarget).length
  
  return {
    totalTurnovers: turnovers.length,
    avgTurnoverMinutes: calculateAverage(turnoverTimes),
    medianTurnoverMinutes: calculateMedian(turnoverTimes),
    metTargetCount,
    exceededTargetCount: turnovers.length - metTargetCount,
    complianceRate: turnovers.length > 0 ? Math.round((metTargetCount / turnovers.length) * 100) : 0,
    longestTurnover: turnoverTimes.length > 0 ? Math.max(...turnoverTimes) : null,
    shortestTurnover: turnoverTimes.length > 0 ? Math.min(...turnoverTimes) : null,
    turnovers: turnovers.sort((a, b) => b.turnoverMinutes - a.turnoverMinutes)
  }
}

// Get all turnovers for a set of cases (convenience function - returns minutes)
export function getAllTurnovers(cases: CaseWithMilestones[]): number[] {
  return analyzeTurnovers(cases).turnovers.map(t => t.turnoverMinutes)
}

export function calculateRoomTurnovers(cases: CaseWithMilestones[]): number[] {
  return getAllTurnovers(cases)
}

// ============================================
// ROOM UTILIZATION
// ============================================

export interface RoomUtilization {
  roomId: string
  roomName: string
  totalAvailableMinutes: number // e.g., 8 hours = 480 min
  totalUsedMinutes: number
  utilizationRate: number // percentage
  caseCount: number
  avgCaseTime: number | null
}

export interface UtilizationAnalysis {
  overallUtilization: number
  totalRooms: number
  rooms: RoomUtilization[]
}

export function analyzeRoomUtilization(
  cases: CaseWithMilestones[], 
  availableMinutesPerRoom: number = 480, // 8 hours default
  roomCount?: number
): UtilizationAnalysis {
  // Group cases by room
  const casesByRoom: { [key: string]: CaseWithMilestones[] } = {}
  
  cases.forEach(c => {
    const room = Array.isArray(c.or_rooms) ? c.or_rooms[0] : c.or_rooms
    if (!room?.id) return
    
    if (!casesByRoom[room.id]) {
      casesByRoom[room.id] = []
    }
    casesByRoom[room.id].push(c)
  })

  const rooms: RoomUtilization[] = Object.entries(casesByRoom).map(([roomId, roomCases]) => {
    const room = Array.isArray(roomCases[0].or_rooms) ? roomCases[0].or_rooms[0] : roomCases[0].or_rooms
    
    // Calculate total used time (sum of all case times)
    const caseTimes = roomCases.map(c => {
      const milestones = getMilestoneMap(c)
      return calculateDurationMinutes(milestones.patient_in, milestones.patient_out)
    }).filter((t): t is number => t !== null)
    
    const totalUsedMinutes = caseTimes.reduce((sum, t) => sum + t, 0)
    
    // Get unique dates to calculate total available time
    const uniqueDates = new Set(roomCases.map(c => c.scheduled_date))
    const totalAvailableMinutes = uniqueDates.size * availableMinutesPerRoom
    
    return {
      roomId,
      roomName: room?.name || 'Unknown',
      totalAvailableMinutes,
      totalUsedMinutes,
      utilizationRate: totalAvailableMinutes > 0 
        ? Math.round((totalUsedMinutes / totalAvailableMinutes) * 100) 
        : 0,
      caseCount: roomCases.length,
      avgCaseTime: calculateAverage(caseTimes)
    }
  })

  // Calculate overall utilization
  const totalAvailable = rooms.reduce((sum, r) => sum + r.totalAvailableMinutes, 0)
  const totalUsed = rooms.reduce((sum, r) => sum + r.totalUsedMinutes, 0)
  
  return {
    overallUtilization: totalAvailable > 0 ? Math.round((totalUsed / totalAvailable) * 100) : 0,
    totalRooms: rooms.length,
    rooms: rooms.sort((a, b) => b.utilizationRate - a.utilizationRate)
  }
}

// ============================================
// SURGEON PERFORMANCE SUMMARY
// ============================================

export interface SurgeonPerformance {
  surgeonId: string
  surgeonName: string
  caseCount: number
  avgCaseTime: number | null
  avgSurgicalTime: number | null
  onTimeRate: number
  lateStartCount: number
}

export function analyzeSurgeonPerformance(cases: CaseWithMilestones[]): SurgeonPerformance[] {
  // Group cases by surgeon
  const casesBySurgeon: { [key: string]: CaseWithMilestones[] } = {}
  
  cases.forEach(c => {
    if (!c.surgeon_id) return
    if (!casesBySurgeon[c.surgeon_id]) {
      casesBySurgeon[c.surgeon_id] = []
    }
    casesBySurgeon[c.surgeon_id].push(c)
  })

  return Object.entries(casesBySurgeon).map(([surgeonId, surgeonCases]) => {
    const surgeon = surgeonCases[0].surgeon
    const surgeonName = surgeon 
      ? `Dr. ${Array.isArray(surgeon) ? surgeon[0]?.first_name : surgeon.first_name} ${Array.isArray(surgeon) ? surgeon[0]?.last_name : surgeon.last_name}`
      : 'Unknown'
    
    // Calculate case times
    const caseTimes = surgeonCases.map(c => getTotalCaseTime(getMilestoneMap(c)))
    const surgicalTimes = surgeonCases.map(c => getSurgicalTime(getMilestoneMap(c)))
    
    // Calculate on-time starts
    const startsAnalyzed = surgeonCases.map(c => isOnTimeStart(c)).filter(r => r !== null)
    const onTimeCount = startsAnalyzed.filter(r => r).length
    const lateCount = startsAnalyzed.filter(r => !r).length
    
    return {
      surgeonId,
      surgeonName,
      caseCount: surgeonCases.length,
      avgCaseTime: calculateAverage(caseTimes),
      avgSurgicalTime: calculateAverage(surgicalTimes),
      onTimeRate: startsAnalyzed.length > 0 ? Math.round((onTimeCount / startsAnalyzed.length) * 100) : 0,
      lateStartCount: lateCount
    }
  }).sort((a, b) => b.caseCount - a.caseCount)
}

// ============================================
// WEEKLY/MONTHLY COMPARISON HELPERS
// ============================================

export interface PeriodComparison {
  current: number | null
  previous: number | null
  change: number | null // percentage change
  improved: boolean | null
}

export function comparePeriods(
  currentValue: number | null, 
  previousValue: number | null,
  lowerIsBetter: boolean = true
): PeriodComparison {
  const change = calculatePercentageChange(currentValue, previousValue)
  let improved: boolean | null = null
  
  if (change !== null) {
    improved = lowerIsBetter ? change > 0 : change < 0
  }
  
  return {
    current: currentValue,
    previous: previousValue,
    change,
    improved
  }
}

// ============================================
// CASE VOLUME BY DAY OF WEEK
// ============================================

export function getCaseVolumeByDayOfWeek(cases: CaseWithMilestones[]): { day: string; count: number }[] {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const counts: { [key: number]: number } = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  
  cases.forEach(c => {
    const [year, month, day] = c.scheduled_date.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    counts[date.getDay()]++
  })
  
  return dayNames.map((day, index) => ({ day, count: counts[index] }))
}

// ============================================
// PROCEDURE TYPE ANALYTICS
// ============================================

export interface ProcedureAnalytics {
  procedureId: string
  procedureName: string
  caseCount: number
  avgCaseTime: number | null
  avgSurgicalTime: number | null
}

export function analyzeProcedures(cases: CaseWithMilestones[]): ProcedureAnalytics[] {
  const casesByProcedure: { [key: string]: CaseWithMilestones[] } = {}
  
  cases.forEach(c => {
    const proc = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
    if (!proc?.id) return
    
    if (!casesByProcedure[proc.id]) {
      casesByProcedure[proc.id] = []
    }
    casesByProcedure[proc.id].push(c)
  })

  return Object.entries(casesByProcedure).map(([procId, procCases]) => {
    const proc = Array.isArray(procCases[0].procedure_types) 
      ? procCases[0].procedure_types[0] 
      : procCases[0].procedure_types
    
    const caseTimes = procCases.map(c => getTotalCaseTime(getMilestoneMap(c)))
    const surgicalTimes = procCases.map(c => getSurgicalTime(getMilestoneMap(c)))
    
    return {
      procedureId: procId,
      procedureName: proc?.name || 'Unknown',
      caseCount: procCases.length,
      avgCaseTime: calculateAverage(caseTimes),
      avgSurgicalTime: calculateAverage(surgicalTimes)
    }
  }).sort((a, b) => b.caseCount - a.caseCount)
}
