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
  is_active: boolean
}

export interface MilestoneType {
  id: string
  name: string
  key: string
  display_order: number
  is_active: boolean
}

export interface FacilityMilestone {
  id: string
  name: string
  display_name: string | null
  display_order: number
  is_active: boolean
  source_milestone_type_id: string | null
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
  is_active: boolean
}

export interface ImplantCompany {
  id: string
  name: string
  facility_id: string | null
}

export interface PhaseDefinition {
  id: string
  facility_id: string
  name: string
  display_name: string
  display_order: number
  start_milestone_id: string
  end_milestone_id: string
  color_key: string | null
  is_active: boolean
  deleted_at: string | null
  parent_phase_id: string | null
}

export interface SurgeonMilestoneConfig {
  id: string
  facility_id: string
  surgeon_id: string
  procedure_type_id: string
  facility_milestone_id: string
  is_enabled: boolean
  display_order: number | null
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
      .select('id, name, category, body_region, is_active')
      .eq('facility_id', facilityId)
      .order('name')

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query
    return { data: (data as unknown as ProcedureType[]) || [], error }
  },

  /**
   * Get facility milestones (v2.0 — facility_milestones are the primary entity)
   */
  async facilityMilestones(
    supabase: AnySupabaseClient,
    facilityId: string,
  ): Promise<DALListResult<FacilityMilestone>> {
    const { data, error } = await supabase
      .from('facility_milestones')
      .select('id, name, display_name, display_order, is_active, source_milestone_type_id')
      .eq('facility_id', facilityId)
      .eq('is_active', true)
      .order('display_order')

    return { data: (data as unknown as FacilityMilestone[]) || [], error }
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
      .select('id, name, is_active')
      .or(`facility_id.is.null,facility_id.eq.${facilityId}`)
      .eq('is_active', true)
      .order('name')

    return { data: (data as unknown as Payer[]) || [], error }
  },

  /**
   * Get phase definitions for a facility
   */
  async phaseDefinitions(
    supabase: AnySupabaseClient,
    facilityId: string,
  ): Promise<DALListResult<PhaseDefinition>> {
    const { data, error } = await supabase
      .from('phase_definitions')
      .select('id, facility_id, name, display_name, display_order, start_milestone_id, end_milestone_id, color_key, is_active, deleted_at, parent_phase_id')
      .eq('facility_id', facilityId)
      .order('display_order')

    return { data: (data as unknown as PhaseDefinition[]) || [], error }
  },

  /**
   * Get surgeon milestone configs for a surgeon + procedure at a facility
   */
  async surgeonMilestoneConfig(
    supabase: AnySupabaseClient,
    facilityId: string,
    surgeonId: string,
    procedureTypeId: string,
  ): Promise<DALListResult<SurgeonMilestoneConfig>> {
    const { data, error } = await supabase
      .from('surgeon_milestone_config')
      .select('id, facility_id, surgeon_id, procedure_type_id, facility_milestone_id, is_enabled, display_order')
      .eq('facility_id', facilityId)
      .eq('surgeon_id', surgeonId)
      .eq('procedure_type_id', procedureTypeId)

    return { data: (data as unknown as SurgeonMilestoneConfig[]) || [], error }
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
