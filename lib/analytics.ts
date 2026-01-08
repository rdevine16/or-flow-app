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

// Calculate duration between two timestamps in minutes
export function calculateDurationMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const diffMs = new Date(end).getTime() - new Date(start).getTime()
  return Math.round(diffMs / (1000 * 60))
}

// Calculate duration between two timestamps in seconds
export function calculateDurationSeconds(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const diffMs = new Date(end).getTime() - new Date(start).getTime()
  return Math.round(diffMs / 1000)
}

// Format seconds to HH:MM:SS
export function formatSecondsToHHMMSS(totalSeconds: number | null): string {
  if (totalSeconds === null) return '--:--:--'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

// Format minutes to HH:MM:SS
export function formatMinutesToHHMMSS(minutes: number | null): string {
  if (minutes === null) return '--:--:--'
  const totalSeconds = minutes * 60
  return formatSecondsToHHMMSS(totalSeconds)
}

// Format minutes to human readable (legacy - keep for backward compatibility)
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
// Extracts the time portion directly from the ISO string to avoid timezone conversion issues
export function formatTimeFromTimestamp(timestamp: string | null): string {
  if (!timestamp) return '--:-- --'
  
  // Parse the timestamp - if it contains 'T', extract time from ISO format
  // The database stores times that represent local time, so we extract directly
  let hours: number
  let minutes: number
  
  if (timestamp.includes('T')) {
    // ISO format: "2024-01-15T06:22:00.000Z" or "2024-01-15T06:22:00+00:00"
    const timePart = timestamp.split('T')[1]
    const timeOnly = timePart.split(/[Z+\-]/)[0] // Remove timezone suffix
    const [h, m] = timeOnly.split(':')
    hours = parseInt(h)
    minutes = parseInt(m)
  } else {
    // Fallback to Date parsing for other formats
    const date = new Date(timestamp)
    hours = date.getUTCHours()
    minutes = date.getUTCMinutes()
  }
  
  const ampm = hours >= 12 ? 'pm' : 'am'
  const displayHour = hours % 12 || 12
  return `${displayHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`
}

// ============================================
// PHASE TIME CALCULATIONS
// ============================================

// Total OR Time: patient_in -> patient_out
export function getTotalORTime(milestones: MilestoneMap): number | null {
  return calculateDurationMinutes(milestones.patient_in, milestones.patient_out)
}

// Surgical Time (Working Time): incision -> closing
export function getSurgicalTime(milestones: MilestoneMap): number | null {
  return calculateDurationMinutes(milestones.incision, milestones.closing)
}

// Wheels-in to Incision: patient_in -> incision
export function getWheelsInToIncision(milestones: MilestoneMap): number | null {
  return calculateDurationMinutes(milestones.patient_in, milestones.incision)
}

// Incision to Closing: incision -> closing (same as surgical time)
export function getIncisionToClosing(milestones: MilestoneMap): number | null {
  return calculateDurationMinutes(milestones.incision, milestones.closing)
}

// Closing Time: closing -> closing_complete
export function getClosingTime(milestones: MilestoneMap): number | null {
  return calculateDurationMinutes(milestones.closing, milestones.closing_complete)
}

// Closed to Wheels-Out: closing_complete -> patient_out
export function getClosedToWheelsOut(milestones: MilestoneMap): number | null {
  return calculateDurationMinutes(milestones.closing_complete, milestones.patient_out)
}

// Room Turnover: patient_out -> room_cleaned
export function getRoomTurnoverTime(milestones: MilestoneMap): number | null {
  return calculateDurationMinutes(milestones.patient_out, milestones.room_cleaned)
}

// ============================================
// LEGACY FUNCTIONS (for backward compatibility)
// ============================================

// Calculate total case time (patient_in -> patient_out)
export function getTotalCaseTime(milestones: MilestoneMap): number | null {
  return calculateDurationMinutes(milestones.patient_in, milestones.patient_out)
}

// Calculate pre-op time (patient_in -> incision)
export function getPreOpTime(milestones: MilestoneMap): number | null {
  return calculateDurationMinutes(milestones.patient_in, milestones.incision)
}

// Calculate anesthesia time (anes_start -> anes_end)
export function getAnesthesiaTime(milestones: MilestoneMap): number | null {
  return calculateDurationMinutes(milestones.anes_start, milestones.anes_end)
}

// ============================================
// STATISTICS FUNCTIONS
// ============================================

// Calculate average of an array of numbers
export function calculateAverage(numbers: (number | null)[]): number | null {
  const validNumbers = numbers.filter((n): n is number => n !== null)
  if (validNumbers.length === 0) return null
  return Math.round(validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length)
}

// Calculate sum of an array of numbers
export function calculateSum(numbers: (number | null)[]): number | null {
  const validNumbers = numbers.filter((n): n is number => n !== null)
  if (validNumbers.length === 0) return null
  return validNumbers.reduce((a, b) => a + b, 0)
}

// Calculate standard deviation
export function calculateStdDev(numbers: (number | null)[]): number | null {
  const validNumbers = numbers.filter((n): n is number => n !== null)
  if (validNumbers.length < 2) return null
  const avg = validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length
  const squareDiffs = validNumbers.map(n => Math.pow(n - avg, 2))
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / validNumbers.length
  return Math.round(Math.sqrt(avgSquareDiff))
}

// Calculate percentage change between two values
export function calculatePercentageChange(current: number | null, baseline: number | null): number | null {
  if (current === null || baseline === null || baseline === 0) return null
  return Math.round(((baseline - current) / baseline) * 100)
}

// Get milestone duration for a specific phase
export function getMilestoneDuration(
  milestones: MilestoneMap,
  startMilestone: string,
  endMilestone: string
): number | null {
  return calculateDurationMinutes(milestones[startMilestone], milestones[endMilestone])
}

// ============================================
// TURNOVER CALCULATIONS
// ============================================

// Calculate turnover time between consecutive cases in the same room
// Turnover = patient_out of case N to patient_in of case N+1 (same room, same day)
export function calculateRoomTurnovers(
  cases: CaseWithMilestones[]
): number[] {
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

  const turnovers: number[] = []

  // For each room+date combination, calculate turnovers between consecutive cases
  Object.values(casesByRoomAndDate).forEach(roomCases => {
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
      
      // Turnover = current patient_out -> next patient_in
      if (currentMilestones.patient_out && nextMilestones.patient_in) {
        const turnoverTime = calculateDurationMinutes(
          currentMilestones.patient_out,
          nextMilestones.patient_in
        )
        
        // Only include reasonable turnover times (between 5 and 120 minutes)
        // This filters out bad data or cases that aren't truly consecutive
        if (turnoverTime !== null && turnoverTime >= 5 && turnoverTime <= 120) {
          turnovers.push(turnoverTime)
        }
      }
    }
  })

  return turnovers
}

// Get all turnovers for a set of cases (convenience function)
export function getAllTurnovers(cases: CaseWithMilestones[]): number[] {
  return calculateRoomTurnovers(cases)
}
