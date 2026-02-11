/**
 * Facilities Data Access Layer
 *
 * Centralizes all `facilities` table queries. Previously scattered across 35+ files.
 */

import type { AnySupabaseClient, DALResult, DALListResult } from './index'

// ============================================
// TYPES
// ============================================

export interface Facility {
  id: string
  name: string
  timezone: string
  is_demo: boolean
  case_number_prefix: string | null
  address: string | null
  phone: string | null
  logo_url: string | null
  created_at: string
}

export interface FacilitySettings {
  id: string
  facility_id: string
  start_time_milestone: 'patient_in' | 'incision'
  start_time_grace_minutes: number
  start_time_floor_minutes: number
  waiting_on_surgeon_minutes: number
  waiting_on_surgeon_floor_minutes: number
  min_procedure_cases: number
  or_hours_start: string
  or_hours_end: string
  default_turnover_minutes: number
  fcots_grace_minutes: number
}

export interface FacilityWithCounts extends Facility {
  userCount?: number
  caseCount?: number
}

// ============================================
// SELECT STRINGS
// ============================================

const FACILITY_SELECT = `
  id, name, timezone, is_demo, case_number_prefix,
  address, phone, logo_url, created_at
` as const

const FACILITY_SETTINGS_SELECT = `
  id, facility_id,
  start_time_milestone, start_time_grace_minutes, start_time_floor_minutes,
  waiting_on_surgeon_minutes, waiting_on_surgeon_floor_minutes,
  min_procedure_cases, or_hours_start, or_hours_end,
  default_turnover_minutes, fcots_grace_minutes
` as const

// ============================================
// DAL FUNCTIONS
// ============================================

export const facilitiesDAL = {
  /**
   * Get facility by ID
   */
  async getById(
    supabase: AnySupabaseClient,
    facilityId: string,
  ): Promise<DALResult<Facility>> {
    const { data, error } = await supabase
      .from('facilities')
      .select(FACILITY_SELECT)
      .eq('id', facilityId)
      .single()

    return { data: data as unknown as Facility | null, error }
  },

  /**
   * List all facilities (admin view)
   */
  async listAll(
    supabase: AnySupabaseClient,
    includeDemo: boolean = false,
  ): Promise<DALListResult<Facility>> {
    let query = supabase
      .from('facilities')
      .select(FACILITY_SELECT)
      .order('name')

    if (!includeDemo) {
      query = query.eq('is_demo', false)
    }

    const { data, error } = await query
    return { data: (data as unknown as Facility[]) || [], error }
  },

  /**
   * Get facility settings (analytics configuration)
   */
  async getSettings(
    supabase: AnySupabaseClient,
    facilityId: string,
  ): Promise<DALResult<FacilitySettings>> {
    const { data, error } = await supabase
      .from('facility_settings')
      .select(FACILITY_SETTINGS_SELECT)
      .eq('facility_id', facilityId)
      .single()

    return { data: data as unknown as FacilitySettings | null, error }
  },

  /**
   * Get facility timezone (lightweight — used in many date operations)
   */
  async getTimezone(
    supabase: AnySupabaseClient,
    facilityId: string,
  ): Promise<string> {
    const { data } = await supabase
      .from('facilities')
      .select('timezone')
      .eq('id', facilityId)
      .single()

    return (data as unknown as { timezone: string } | null)?.timezone || 'America/New_York'
  },

  /**
   * Get facility OR rooms
   */
  async getRooms(
    supabase: AnySupabaseClient,
    facilityId: string,
  ): Promise<DALListResult<{ id: string; name: string; display_order: number; is_active: boolean }>> {
    const { data, error } = await supabase
      .from('or_rooms')
      .select('id, name, display_order, is_active')
      .eq('facility_id', facilityId)
      .eq('is_active', true)
      .order('display_order')

    return { data: (data as unknown as { id: string; name: string; display_order: number; is_active: boolean }[]) || [], error }
  },
}
