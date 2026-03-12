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
