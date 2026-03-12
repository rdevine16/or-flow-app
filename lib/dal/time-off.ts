/**
 * Time-Off Requests Data Access Layer
 *
 * CRUD operations for the time_off_requests table.
 * Used by the Staff Management admin page for viewing,
 * approving, and denying time-off requests.
 */

import type { AnySupabaseClient, DALResult, DALListResult } from './index'
import type {
  TimeOffRequest,
  TimeOffReviewInput,
  TimeOffFilterParams,
  UserTimeOffSummary,
} from '@/types/time-off'
import { calculateBusinessDays } from '@/types/time-off'
import { logger } from '@/lib/logger'

const log = logger('dal:time-off')

// ============================================
// SELECT STRINGS
// ============================================

const TIME_OFF_REQUEST_SELECT = `
  id,
  facility_id,
  user_id,
  request_type,
  start_date,
  end_date,
  partial_day_type,
  reason,
  status,
  reviewed_by,
  reviewed_at,
  review_notes,
  created_at,
  updated_at,
  is_active,
  user:users!time_off_requests_user_id_fkey(id, first_name, last_name, email),
  reviewer:users!time_off_requests_reviewed_by_fkey(id, first_name, last_name)
` as const

// ============================================
// DAL FUNCTIONS
// ============================================

export const timeOffDAL = {
  /**
   * Fetch all time-off requests for a facility (admin view).
   * Supports filtering by status, user, and date range.
   */
  async fetchFacilityRequests(
    supabase: AnySupabaseClient,
    facilityId: string,
    filters?: TimeOffFilterParams,
  ): Promise<DALListResult<TimeOffRequest>> {
    let query = supabase
      .from('time_off_requests')
      .select(TIME_OFF_REQUEST_SELECT)
      .eq('facility_id', facilityId)
      .eq('is_active', true)

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId)
    }

    if (filters?.dateRange) {
      // Overlapping range: request overlaps with the filter window
      query = query
        .lte('start_date', filters.dateRange.end)
        .gte('end_date', filters.dateRange.start)
    }

    query = query.order('start_date', { ascending: true })

    const { data, error } = await query

    if (error) {
      log.error('fetchFacilityRequests failed', { facilityId, error })
      return { data: [], error }
    }

    return {
      data: (data as unknown as TimeOffRequest[]) || [],
      error: null,
    }
  },

  /**
   * Review (approve or deny) a time-off request.
   */
  async reviewRequest(
    supabase: AnySupabaseClient,
    facilityId: string,
    requestId: string,
    review: TimeOffReviewInput,
  ): Promise<DALResult<TimeOffRequest>> {
    const { data, error } = await supabase
      .from('time_off_requests')
      .update({
        status: review.status,
        reviewed_by: review.reviewed_by,
        reviewed_at: new Date().toISOString(),
        review_notes: review.review_notes ?? null,
      })
      .eq('id', requestId)
      .eq('facility_id', facilityId)
      .eq('is_active', true)
      .select(TIME_OFF_REQUEST_SELECT)
      .single()

    if (error) {
      log.error('reviewRequest failed', { requestId, error })
      return { data: null, error }
    }

    return { data: data as unknown as TimeOffRequest, error: null }
  },

  /**
   * Fetch per-user time-off totals for a facility in a given year.
   * Only counts approved requests.
   */
  async fetchUserTimeOffTotals(
    supabase: AnySupabaseClient,
    facilityId: string,
    year: number,
  ): Promise<DALListResult<UserTimeOffSummary>> {
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    const { data, error } = await supabase
      .from('time_off_requests')
      .select('user_id, request_type, start_date, end_date, partial_day_type')
      .eq('facility_id', facilityId)
      .eq('status', 'approved')
      .eq('is_active', true)
      .gte('start_date', yearStart)
      .lte('start_date', yearEnd)

    if (error) {
      log.error('fetchUserTimeOffTotals failed', { facilityId, year, error })
      return { data: [], error }
    }

    // Aggregate client-side into per-user summaries
    const summaryMap = new Map<string, UserTimeOffSummary>()

    for (const row of (data || []) as unknown as {
      user_id: string
      request_type: string
      start_date: string
      end_date: string
      partial_day_type: string | null
    }[]) {
      const days = calculateBusinessDays(row.start_date, row.end_date, row.partial_day_type as 'am' | 'pm' | null)

      let summary = summaryMap.get(row.user_id)
      if (!summary) {
        summary = { user_id: row.user_id, pto_days: 0, sick_days: 0, personal_days: 0, total_days: 0 }
        summaryMap.set(row.user_id, summary)
      }

      if (row.request_type === 'pto') summary.pto_days += days
      else if (row.request_type === 'sick') summary.sick_days += days
      else if (row.request_type === 'personal') summary.personal_days += days

      summary.total_days += days
    }

    return {
      data: Array.from(summaryMap.values()),
      error: null,
    }
  },

  /**
   * Count available staff per date for coverage indicator.
   * Returns total active staff minus approved time-off for each date in range.
   */
  async fetchApprovedRequestsForDateRange(
    supabase: AnySupabaseClient,
    facilityId: string,
    startDate: string,
    endDate: string,
  ): Promise<DALListResult<TimeOffRequest>> {
    const { data, error } = await supabase
      .from('time_off_requests')
      .select('id, user_id, start_date, end_date, partial_day_type, request_type')
      .eq('facility_id', facilityId)
      .eq('status', 'approved')
      .eq('is_active', true)
      .lte('start_date', endDate)
      .gte('end_date', startDate)

    if (error) {
      log.error('fetchApprovedRequestsForDateRange failed', { facilityId, error })
      return { data: [], error }
    }

    return {
      data: (data as unknown as TimeOffRequest[]) || [],
      error: null,
    }
  },
}
