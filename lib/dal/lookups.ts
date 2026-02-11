/**
 * Lookups Data Access Layer
 *
 * Centralizes queries for reference/dropdown data: procedure types, milestone types,
 * delay types, case statuses, roles, payers, implant companies.
 *
 * These are queried on nearly every page for dropdowns and display labels.
 */

import type { AnySupabaseClient, DALListResult } from './index'

// ============================================
// TYPES
// ============================================

export interface ProcedureType {
  id: string
  name: string
  category: string | null
  body_region: string | null
  estimated_duration_minutes: number | null
  is_active: boolean
}

export interface MilestoneType {
  id: string
  name: string
  key: string
  display_order: number
  is_active: boolean
}

export interface DelayType {
  id: string
  name: string
  category: string | null
  is_active: boolean
}

export interface CaseStatusType {
  id: string
  name: string
  color: string
  display_order: number
}

export interface UserRole {
  id: string
  name: string
  description: string | null
}

export interface Payer {
  id: string
  name: string
  payer_type: string | null
  is_active: boolean
}

export interface ImplantCompany {
  id: string
  name: string
  facility_id: string | null
}

// ============================================
// DAL FUNCTIONS
// ============================================

export const lookupsDAL = {
  /**
   * Get procedure types for a facility
   */
  async procedureTypes(
    supabase: AnySupabaseClient,
    facilityId: string,
    activeOnly: boolean = true,
  ): Promise<DALListResult<ProcedureType>> {
    let query = supabase
      .from('procedure_types')
      .select('id, name, category, body_region, estimated_duration_minutes, is_active')
      .eq('facility_id', facilityId)
      .order('name')

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query
    return { data: (data as unknown as ProcedureType[]) || [], error }
  },

  /**
   * Get milestone types for a facility
   */
  async milestoneTypes(
    supabase: AnySupabaseClient,
    facilityId: string,
  ): Promise<DALListResult<MilestoneType>> {
    const { data, error } = await supabase
      .from('facility_milestones')
      .select(`
        milestone_type_id,
        display_order,
        is_active,
        milestone_type:milestone_types(id, name, key, display_order, is_active)
      `)
      .eq('facility_id', facilityId)
      .eq('is_active', true)
      .order('display_order')

    // Flatten the join
    const flattened = (data || []).map((row: Record<string, unknown>) => {
      const mt = row.milestone_type as MilestoneType | null
      return mt ? { ...mt, display_order: row.display_order as number } : null
    }).filter(Boolean) as MilestoneType[]

    return { data: flattened, error }
  },

  /**
   * Get delay types
   */
  async delayTypes(
    supabase: AnySupabaseClient,
    facilityId?: string,
  ): Promise<DALListResult<DelayType>> {
    let query = supabase
      .from('delay_types')
      .select('id, name, category, is_active')
      .eq('is_active', true)
      .order('name')

    if (facilityId) {
      query = query.or(`facility_id.is.null,facility_id.eq.${facilityId}`)
    }

    const { data, error } = await query
    return { data: (data as unknown as DelayType[]) || [], error }
  },

  /**
   * Get case statuses (ordered for display)
   */
  async caseStatuses(
    supabase: AnySupabaseClient,
  ): Promise<DALListResult<CaseStatusType>> {
    const { data, error } = await supabase
      .from('case_statuses')
      .select('id, name, color, display_order')
      .order('display_order')

    return { data: (data as unknown as CaseStatusType[]) || [], error }
  },

  /**
   * Get user roles
   */
  async userRoles(
    supabase: AnySupabaseClient,
  ): Promise<DALListResult<UserRole>> {
    const { data, error } = await supabase
      .from('user_roles')
      .select('id, name, description')
      .order('name')

    return { data: (data as unknown as UserRole[]) || [], error }
  },

  /**
   * Get surgeon role ID (frequently needed for filtering)
   */
  async surgeonRoleId(
    supabase: AnySupabaseClient,
  ): Promise<string | null> {
    const { data } = await supabase
      .from('user_roles')
      .select('id')
      .eq('name', 'surgeon')
      .single()

    return (data as unknown as { id: string } | null)?.id ?? null
  },

  /**
   * Get payers for a facility
   */
  async payers(
    supabase: AnySupabaseClient,
    facilityId: string,
  ): Promise<DALListResult<Payer>> {
    const { data, error } = await supabase
      .from('payers')
      .select('id, name, payer_type, is_active')
      .or(`facility_id.is.null,facility_id.eq.${facilityId}`)
      .eq('is_active', true)
      .order('name')

    return { data: (data as unknown as Payer[]) || [], error }
  },

  /**
   * Get implant companies for a facility
   */
  async implantCompanies(
    supabase: AnySupabaseClient,
    facilityId: string,
  ): Promise<DALListResult<ImplantCompany>> {
    const { data, error } = await supabase
      .from('implant_companies')
      .select('id, name, facility_id')
      .or(`facility_id.is.null,facility_id.eq.${facilityId}`)
      .order('name')

    return { data: (data as unknown as ImplantCompany[]) || [], error }
  },
}
