// types/pace.ts
// TypeScript interfaces for pace tracking - ported from iOS app

export type PaceStatus = 'ahead' | 'onPace' | 'slightlyBehind' | 'behind'

export interface SurgeonProcedureAverage {
  id: string
  surgeon_id: string
  procedure_type_id: string
  avg_total_minutes: number
  sample_size: number
  updated_at?: string
}

export interface SurgeonMilestoneAverage {
  id: string
  surgeon_id: string
  procedure_type_id: string
  milestone_type_id: string
  avg_minutes_from_start: number
  sample_size: number
  updated_at?: string
}

export interface CasePaceData {
  scheduledStart: Date           // From cases.start_time combined with scheduled_date
  avgMinutesToMilestone: number  // Surgeon avg to current milestone
  avgTotalMinutes: number        // Surgeon avg total case time
  sampleSize: number
  currentMilestoneName: string
}

export interface MilestoneWithType {
  case_id: string
  recorded_at: string
  milestone_types: {
    name: string
  } | null
}

export type CasePhase = 
  | 'Patient In'
  | 'In Anesthesia'
  | 'Prepping'
  | 'In Surgery'
  | 'Closing'
  | 'Complete'

export type RoomStatus = 'active' | 'upcoming' | 'empty'

export interface RoomWithCase {
  room: {
    id: string
    name: string
  }
  currentCase: EnhancedCase | null
  nextCase: EnhancedCase | null
  caseStartTime: Date | null      // First milestone time (actual start)
  currentPhase: CasePhase | null
  paceData: CasePaceData | null
}

export interface EnhancedCase {
  id: string
  case_number: string
  scheduled_date: string
  start_time: string | null
  facility_id: string
  or_room_id: string | null
  procedure_type_id: string | null
  surgeon_id: string | null
  or_rooms: { name: string } | null
  procedure_types: { name: string } | null
  case_statuses: { name: string } | null
  surgeon: { first_name: string; last_name: string } | null
}
