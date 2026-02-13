// types/block-scheduling.ts
// Type definitions for block scheduling feature

// =====================================================
// DATABASE TYPES
// =====================================================

export interface BlockSchedule {
  id: string
  facility_id: string
  surgeon_id: string
  day_of_week: number // 0 = Sunday, 6 = Saturday
  start_time: string // "07:00:00"
  end_time: string // "15:00:00"
  recurrence_type: RecurrenceType
  effective_start: string // "2026-01-01"
  effective_end: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface FacilityHoliday {
  id: string
  facility_id: string
  name: string
  month: number // 1-12
  day: number | null // For fixed date holidays
  week_of_month: number | null // 1-5 (5 = last)
  day_of_week: number | null // 0-6 for dynamic holidays
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface FacilityClosure {
  id: string
  facility_id: string
  closure_date: string // "2026-02-14"
  reason: string | null
  created_by: string | null
  created_at: string
}

export interface SurgeonColor {
  id: string
  facility_id: string
  surgeon_id: string
  color: string // "#3B82F6"
  created_at: string
}

// =====================================================
// EXPANDED TYPES (from RPC function)
// =====================================================

export interface ExpandedBlock {
  block_id: string
  surgeon_id: string
  surgeon_first_name: string
  surgeon_last_name: string
  surgeon_color: string
  block_date: string // "2026-01-23"
  start_time: string
  end_time: string
  recurrence_type: RecurrenceType
  is_facility_closed: boolean
}

// =====================================================
// ENUMS & CONSTANTS
// =====================================================

export type RecurrenceType =
  | 'weekly'
  | 'first_third_fifth'
  | 'second_fourth'
  | 'first_only'
  | 'second_only'
  | 'third_only'
  | 'fourth_only'
  | 'last_only'

export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  weekly: 'Every week',
  first_third_fifth: '1st, 3rd & 5th week',
  second_fourth: '2nd & 4th week',
  first_only: '1st week only',
  second_only: '2nd week only',
  third_only: '3rd week only',
  fourth_only: '4th week only',
  last_only: 'Last week of month',
}

export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
}

export const DAY_OF_WEEK_SHORT: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
}

export const MONTH_LABELS: Record<number, string> = {
  1: 'January',
  2: 'February',
  3: 'March',
  4: 'April',
  5: 'May',
  6: 'June',
  7: 'July',
  8: 'August',
  9: 'September',
  10: 'October',
  11: 'November',
  12: 'December',
}

// Re-export from canonical source (lib/design-tokens.ts)
import { surgeonPalette, getNextSurgeonColor } from '@/lib/design-tokens'
export const SURGEON_COLOR_PALETTE = surgeonPalette.hex

// =====================================================
// INPUT TYPES (for create/update)
// =====================================================

export interface CreateBlockInput {
  surgeon_id: string
  day_of_week: number
  start_time: string
  end_time: string
  recurrence_type: RecurrenceType
  effective_start: string
  effective_end?: string | null
  notes?: string | null
}

export interface UpdateBlockInput {
  day_of_week?: number
  start_time?: string
  end_time?: string
  recurrence_type?: RecurrenceType
  effective_end?: string | null
  notes?: string | null
}

export interface CreateHolidayInput {
  name: string
  month: number
  day?: number | null
  week_of_month?: number | null
  day_of_week?: number | null
}

export interface CreateClosureInput {
  closure_date: string
  reason?: string | null
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export function formatTime12Hour(time: string): string {
  // Convert "07:00:00" to "7:00 AM"
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime12Hour(start)} - ${formatTime12Hour(end)}`
}

export function getRecurrenceLabel(type: RecurrenceType, dayOfWeek: number): string {
  const dayName = DAY_OF_WEEK_LABELS[dayOfWeek]
  switch (type) {
    case 'weekly':
      return `Every ${dayName}`
    case 'first_third_fifth':
      return `1st, 3rd & 5th ${dayName}`
    case 'second_fourth':
      return `2nd & 4th ${dayName}`
    case 'first_only':
      return `1st ${dayName} of month`
    case 'second_only':
      return `2nd ${dayName} of month`
    case 'third_only':
      return `3rd ${dayName} of month`
    case 'fourth_only':
      return `4th ${dayName} of month`
    case 'last_only':
      return `Last ${dayName} of month`
    default:
      return type
  }
}

export function getHolidayDateDescription(holiday: FacilityHoliday): string {
  const monthName = MONTH_LABELS[holiday.month]
  
  if (holiday.day !== null) {
    // Fixed date
    return `${monthName} ${holiday.day}`
  }
  
  if (holiday.week_of_month !== null && holiday.day_of_week !== null) {
    // Dynamic date
    const dayName = DAY_OF_WEEK_LABELS[holiday.day_of_week]
    const weekLabel = holiday.week_of_month === 5 ? 'Last' : `${holiday.week_of_month}${getOrdinalSuffix(holiday.week_of_month)}`
    return `${weekLabel} ${dayName} of ${monthName}`
  }
  
  return 'Invalid date'
}

function getOrdinalSuffix(n: number): string {
  if (n === 1) return 'st'
  if (n === 2) return 'nd'
  if (n === 3) return 'rd'
  return 'th'
}

export function getNextAvailableColor(usedColors: string[]): string {
  const usedSet = new Set(usedColors)
  return getNextSurgeonColor(usedSet)
}