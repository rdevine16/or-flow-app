/**
 * Voice Commands Data Access Layer
 *
 * Manages voice command aliases — spoken phrases that the iOS Room Mode
 * maps to milestone recordings and utility actions.
 *
 * Two scopes:
 *   - Facility-specific aliases (facility_id = <uuid>)
 *   - Global templates (facility_id = NULL) managed by global admins
 */

import type { AnySupabaseClient, DALListResult } from './index'

// ============================================
// TYPES
// ============================================

export interface VoiceCommandAlias {
  id: string
  facility_id: string | null
  milestone_type_id: string | null
  facility_milestone_id: string | null
  alias_phrase: string
  source_alias_id: string | null
  is_active: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  action_type: string
  auto_learned: boolean
}

export interface VoiceAliasInsert {
  facility_id: string | null
  milestone_type_id: string | null
  facility_milestone_id: string | null
  alias_phrase: string
  action_type: string
}

// ============================================
// SELECT FRAGMENTS
// ============================================

const ALIAS_SELECT = `
  id,
  facility_id,
  milestone_type_id,
  facility_milestone_id,
  alias_phrase,
  source_alias_id,
  is_active,
  deleted_at,
  created_at,
  updated_at,
  action_type,
  auto_learned
` as const

// ============================================
// DAL FUNCTIONS
// ============================================

export const voiceCommandsDAL = {
  /**
   * List all aliases for a facility (active only)
   */
  async listByFacility(
    supabase: AnySupabaseClient,
    facilityId: string,
  ): Promise<DALListResult<VoiceCommandAlias>> {
    const { data, error } = await supabase
      .from('voice_command_aliases')
      .select(ALIAS_SELECT)
      .eq('facility_id', facilityId)
      .eq('is_active', true)
      .order('action_type')
      .order('alias_phrase')

    return { data: (data as unknown as VoiceCommandAlias[]) || [], error }
  },

  /**
   * List all global template aliases (facility_id IS NULL, active only)
   */
  async listGlobal(
    supabase: AnySupabaseClient,
  ): Promise<DALListResult<VoiceCommandAlias>> {
    const { data, error } = await supabase
      .from('voice_command_aliases')
      .select(ALIAS_SELECT)
      .is('facility_id', null)
      .eq('is_active', true)
      .order('action_type')
      .order('alias_phrase')

    return { data: (data as unknown as VoiceCommandAlias[]) || [], error }
  },

  /**
   * Add a new voice command alias.
   * Returns the inserted row or a Postgrest error (e.g., unique constraint violation).
   */
  async addAlias(
    supabase: AnySupabaseClient,
    alias: VoiceAliasInsert,
  ): Promise<{ data: VoiceCommandAlias | null; error: { message: string; code?: string; details?: string } | null }> {
    const { data, error } = await supabase
      .from('voice_command_aliases')
      .insert(alias)
      .select(ALIAS_SELECT)
      .single()

    if (error) {
      return { data: null, error: { message: error.message, code: error.code, details: error.details } }
    }
    return { data: data as unknown as VoiceCommandAlias, error: null }
  },

  /**
   * Hard-delete a voice command alias by ID.
   */
  async deleteAlias(
    supabase: AnySupabaseClient,
    aliasId: string,
  ): Promise<{ success: boolean; error: { message: string; code?: string } | null }> {
    const { error } = await supabase
      .from('voice_command_aliases')
      .delete()
      .eq('id', aliasId)

    if (error) {
      return { success: false, error: { message: error.message, code: error.code } }
    }
    return { success: true, error: null }
  },

  /**
   * Check if an alias phrase already exists (case-insensitive) for any objective
   * within the same scope (facility or global).
   *
   * Returns the conflicting alias if found, null otherwise.
   */
  async checkDuplicate(
    supabase: AnySupabaseClient,
    phrase: string,
    actionType: string,
    facilityId: string | null,
  ): Promise<{ data: VoiceCommandAlias | null; error: { message: string } | null }> {
    let query = supabase
      .from('voice_command_aliases')
      .select(ALIAS_SELECT)
      .ilike('alias_phrase', phrase)
      .eq('action_type', actionType)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (facilityId) {
      query = supabase
        .from('voice_command_aliases')
        .select(ALIAS_SELECT)
        .ilike('alias_phrase', phrase)
        .eq('action_type', actionType)
        .eq('is_active', true)
        .eq('facility_id', facilityId)
        .limit(1)
        .maybeSingle()
    } else {
      query = supabase
        .from('voice_command_aliases')
        .select(ALIAS_SELECT)
        .ilike('alias_phrase', phrase)
        .eq('action_type', actionType)
        .eq('is_active', true)
        .is('facility_id', null)
        .limit(1)
        .maybeSingle()
    }

    const { data, error } = await query

    if (error) {
      return { data: null, error: { message: error.message } }
    }
    return { data: data as unknown as VoiceCommandAlias | null, error: null }
  },
}
