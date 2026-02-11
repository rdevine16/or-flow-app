/**
 * Cases Data Access Layer
 *
 * Centralizes all `cases` table queries. Previously scattered across 82+ files.
 */

import type { AnySupabaseClient, DALResult, DALListResult, DateRange, PaginationParams } from './index'

// ============================================
// TYPES
// ============================================

/** Minimal case for list views */
export interface CaseListItem {
  id: string
  case_number: string
  patient_name: string
  patient_mrn: string | null
  scheduled_date: string
  start_time: string | null
  status: string | null
  or_room_id: string | null
  surgeon_id: string | null
  facility_id: string
  created_at: string
  surgeon?: { first_name: string; last_name: string } | null
  or_room?: { name: string } | null
  case_status?: { name: string; color: string } | null
  procedure_types?: { id: string; name: string }[]
}

/** Full case with all milestones for detail/edit views */
export interface CaseDetail extends CaseListItem {
  patient_dob: string | null
  patient_phone: string | null
  laterality: string | null
  anesthesia_type: string | null
  estimated_duration_minutes: number | null
  actual_duration_minutes: number | null
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
  milestone_type_id: string
  recorded_at: string
  recorded_by: string | null
  milestone_type?: { name: string; key: string; display_order: number }
}

export interface CaseFlag {
  id: string
  case_id: string
  delay_type_id: string | null
  flag_type: string
  notes: string | null
  minutes: number | null
  delay_type?: { name: string }
}

export interface CaseStaffMember {
  id: string
  case_id: string
  user_id: string
  role: string
  user?: { first_name: string; last_name: string }
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
  actual_duration_minutes: number | null
  procedure_type?: { name: string }
}

// ============================================
// SELECT STRINGS (reusable fragments)
// ============================================

const CASE_LIST_SELECT = `
  id, case_number, patient_name, patient_mrn,
  scheduled_date, start_time, status, or_room_id, surgeon_id, facility_id, created_at,
  surgeon:users!cases_surgeon_id_fkey(first_name, last_name),
  or_room:or_rooms(name),
  case_status:case_statuses(name, color)
` as const

const CASE_DETAIL_SELECT = `
  *, 
  surgeon:users!cases_surgeon_id_fkey(first_name, last_name),
  or_room:or_rooms(name),
  case_status:case_statuses(name, color),
  case_milestones(id, case_id, milestone_type_id, recorded_at, recorded_by,
    milestone_type:milestone_types(name, key, display_order)
  ),
  case_flags(id, case_id, delay_type_id, flag_type, notes, minutes,
    delay_type:delay_types(name)
  ),
  case_staff(id, case_id, user_id, role,
    user:users(first_name, last_name)
  ),
  case_implant_companies(id, case_id, implant_company_id,
    implant_company:implant_companies(name)
  )
` as const

const CASE_ANALYTICS_SELECT = `
  id, surgeon_id, procedure_type_id, scheduled_date, start_time, or_room_id,
  patient_in_at, patient_out_at, incision_at, prep_drape_complete_at, closing_at,
  actual_duration_minutes,
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
   * Search cases by patient name or case number
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
      .or(`patient_name.ilike.%${searchTerm}%,case_number.ilike.%${searchTerm}%`)
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
    milestoneTypeId: string,
    timestamp: string,
    recordedBy?: string,
  ): Promise<DALResult<CaseMilestone>> {
    const { data, error } = await supabase
      .from('case_milestones')
      .upsert(
        {
          case_id: caseId,
          milestone_type_id: milestoneTypeId,
          recorded_at: timestamp,
          recorded_by: recordedBy,
        },
        { onConflict: 'case_id,milestone_type_id' }
      )
      .select('id, case_id, milestone_type_id, recorded_at, recorded_by')
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
}

// Re-export PostgrestError for consumers
import type { PostgrestError } from '@supabase/supabase-js'
