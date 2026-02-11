/**
 * Users Data Access Layer
 *
 * Centralizes all `users` table queries. Previously scattered across 61+ files.
 */

import type { AnySupabaseClient, DALResult, DALListResult } from './index'

// ============================================
// TYPES
// ============================================

/** Current user's profile (auth context) */
export interface UserProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  facility_id: string | null
  role_id: string | null
  access_level: string
  is_active: boolean
  must_change_password: boolean
  blocked: boolean
  facility?: { name: string; timezone: string } | null
  role?: { name: string } | null
}

/** Surgeon for dropdowns and case assignment */
export interface SurgeonListItem {
  id: string
  first_name: string
  last_name: string
  closing_workflow: string | null
  closing_handoff_minutes: number | null
}

/** User for staff management views */
export interface UserListItem {
  id: string
  email: string
  first_name: string
  last_name: string
  role_id: string | null
  is_active: boolean
  access_level: string
  last_login_at: string | null
  created_at: string
  role?: { name: string } | null
}

// ============================================
// SELECT STRINGS
// ============================================

const USER_PROFILE_SELECT = `
  id, email, first_name, last_name, facility_id, role_id,
  access_level, is_active, must_change_password, blocked,
  facility:facilities(name, timezone),
  role:user_roles(name)
` as const

const SURGEON_LIST_SELECT = `
  id, first_name, last_name, closing_workflow, closing_handoff_minutes
` as const

const USER_LIST_SELECT = `
  id, email, first_name, last_name, role_id, is_active,
  access_level, last_login_at, created_at,
  role:user_roles(name)
` as const

// ============================================
// DAL FUNCTIONS
// ============================================

export const usersDAL = {
  /**
   * Get current user's profile by auth ID
   */
  async getProfile(
    supabase: AnySupabaseClient,
    userId: string,
  ): Promise<DALResult<UserProfile>> {
    const { data, error } = await supabase
      .from('users')
      .select(USER_PROFILE_SELECT)
      .eq('id', userId)
      .single()

    return { data: data as unknown as UserProfile | null, error }
  },

  /**
   * Get user's facility ID (lightweight — used in many page loads)
   */
  async getFacilityId(
    supabase: AnySupabaseClient,
    userId: string,
  ): Promise<DALResult<{ facility_id: string | null }>> {
    const { data, error } = await supabase
      .from('users')
      .select('facility_id')
      .eq('id', userId)
      .single()

    return { data: data as { facility_id: string | null } | null, error }
  },

  /**
   * Get user's access level (used for auth checks)
   */
  async getAccessLevel(
    supabase: AnySupabaseClient,
    userId: string,
  ): Promise<DALResult<{ access_level: string }>> {
    const { data, error } = await supabase
      .from('users')
      .select('access_level')
      .eq('id', userId)
      .single()

    return { data: data as { access_level: string } | null, error }
  },

  /**
   * List surgeons for a facility (dropdowns, case assignment)
   */
  async listSurgeons(
    supabase: AnySupabaseClient,
    facilityId: string,
  ): Promise<DALListResult<SurgeonListItem>> {
    // First get surgeon role ID
    const { data: role } = await supabase
      .from('user_roles')
      .select('id')
      .eq('name', 'surgeon')
      .single()

    if (!role) {
      return { data: [], error: null }
    }

    const { data, error } = await supabase
      .from('users')
      .select(SURGEON_LIST_SELECT)
      .eq('facility_id', facilityId)
      .eq('role_id', role.id)
      .eq('is_active', true)
      .order('last_name')

    return { data: (data as unknown as SurgeonListItem[]) || [], error }
  },

  /**
   * List all users for a facility (admin user management)
   */
  async listByFacility(
    supabase: AnySupabaseClient,
    facilityId: string,
    includeInactive: boolean = false,
  ): Promise<DALListResult<UserListItem>> {
    let query = supabase
      .from('users')
      .select(USER_LIST_SELECT)
      .eq('facility_id', facilityId)
      .order('last_name')

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query
    return { data: (data as unknown as UserListItem[]) || [], error }
  },

  /**
   * Count users per facility (admin overview)
   */
  async countByFacility(
    supabase: AnySupabaseClient,
    facilityId: string,
  ): Promise<{ count: number; error: unknown }> {
    const { count, error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('facility_id', facilityId)
      .eq('is_active', true)

    return { count: count ?? 0, error }
  },

  /**
   * Update surgeon closing workflow preferences
   */
  async updateClosingWorkflow(
    supabase: AnySupabaseClient,
    surgeonId: string,
    workflow: string,
    handoffMinutes: number,
  ): Promise<DALResult<{ id: string }>> {
    const { data, error } = await supabase
      .from('users')
      .update({
        closing_workflow: workflow,
        closing_handoff_minutes: workflow === 'pa_closes' ? handoffMinutes : 0,
      })
      .eq('id', surgeonId)
      .select('id')
      .single()

    return { data: data as { id: string } | null, error }
  },

  /**
   * Check if email already exists
   */
  async existsByEmail(
    supabase: AnySupabaseClient,
    email: string,
  ): Promise<boolean> {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    return !!data
  },
}
