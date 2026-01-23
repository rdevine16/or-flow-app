// types/pace.ts
// TypeScript interfaces for pace tracking - UPDATED for median-based statistics

export type PaceStatus = 'ahead' | 'onPace' | 'slightlyBehind' | 'behind'

// Helper type for Supabase joined data (can be array or single object)
// MUST be defined before interfaces that use it
type JoinedData<T> = T | T[] | null

// Helper function to safely get value from Supabase joined data
export function getJoinedValue<T>(data: JoinedData<T>): T | null {
  if (!data) return null
  if (Array.isArray(data)) return data[0] || null
  return data
}

// DEPRECATED - keeping for reference, use SurgeonProcedureStats instead
export interface SurgeonProcedureAverage {
  id: string
  surgeon_id: string
  procedure_type_id: string
  avg_total_minutes: number
  sample_size: number
  updated_at?: string
}

// DEPRECATED - keeping for reference, use SurgeonMilestoneStats instead
export interface SurgeonMilestoneAverage {
  id: string
  surgeon_id: string
  procedure_type_id: string
  milestone_type_id: string
  avg_minutes_from_start: number
  sample_size: number
  updated_at?: string
}

// NEW: Median-based procedure stats from materialized view
export interface SurgeonProcedureStats {
  facility_id: string
  surgeon_id: string
  procedure_type_id: string
  sample_size: number
  median_duration: number
  p25_duration: number | null
  p75_duration: number | null
  avg_duration: number | null
  stddev_duration: number | null
}

// NEW: Median-based milestone stats from materialized view
export interface SurgeonMilestoneStats {
  facility_id: string
  surgeon_id: string
  procedure_type_id: string
  milestone_type_id: string
  milestone_name: string
  sample_size: number
  median_minutes_from_start: number
  p25_minutes_from_start: number | null
  p75_minutes_from_start: number | null
  avg_minutes_from_start: number | null
  stddev_minutes_from_start: number | null
}

// UPDATED: CasePaceData now uses median-based values
export interface CasePaceData {
  scheduledStart: Date           // From cases.start_time combined with scheduled_date
  
  // Milestone timing (median-based)
  expectedMinutesToMilestone: number    // Surgeon's typical time to current milestone
  milestoneRangeLow: number | null      // p25 - fast end of typical range
  milestoneRangeHigh: number | null     // p75 - slow end of typical range
  
  // Total duration (median-based)
  expectedTotalMinutes: number          // Surgeon's typical total case time
  totalRangeLow: number | null          // p25 - fast end of typical range
  totalRangeHigh: number | null         // p75 - slow end of typical range
  
  // Metadata
  sampleSize: number
  currentMilestoneName: string
}

export interface MilestoneWithType {
  case_id: string
  recorded_at: string
  milestone_types: JoinedData<{ name: string }>
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
  upcomingCases: EnhancedCase[]   // All scheduled cases (including next)
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
  operative_side?: string | null
  or_room_id: string | null
  procedure_type_id: string | null
  surgeon_id: string | null
  called_back_at?: string | null
  called_back_by?: string | null
  // Supabase can return these as arrays or single objects depending on the relationship
  or_rooms: JoinedData<{ name: string }>
  procedure_types: JoinedData<{ name: string }>
  case_statuses: JoinedData<{ name: string }>
  surgeon: JoinedData<{ first_name: string; last_name: string }>
}