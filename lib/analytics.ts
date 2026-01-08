// Analytics calculation helpers

export interface CaseWithMilestones {
  id: string
  case_number: string
  scheduled_date: string
  start_time: string | null
  surgeon_id: string | null
  surgeon: { first_name: string; last_name: string } | null
  procedure_types: { id: string; name: string } | null
  or_rooms: { name: string } | null
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

// Format minutes to human readable
export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '-'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

// Calculate total case time (patient_in -> patient_out)
export function getTotalCaseTime(milestones: MilestoneMap): number | null {
  return calculateDurationMinutes(milestones.patient_in, milestones.patient_out)
}

// Calculate surgical time (incision -> closing)
export function getSurgicalTime(milestones: MilestoneMap): number | null {
  return calculateDurationMinutes(milestones.incision, milestones.closing)
}

// Calculate pre-op time (patient_in -> incision)
export function getPreOpTime(milestones: MilestoneMap): number | null {
  return calculateDurationMinutes(milestones.patient_in, milestones.incision)
}

// Calculate anesthesia time (anes_start -> anes_end)
export function getAnesthesiaTime(milestones: MilestoneMap): number | null {
  return calculateDurationMinutes(milestones.anes_start, milestones.anes_end)
}

// Calculate closing time (closing -> patient_out)
export function getClosingTime(milestones: MilestoneMap): number | null {
  return calculateDurationMinutes(milestones.closing, milestones.patient_out)
}

// Calculate average of an array of numbers
export function calculateAverage(numbers: (number | null)[]): number | null {
  const validNumbers = numbers.filter((n): n is number => n !== null)
  if (validNumbers.length === 0) return null
  return Math.round(validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length)
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

// Get milestone duration for a specific phase
export function getMilestoneDuration(
  milestones: MilestoneMap,
  startMilestone: string,
  endMilestone: string
): number | null {
  return calculateDurationMinutes(milestones[startMilestone], milestones[endMilestone])
}