// types/time-off.ts
// Type definitions for time-off requests (Staff Schedule feature)

// =====================================================
// ENUMS / UNION TYPES
// =====================================================

export type TimeOffRequestType = 'pto' | 'sick' | 'personal'
export type TimeOffStatus = 'pending' | 'approved' | 'denied'
export type PartialDayType = 'am' | 'pm'

// =====================================================
// DATABASE TYPES
// =====================================================

/** A time-off request row from time_off_requests table */
export interface TimeOffRequest {
  id: string
  facility_id: string
  user_id: string
  request_type: TimeOffRequestType
  start_date: string // "YYYY-MM-DD"
  end_date: string   // "YYYY-MM-DD"
  partial_day_type: PartialDayType | null
  reason: string | null
  status: TimeOffStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
  is_active: boolean
  // Joined data (optional)
  user?: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
  reviewer?: {
    id: string
    first_name: string
    last_name: string
  }
  user_role?: {
    role_id: string
    role?: {
      id: string
      name: string
    }
  }
}

// =====================================================
// INPUT TYPES
// =====================================================

/** Input for creating a new time-off request (excludes generated fields) */
export interface TimeOffRequestInput {
  facility_id: string
  user_id: string
  request_type: TimeOffRequestType
  start_date: string
  end_date: string
  partial_day_type?: PartialDayType | null
  reason?: string | null
}

/** Input for reviewing (approve/deny) a request */
export interface TimeOffReviewInput {
  status: 'approved' | 'denied'
  reviewed_by: string
  review_notes?: string | null
}

// =====================================================
// AGGREGATED / DISPLAY TYPES
// =====================================================

/** Per-user time-off totals by type for a given year */
export interface UserTimeOffSummary {
  user_id: string
  pto_days: number
  sick_days: number
  personal_days: number
  total_days: number
}

/** Filter parameters for fetching time-off requests */
export interface TimeOffFilterParams {
  status?: TimeOffStatus
  userId?: string
  roleId?: string
  dateRange?: {
    start: string // "YYYY-MM-DD"
    end: string   // "YYYY-MM-DD"
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/** Label map for request types */
export const REQUEST_TYPE_LABELS: Record<TimeOffRequestType, string> = {
  pto: 'PTO',
  sick: 'Sick',
  personal: 'Personal',
}

/** Label map for status values */
export const STATUS_LABELS: Record<TimeOffStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  denied: 'Denied',
}

/**
 * Calculate business days between two dates (inclusive).
 * Partial days count as 0.5.
 */
export function calculateBusinessDays(
  startDate: string,
  endDate: string,
  partialDayType?: PartialDayType | null,
): number {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  let count = 0
  const current = new Date(start)

  while (current <= end) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }

  // Partial day: the request spans a single day (DB constraint enforces this),
  // so if partial_day_type is set, count as 0.5 instead of 1
  if (partialDayType && count > 0) {
    count = count - 1 + 0.5
  }

  return count
}

// =====================================================
// HOLIDAY-AWARE PTO CALCULATION
// =====================================================

import type { FacilityHoliday } from '@/types/block-scheduling'

/** Breakdown of PTO calculation for display in review modal / summaries */
export interface PTOBreakdown {
  totalCalendarDays: number
  weekendDays: number
  holidayDays: number
  ptoDaysCharged: number
  holidays: { name: string; date: string; isPartial: boolean }[]
}

/** Format a Date to YYYY-MM-DD */
function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Find the Nth occurrence of a weekday in a month (1-indexed).
 * n=5 means "last occurrence".
 */
function getNthWeekdayOfMonth(year: number, month: number, dayOfWeek: number, n: number): Date | null {
  if (n === 5) {
    const lastDay = new Date(year, month + 1, 0)
    const d = new Date(lastDay)
    while (d.getDay() !== dayOfWeek) d.setDate(d.getDate() - 1)
    return d
  }
  let count = 0
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    if (d.getDay() === dayOfWeek) {
      count++
      if (count === n) return new Date(d)
    }
    d.setDate(d.getDate() + 1)
  }
  return null
}

/**
 * Resolve recurring facility holiday rules to actual dates within a range.
 * Returns a Map of dateStr → { name, isPartial }.
 */
export function resolveHolidayDatesForRange(
  holidays: FacilityHoliday[],
  startDate: string,
  endDate: string,
): Map<string, { name: string; isPartial: boolean; partialCloseTime: string | null }> {
  const result = new Map<string, { name: string; isPartial: boolean; partialCloseTime: string | null }>()
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const startYear = start.getFullYear()
  const endYear = end.getFullYear()

  for (let year = startYear; year <= endYear; year++) {
    for (const h of holidays) {
      if (!h.is_active) continue

      let resolved: Date | null = null

      if (h.day !== null) {
        // Fixed date holiday (e.g., Dec 25)
        resolved = new Date(year, h.month - 1, h.day)
      } else if (h.week_of_month !== null && h.day_of_week !== null) {
        // Dynamic date holiday (e.g., 4th Thursday of November)
        resolved = getNthWeekdayOfMonth(year, h.month - 1, h.day_of_week, h.week_of_month)
      }

      if (resolved && resolved >= start && resolved <= end) {
        const ds = toDateStr(resolved)
        result.set(ds, { name: h.name, isPartial: h.is_partial, partialCloseTime: h.is_partial ? (h.partial_close_time ?? null) : null })
      }
    }
  }

  return result
}

/**
 * Calculate holiday-aware business days between two dates (inclusive).
 * Holidays that fall on weekdays within the range are subtracted from PTO count.
 * Returns a full breakdown for display in review modals.
 */
export function calculateBusinessDaysWithHolidays(
  startDate: string,
  endDate: string,
  partialDayType: PartialDayType | null,
  holidays: FacilityHoliday[],
): PTOBreakdown {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  // Resolve holidays in range
  const holidayMap = resolveHolidayDatesForRange(holidays, startDate, endDate)

  let totalCalendarDays = 0
  let weekendDays = 0
  let holidayDays = 0
  const matchedHolidays: PTOBreakdown['holidays'] = []
  const current = new Date(start)

  while (current <= end) {
    totalCalendarDays++
    const dow = current.getDay()
    const dateStr = toDateStr(current)

    if (dow === 0 || dow === 6) {
      weekendDays++
    } else {
      // It's a weekday — check if it's a holiday
      const holiday = holidayMap.get(dateStr)
      if (holiday) {
        // Full-day holiday: subtract 1 full day
        // Partial holiday: subtract 0.5 day
        holidayDays += holiday.isPartial ? 0.5 : 1
        matchedHolidays.push({
          name: holiday.name,
          date: dateStr,
          isPartial: holiday.isPartial,
        })
      }
    }

    current.setDate(current.getDate() + 1)
  }

  let ptoDaysCharged = totalCalendarDays - weekendDays - holidayDays

  // Partial day PTO: single-day request where user takes only AM or PM off
  if (partialDayType && ptoDaysCharged > 0) {
    ptoDaysCharged = ptoDaysCharged - 1 + 0.5
  }

  // Ensure non-negative
  ptoDaysCharged = Math.max(0, ptoDaysCharged)

  return {
    totalCalendarDays,
    weekendDays,
    holidayDays,
    ptoDaysCharged,
    holidays: matchedHolidays,
  }
}
