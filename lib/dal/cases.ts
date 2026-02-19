/**
 * Cases Data Access Layer
 *
 * Centralizes all `cases` table queries. Previously scattered across 82+ files.
 */

import type { AnySupabaseClient, DALResult, DALListResult, DateRange, PaginationParams, SortParams } from './index'
import { getLocalDateString } from '@/lib/date-utils'

// ============================================
// TYPES
// ============================================

/** Minimal case for list views */
export interface CaseListItem {
  id: string
  case_number: string
  scheduled_date: string
  start_time: string | null
  status_id: string | null
  data_validated: boolean
  or_room_id: string | null
  surgeon_id: string | null
  facility_id: string
  created_at: string
  created_by: string | null
  surgeon?: { first_name: string; last_name: string } | null
  or_room?: { name: string } | null
  case_status?: { name: string } | null
  scheduled_duration_minutes: number | null
  procedure_type?: { id: string; name: string; procedure_category_id: string | null } | null
}

/** Tab identifiers for the cases page status tabs */
export type CasesPageTab = 'all' | 'today' | 'scheduled' | 'in_progress' | 'completed' | 'data_quality'

/** Filter params for the cases page (search, entity filters) */
export interface CasesFilterParams {
  search?: string          // ilike on case_number
  surgeonIds?: string[]    // in surgeon_id
  roomIds?: string[]       // in or_room_id
  procedureIds?: string[]  // in procedure_type_id
}

/** Flag severity summary for a single case (used in table flag indicators) */
export interface CaseFlagSummary {
  case_id: string
  max_severity: string
  flag_count: number
}

/** Full case with all milestones for detail/edit views */
export interface CaseDetail extends CaseListItem {
  patient_dob: string | null
  patient_phone: string | null
  laterality: string | null
  anesthesia_type: string | null
  scheduled_duration_minutes: number | null
  notes: string | null
  rep_required_override: boolean | null
  called_back_at: string | null
  called_back_by: string | null
  complexity_id: string | null
  case_milestones: CaseMilestone[]
  case_flags: CaseFlag[]
  case_staff: CaseStaffMember[]
  case_implant_companies: CaseImplantCompany[]
}

export interface CaseMilestone {
  id: string
  case_id: string
  facility_milestone_id: string
  recorded_at: string
  recorded_by: string | null
  facility_milestone?: { name: string; display_name: string | null; display_order: number }
}

export interface CaseFlag {
  id: string
  case_id: string
  delay_type_id: string | null
  flag_type: string
  severity: string | null
  note: string | null
  duration_minutes: number | null
  delay_type?: { name: string; display_name: string | null }
}

export interface CaseStaffMember {
  id: string
  case_id: string
  user_id: string
  role_id: string | null
  user?: { first_name: string; last_name: string }
  user_role?: { name: string }
}

export interface CaseImplantCompany {
  id: string
  case_id: string
  implant_company_id: string
  implant_company?: { name: string }
}

/** Case data for analytics (minimal fields for calculations) */
export interface CaseForAnalytics {
  id: string
  surgeon_id: string
  procedure_type_id: string
  scheduled_date: string
  start_time: string | null
  or_room_id: string
  patient_in_at: string | null
  patient_out_at: string | null
  incision_at: string | null
  prep_drape_complete_at: string | null
  closing_at: string | null
  procedure_type?: { name: string }
}

// ============================================
// SELECT STRINGS (reusable fragments)
// ============================================

const CASE_LIST_SELECT = `
  id, case_number,
  scheduled_date, start_time, status_id, data_validated, or_room_id, surgeon_id, facility_id,
  scheduled_duration_minutes, created_at, created_by,
  surgeon:users!cases_surgeon_id_fkey(first_name, last_name),
  or_room:or_rooms(name),
  case_status:case_statuses(name),
  procedure_type:procedure_types(id, name, procedure_category_id)
` as const

const CASE_DETAIL_SELECT = `
  *,
  surgeon:users!cases_surgeon_id_fkey(first_name, last_name),
  or_room:or_rooms(name),
  case_status:case_statuses(name),
  procedure_type:procedure_types(id, name, procedure_category_id),
  case_milestones(id, case_id, facility_milestone_id, recorded_at, recorded_by,
    facility_milestone:facility_milestones(name, display_name, display_order)
  ),
  case_flags(id, case_id, delay_type_id, flag_type, severity, note, duration_minutes,
    delay_type:delay_types(name, display_name)
  ),
  case_staff(id, case_id, user_id, role_id,
    user:users!case_staff_user_id_fkey(first_name, last_name),
    user_role:user_roles!case_staff_role_id_fkey(name)
  ),
  case_implant_companies(implant_company_id)
` as const

const CASE_ANALYTICS_SELECT = `
  id, surgeon_id, procedure_type_id, scheduled_date, start_time, or_room_id,
  patient_in_at, patient_out_at, incision_at, prep_drape_complete_at, closing_at,
  procedure_type:procedure_types(name)
` as const

// ============================================
// DAL FUNCTIONS
// ============================================

export const casesDAL = {
  /**
   * List cases for a facility on a specific date (dashboard view)
   */
  async listByDate(
    supabase: AnySupabaseClient,
    facilityId: string,
    date: string,
  ): Promise<DALListResult<CaseListItem>> {
    const { data, error } = await supabase
      .from('cases')
      .select(CASE_LIST_SELECT)
      .eq('facility_id', facilityId)
      .eq('scheduled_date', date)
      .order('start_time', { ascending: true })

return { data: (data as unknown as CaseListItem[]) || [], error }
  },

  /**
   * List cases for a facility within a date range (cases list, analytics)
   */
  async listByDateRange(
    supabase: AnySupabaseClient,
    facilityId: string,
    dateRange: DateRange,
    pagination?: PaginationParams,
  ): Promise<DALListResult<CaseListItem>> {
    let query = supabase
      .from('cases')
      .select(CASE_LIST_SELECT, { count: 'exact' })
      .eq('facility_id', facilityId)
      .gte('scheduled_date', dateRange.start)
      .lte('scheduled_date', dateRange.end)
      .order('scheduled_date', { ascending: false })
      .order('start_time', { ascending: true })

    if (pagination) {
      const page = pagination.page || 1
      const size = pagination.pageSize || 25
      const from = (page - 1) * size
      query = query.range(from, from + size - 1)
    }

    const { data, error, count } = await query
    return { data: (data as unknown as CaseListItem[]) || [], error, count: count ?? undefined }
  },

  /**
   * Get full case detail by ID
   */
  async getById(
    supabase: AnySupabaseClient,
    caseId: string,
  ): Promise<DALResult<CaseDetail>> {
    const { data, error } = await supabase
      .from('cases')
      .select(CASE_DETAIL_SELECT)
      .eq('id', caseId)
      .single()

    return { data: data as unknown as CaseDetail | null, error }
  },

  /**
   * Get cases for analytics/scoring (optimized select)
   */
  async listForAnalytics(
    supabase: AnySupabaseClient,
    facilityId: string,
    dateRange: DateRange,
    surgeonId?: string,
  ): Promise<DALListResult<CaseForAnalytics>> {
    let query = supabase
      .from('cases')
      .select(CASE_ANALYTICS_SELECT)
      .eq('facility_id', facilityId)
      .gte('scheduled_date', dateRange.start)
      .lte('scheduled_date', dateRange.end)
      .not('patient_in_at', 'is', null)
      .not('patient_out_at', 'is', null)

    if (surgeonId) {
      query = query.eq('surgeon_id', surgeonId)
    }

    const { data, error } = await query.order('scheduled_date')
    return { data: (data as unknown as CaseForAnalytics[]) || [], error }
  },

  /**
   * Search cases by case number
   */
  async search(
    supabase: AnySupabaseClient,
    facilityId: string,
    searchTerm: string,
    limit: number = 10,
  ): Promise<DALListResult<CaseListItem>> {
    const { data, error } = await supabase
      .from('cases')
      .select(CASE_LIST_SELECT)
      .eq('facility_id', facilityId)
      .ilike('case_number', `%${searchTerm}%`)
      .order('scheduled_date', { ascending: false })
      .limit(limit)

    return { data: (data as unknown as CaseListItem[]) || [], error }
  },

  /**
   * Get case count for a facility (used in admin dashboards)
   */
  async countByFacility(
    supabase: AnySupabaseClient,
    facilityId: string,
    dateRange?: DateRange,
  ): Promise<{ count: number; error: PostgrestError | null }> {
    let query = supabase
      .from('cases')
      .select('id', { count: 'exact', head: true })
      .eq('facility_id', facilityId)

    if (dateRange) {
      query = query
        .gte('scheduled_date', dateRange.start)
        .lte('scheduled_date', dateRange.end)
    }

    const { count, error } = await query
    return { count: count ?? 0, error }
  },

  /**
   * Record a milestone timestamp on a case
   */
  async recordMilestone(
    supabase: AnySupabaseClient,
    caseId: string,
    facilityMilestoneId: string,
    timestamp: string,
    recordedBy?: string,
  ): Promise<DALResult<CaseMilestone>> {
    const { data, error } = await supabase
      .from('case_milestones')
      .upsert(
        {
          case_id: caseId,
          facility_milestone_id: facilityMilestoneId,
          recorded_at: timestamp,
          recorded_by: recordedBy,
        },
        { onConflict: 'case_id,facility_milestone_id' }
      )
      .select('id, case_id, facility_milestone_id, recorded_at, recorded_by')
      .single()

    return { data: data as CaseMilestone | null, error }
  },

  /**
   * Update callback status (called_back_at / called_back_by)
   */
  async updateCallbackStatus(
    supabase: AnySupabaseClient,
    caseId: string,
    calledBackAt: string | null,
    calledBackBy: string | null,
  ): Promise<DALResult<{ id: string }>> {
    const { data, error } = await supabase
      .from('cases')
      .update({ called_back_at: calledBackAt, called_back_by: calledBackBy })
      .eq('id', caseId)
      .select('id')
      .single()

    return { data: data as { id: string } | null, error }
  },

  /**
   * List cases for the cases page with tab filtering, sorting, and pagination.
   * Extends listByDateRange with tab-aware status filtering and sort params.
   */
  async listForCasesPage(
    supabase: AnySupabaseClient,
    facilityId: string,
    dateRange: DateRange,
    tab: CasesPageTab,
    pagination?: PaginationParams,
    sort?: SortParams,
    statusIds?: Record<string, string>,
    filters?: CasesFilterParams,
  ): Promise<DALListResult<CaseListItem>> {
    let query = supabase
      .from('cases')
      .select(CASE_LIST_SELECT, { count: 'exact' })
      .eq('facility_id', facilityId)

    // Date range — "today" tab overrides to today's date, "data_quality" has no date filter
    if (tab === 'today') {
      query = query.eq('scheduled_date', getLocalDateString())
    } else if (tab !== 'data_quality') {
      query = query
        .gte('scheduled_date', dateRange.start)
        .lte('scheduled_date', dateRange.end)
    }

    // Tab-specific status filtering
    if (tab === 'scheduled' && statusIds?.scheduled) {
      query = query.eq('status_id', statusIds.scheduled)
    } else if (tab === 'in_progress' && statusIds?.in_progress) {
      query = query.eq('status_id', statusIds.in_progress)
    } else if (tab === 'completed' && statusIds?.completed) {
      query = query.eq('status_id', statusIds.completed)
    } else if (tab === 'data_quality') {
      // DQ engine: get case IDs with unresolved metric_issues
      const { data: caseIds } = await this.getCaseIdsWithUnresolvedIssues(supabase, facilityId)
      if (!caseIds || caseIds.length === 0) {
        return { data: [], error: null, count: 0 }
      }
      query = query.in('id', caseIds)
    }

    // Entity filters
    if (filters?.search) {
      query = query.ilike('case_number', `%${filters.search}%`)
    }
    if (filters?.surgeonIds && filters.surgeonIds.length > 0) {
      query = query.in('surgeon_id', filters.surgeonIds)
    }
    if (filters?.roomIds && filters.roomIds.length > 0) {
      query = query.in('or_room_id', filters.roomIds)
    }
    if (filters?.procedureIds && filters.procedureIds.length > 0) {
      query = query.in('procedure_type_id', filters.procedureIds)
    }

    // Sorting
    const sortColumn = sort ? SORT_COLUMN_MAP[sort.sortBy] || 'scheduled_date' : 'scheduled_date'
    const ascending = sort ? sort.sortDirection === 'asc' : false
    query = query.order(sortColumn, { ascending })

    // Secondary sort for stability
    if (sortColumn !== 'start_time') {
      query = query.order('start_time', { ascending: true })
    }

    // Pagination
    if (pagination) {
      const page = pagination.page || 1
      const size = pagination.pageSize || 25
      const from = (page - 1) * size
      query = query.range(from, from + size - 1)
    }

    const { data, error, count } = await query
    return { data: (data as unknown as CaseListItem[]) || [], error, count: count ?? undefined }
  },

  /**
   * Get case counts for all tabs in a single set of queries.
   * Returns a map of tab → count.
   */
  async countByTab(
    supabase: AnySupabaseClient,
    facilityId: string,
    dateRange: DateRange,
    statusIds: Record<string, string>,
    filters?: CasesFilterParams,
  ): Promise<{ data: Record<CasesPageTab, number>; error: PostgrestError | null }> {
    const today = getLocalDateString()

    const baseFilter = () => {
      let q = supabase
        .from('cases')
        .select('id', { count: 'exact', head: true })
        .eq('facility_id', facilityId)

      // Apply entity filters to counts so badges reflect filtered state
      if (filters?.search) {
        q = q.ilike('case_number', `%${filters.search}%`)
      }
      if (filters?.surgeonIds && filters.surgeonIds.length > 0) {
        q = q.in('surgeon_id', filters.surgeonIds)
      }
      if (filters?.roomIds && filters.roomIds.length > 0) {
        q = q.in('or_room_id', filters.roomIds)
      }
      if (filters?.procedureIds && filters.procedureIds.length > 0) {
        q = q.in('procedure_type_id', filters.procedureIds)
      }

      return q
    }

    const dateRangeFilter = () =>
      baseFilter()
        .gte('scheduled_date', dateRange.start)
        .lte('scheduled_date', dateRange.end)

    const [allResult, todayResult, scheduledResult, inProgressResult, completedResult, dqResult] =
      await Promise.all([
        dateRangeFilter(),
        baseFilter().eq('scheduled_date', today),
        statusIds.scheduled
          ? dateRangeFilter().eq('status_id', statusIds.scheduled)
          : Promise.resolve({ count: 0, error: null }),
        statusIds.in_progress
          ? dateRangeFilter().eq('status_id', statusIds.in_progress)
          : Promise.resolve({ count: 0, error: null }),
        statusIds.completed
          ? dateRangeFilter().eq('status_id', statusIds.completed)
          : Promise.resolve({ count: 0, error: null }),
        // Needs validation: count unique cases with unresolved metric_issues
        this.getCaseIdsWithUnresolvedIssues(supabase, facilityId),
      ])

    // Return first error encountered
    const firstError = [allResult, todayResult, scheduledResult, inProgressResult, completedResult]
      .find(r => r.error)?.error ?? dqResult.error ?? null

    return {
      data: {
        all: allResult.count ?? 0,
        today: todayResult.count ?? 0,
        scheduled: (scheduledResult.count ?? 0) as number,
        in_progress: (inProgressResult.count ?? 0) as number,
        completed: (completedResult.count ?? 0) as number,
        data_quality: dqResult.data?.length ?? 0,
      },
      error: firstError,
    }
  },

  /**
   * Get flag summaries for a batch of case IDs.
   * Returns max severity and count per case (for table flag indicator dots).
   */
  async flagsByCase(
    supabase: AnySupabaseClient,
    caseIds: string[],
  ): Promise<DALListResult<CaseFlagSummary>> {
    if (caseIds.length === 0) {
      return { data: [], error: null }
    }

    const { data, error } = await supabase
      .from('case_flags')
      .select('case_id, flag_type')
      .in('case_id', caseIds)

    if (error || !data) {
      return { data: [], error }
    }

    // Aggregate in JS: group by case_id, find max severity, count flags
    const severityRank: Record<string, number> = { critical: 3, warning: 2, info: 1 }
    const grouped = new Map<string, { maxSeverity: string; maxRank: number; count: number }>()

    for (const flag of data as { case_id: string; flag_type: string }[]) {
      const existing = grouped.get(flag.case_id)
      const rank = severityRank[flag.flag_type] ?? 0

      if (existing) {
        existing.count++
        if (rank > existing.maxRank) {
          existing.maxSeverity = flag.flag_type
          existing.maxRank = rank
        }
      } else {
        grouped.set(flag.case_id, { maxSeverity: flag.flag_type, maxRank: rank, count: 1 })
      }
    }

    const summaries: CaseFlagSummary[] = Array.from(grouped.entries()).map(([caseId, info]) => ({
      case_id: caseId,
      max_severity: info.maxSeverity,
      flag_count: info.count,
    }))

    return { data: summaries, error: null }
  },

  /**
   * Get deduplicated case IDs that have at least one unresolved metric issue.
   * Used to determine which cases "need validation" from the DQ perspective.
   */
  async getCaseIdsWithUnresolvedIssues(
    supabase: AnySupabaseClient,
    facilityId: string,
  ): Promise<DALResult<string[]>> {
    const { data, error } = await supabase
      .from('metric_issues')
      .select('case_id')
      .eq('facility_id', facilityId)
      .is('resolved_at', null)

    if (error) return { data: null, error }

    const caseIds = [...new Set((data as { case_id: string }[]).map(d => d.case_id))]
    return { data: caseIds, error: null }
  },

  /**
   * Cancel a case (set status to cancelled with reason).
   */
  async cancelCase(
    supabase: AnySupabaseClient,
    caseId: string,
    cancelledStatusId: string,
    cancellationReasonId: string,
    userId: string | null,
    notes?: string,
  ): Promise<DALResult<{ id: string }>> {
    const { data, error } = await supabase
      .from('cases')
      .update({
        status_id: cancelledStatusId,
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
        cancellation_reason_id: cancellationReasonId,
        cancellation_notes: notes || null,
      })
      .eq('id', caseId)
      .select('id')
      .single()

    return { data: data as { id: string } | null, error }
  },

  /**
   * Fetch all cases matching current filters for CSV export.
   * Limited to 5000 rows for safety.
   */
  async listForExport(
    supabase: AnySupabaseClient,
    facilityId: string,
    dateRange: DateRange,
    tab: CasesPageTab,
    sort?: SortParams,
    statusIds?: Record<string, string>,
    filters?: CasesFilterParams,
  ): Promise<DALListResult<CaseListItem>> {
    return this.listForCasesPage(
      supabase,
      facilityId,
      dateRange,
      tab,
      { page: 1, pageSize: 5000 },
      sort,
      statusIds,
      filters,
    )
  },
}

// ============================================
// SORT COLUMN MAPPING
// ============================================

/** Maps UI column names to database column names for server-side sorting */
const SORT_COLUMN_MAP: Record<string, string> = {
  date: 'scheduled_date',
  surgeon: 'surgeon_id',
  procedure: 'procedure_type_id',
  duration: 'scheduled_duration_minutes',
  room: 'or_room_id',
  case_number: 'case_number',
  start_time: 'start_time',
  validation: 'data_validated',
}

// Re-export PostgrestError for consumers
import type { PostgrestError } from '@supabase/supabase-js'
